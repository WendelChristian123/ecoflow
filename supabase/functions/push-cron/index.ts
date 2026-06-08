import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Dequeue batch safely using RPC (FOR UPDATE SKIP LOCKED)
    const { data: batch, error: dequeueError } = await supabase
      .rpc('dequeue_scheduled_notifications', { p_batch_size: 50 });

    if (dequeueError) {
      throw new Error(`Dequeue failed: ${dequeueError.message}`);
    }

    if (!batch || batch.length === 0) {
      return new Response(JSON.stringify({ message: "No pending notifications" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { sent: 0, failed: 0, skipped: 0 };

    // 2. Process each notification
    for (const item of batch) {
      let title = "Notificação";
      let body = "";
      let url = "/";
      let shouldSend = true;

      try {
        // Fetch fresh data based on notification type
        if (item.notification_type === 'task_deadline') {
          const { data: task } = await supabase.from('tasks').select('title, status').eq('id', item.reference_id).single();
          if (!task || task.status === 'done') { shouldSend = false; }
          else {
            title = "📋 Lembrete de Tarefa";
            body = `A tarefa "${task.title}" vence em breve.`;
            url = `/#/tasks?open=${item.reference_id}`;
          }
        } else if (item.notification_type === 'event_start') {
          const { data: evt } = await supabase.from('calendar_events').select('title, status').eq('id', item.reference_id).single();
          if (!evt || evt.status === 'completed' || evt.status === 'cancelled') { shouldSend = false; }
          else {
            title = "📅 Compromisso Agendado";
            body = `O evento "${evt.title}" começa em breve.`;
            url = `/#/agenda?open=${item.reference_id}`;
          }
        } else if (item.notification_type === 'payable_due' || item.notification_type === 'receivable_due') {
          const { data: fin } = await supabase.from('financial_transactions').select('description, is_paid, type').eq('id', item.reference_id).single();
          if (!fin || fin.is_paid) { shouldSend = false; }
          else {
            title = `💰 Lembrete Financeiro (${fin.type === 'expense' ? 'A Pagar' : 'A Receber'})`;
            body = `Lançamento: ${fin.description}`;
            url = `/#/finance/transactions?open=${item.reference_id}`;
          }
        }

        // If item became invalid between enqueue and dequeue
        if (!shouldSend) {
          await supabase.from('scheduled_notifications').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', item.id);
          results.skipped++;
          continue;
        }

        // Check if user has push subscriptions
        const { data: subs } = await supabase.from("push_subscriptions").select("id").eq("user_id", item.user_id).limit(1);
        if (!subs || subs.length === 0) {
          // No subscriptions, mark as sent so we don't retry forever, but ideally we could mark as 'skipped'
          await supabase.from('scheduled_notifications').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', item.id);
          results.skipped++;
          continue;
        }

        // Call push-notify
        const pushRes = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: item.user_id,
            title,
            body,
            data: { type: item.notification_type, id: item.reference_id, url }
          }),
        });

        if (pushRes.ok) {
          await supabase.from('scheduled_notifications').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', item.id);
          results.sent++;
        } else {
          throw new Error(`Push API returned ${pushRes.status}`);
        }

      } catch (err) {
        // Handle failure
        const newAttempts = item.attempts + 1;
        const status = newAttempts >= 3 ? 'failed' : 'pending'; // Retry up to 3 times
        
        await supabase.from('scheduled_notifications').update({
          status,
          attempts: newAttempts,
          last_error: (err as Error).message,
          updated_at: new Date().toISOString()
        }).eq('id', item.id);
        
        results.failed++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
