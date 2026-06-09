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

    if (req.method === 'GET' && new URL(req.url).searchParams.get('debug') === '1') {
      const { data } = await supabase.from('scheduled_notifications').select('*').order('created_at', { ascending: false }).limit(10);
      return new Response(JSON.stringify(data, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

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

    function formatTimeRemaining(targetDateStr: string | null, isDateOnly: boolean = false) {
      if (!targetDateStr) return "em breve";
      
      if (isDateOnly) {
        const now = new Date();
        const target = new Date(targetDateStr);
        // Normalize to ignore time components for date-only comparisons
        now.setUTCHours(0, 0, 0, 0);
        
        // Sometimes date-only fields from DB come as YYYY-MM-DDT03:00:00Z (Brazil midnight).
        // Setting UTC hours to 0 normalizes it to the same day.
        target.setUTCHours(0, 0, 0, 0);
        
        const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return "amanhã";
        if (diffDays === 0) return "hoje";
        if (diffDays < 0) return "agora";
        return `em ${diffDays} dias`;
      }

      const diffMs = new Date(targetDateStr).getTime() - new Date().getTime();
      if (diffMs <= 0) return "agora";
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 1) return `em ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      if (diffHours >= 1) return `em ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
      const diffMinutes = Math.round(diffMs / (1000 * 60));
      if (diffMinutes >= 1) return `em ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
      return "em breve";
    }

    // 2. Process each notification
    for (const item of batch) {
      try {
        let shouldSend = true;
        let title = "";
        let body = "";
        let url = "/";

        // Fetch fresh data based on notification type
        if (item.notification_type === 'task_deadline') {
          const { data: task } = await supabase.from('tasks').select('title, status, due_date').eq('id', item.reference_id).single();
          if (!task || task.status === 'done') { shouldSend = false; }
          else {
            title = "📋 Lembrete de Tarefa";
            body = `A tarefa "${task.title}" vence ${formatTimeRemaining(task.due_date, false)}.`;
            url = `/#/tasks?open=${item.reference_id}`;
          }
        } else if (item.notification_type === 'event_start') {
          const { data: evt } = await supabase.from('calendar_events').select('title, status, start_date').eq('id', item.reference_id).single();
          if (!evt || evt.status === 'completed' || evt.status === 'cancelled') { shouldSend = false; }
          else {
            title = "📅 Lembrete de Agenda";
            body = `O Compromisso "${evt.title}" começa ${formatTimeRemaining(evt.start_date, false)}.`;
            url = `/#/agenda?open=${item.reference_id}`;
          }
        } else if (item.notification_type === 'payable_due' || item.notification_type === 'receivable_due') {
          const { data: fin } = await supabase.from('financial_transactions').select('description, is_paid, type, date').eq('id', item.reference_id).single();
          if (!fin || fin.is_paid) { shouldSend = false; }
          else {
            title = `💰 Lembrete Financeiro (${fin.type === 'expense' ? 'A Pagar' : 'A Receber'})`;
            body = `A conta "${fin.description}" vence ${formatTimeRemaining(fin.date, true)}.`;
            url = `/#/finance/transactions?open=${item.reference_id}`;
          }
        } else if (item.notification_type === 'quote_expiration') {
          const { data: quote } = await supabase.from('quotes').select('customer_name, status, valid_until').eq('id', item.reference_id).single();
          if (!quote || quote.status === 'approved' || quote.status === 'rejected') { shouldSend = false; }
          else {
            title = "🤝 Vencimento de Orçamento";
            body = `O Orçamento de "${quote.customer_name}" vence ${formatTimeRemaining(quote.valid_until, true)}.`;
            url = `/#/commercial/quotes?open=${item.reference_id}`;
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

        // Call push-notify via supabase client to avoid 401 Auth issues
        const { error: pushError } = await supabase.functions.invoke('push-notify', {
          body: {
            user_id: item.user_id,
            title,
            body,
            data: { type: item.notification_type, id: item.reference_id, url }
          }
        });

        if (!pushError) {
          await supabase.from('scheduled_notifications').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', item.id);
          results.sent++;
        } else {
          throw new Error(`Push API returned error: ${pushError.message || pushError}`);
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
