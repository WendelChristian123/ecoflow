import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  company_id: string;
  notification_type: string;
  reference_id: string;
  reference_date: string;
  title: string;
  body: string;
  data: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const now = new Date();
    // Look up to 48 hours into the future for upcoming events
    const maxFuture = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const notifications: NotificationPayload[] = [];

    // --- Fetch Preferences ---
    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select("user_id, company_id, module_id, event_type, notify_before_minutes");

    const getPref = (userId: string, companyId: string, modId: string, evType: string): number | null => {
      const p = prefs?.find(x => x.user_id === userId && x.company_id === companyId && x.module_id === modId && x.event_type === evType);
      if (!p) return null;
      return p.notify_before_minutes;
    };

    // Helper to format unique date reference for a single notification instance
    // We use YYYY-MM-DDTHH:mm to avoid duplicate sends in the same minute
    const getRefDate = (targetDate: Date) => targetDate.toISOString().substring(0, 16);

    // ─── 1. Tasks due ───
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, company_id, due_date")
      .lte("due_date", maxFuture.toISOString())
      .neq("status", "done");

    if (tasks) {
      for (const task of tasks) {
        if (!task.assignee_id || !task.due_date) continue;
        const minutesBefore = getPref(task.assignee_id, task.company_id, 'routines', 'task_deadline') ?? 0;
        if (minutesBefore < 0) continue; // Disabled

        const dueDate = new Date(task.due_date);
        const targetTime = new Date(dueDate.getTime() - minutesBefore * 60 * 1000);
        
        // If target time has passed (or is right now) AND it's not super old (e.g., missed by a few hours)
        if (now >= targetTime && (now.getTime() - targetTime.getTime()) < 12 * 60 * 60 * 1000) {
          notifications.push({
            user_id: task.assignee_id,
            company_id: task.company_id,
            notification_type: "task_deadline",
            reference_id: task.id,
            reference_date: getRefDate(targetTime),
            title: "📋 Lembrete de Tarefa",
            body: `A tarefa "${task.title}" vence ${minutesBefore > 0 ? 'em breve' : 'agora'}.`,
            data: { type: "task_due", id: task.id, url: `/#/tasks?open=${task.id}` },
          });
        }
      }
    }

    // ─── 2. Events ───
    const { data: events } = await supabase
      .from("calendar_events")
      .select("id, title, participants, company_id, start_date")
      .lte("start_date", maxFuture.toISOString())
      .neq("status", "completed")
      .neq("status", "cancelled");

    if (events) {
      for (const event of events) {
        if (!event.start_date || !Array.isArray(event.participants)) continue;
        const eventDate = new Date(event.start_date);

        for (const userId of event.participants) {
          const minutesBefore = getPref(userId, event.company_id, 'routines', 'event_start') ?? 0;
          if (minutesBefore < 0) continue;

          const targetTime = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);
          if (now >= targetTime && (now.getTime() - targetTime.getTime()) < 12 * 60 * 60 * 1000) {
            notifications.push({
              user_id: userId,
              company_id: event.company_id,
              notification_type: "event_start",
              reference_id: event.id,
              reference_date: getRefDate(targetTime),
              title: "📅 Compromisso Agendado",
              body: `O evento "${event.title}" começa ${minutesBefore > 0 ? 'em breve' : 'agora'}.`,
              data: { type: "event_today", id: event.id, url: `/#/agenda?open=${event.id}` },
            });
          }
        }
      }
    }

    // ─── 3. Finance Due ───
    const { data: finance } = await supabase
      .from("financial_transactions")
      .select("id, description, company_id, date, type")
      .lte("date", maxFuture.toISOString())
      .eq("is_paid", false);

    if (finance) {
      // For finance, we need to notify users who have the preference enabled
      const { data: allProfiles } = await supabase.from("profiles").select("id, company_id");

      for (const txn of finance) {
        if (!txn.date) continue;
        const txnDate = new Date(txn.date);
        const evType = txn.type === 'expense' ? 'payable_due' : 'receivable_due';
        const profilesInCompany = allProfiles?.filter(p => p.company_id === txn.company_id) || [];

        for (const user of profilesInCompany) {
          const minutesBefore = getPref(user.id, txn.company_id, 'finance', evType) ?? 0;
          if (minutesBefore < 0) continue;

          const targetTime = new Date(txnDate.getTime() - minutesBefore * 60 * 1000);
          if (now >= targetTime && (now.getTime() - targetTime.getTime()) < 12 * 60 * 60 * 1000) {
            notifications.push({
              user_id: user.id,
              company_id: txn.company_id,
              notification_type: evType,
              reference_id: txn.id,
              reference_date: getRefDate(targetTime),
              title: `💰 Lembrete Financeiro (${txn.type === 'expense' ? 'A Pagar' : 'A Receber'})`,
              body: `Lançamento: ${txn.description}`,
              data: { type: "finance_due_today", id: txn.id, url: `/#/finance/transactions?open=${txn.id}` },
            });
          }
        }
      }
    }

    // ─── Send notifications with idempotency ───
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const notif of notifications) {
      // Check idempotency. Log constraint should catch duplicates,
      // but we use reference_date down to the minute to avoid duplicate sends for the SAME target time.
      const { error: logError } = await supabase
        .from("push_notification_log")
        .insert({
          user_id: notif.user_id,
          company_id: notif.company_id,
          notification_type: notif.notification_type,
          reference_id: notif.reference_id,
          reference_date: notif.reference_date, // unique constraint prevents duplicate
          status: "sent",
        });

      if (logError) {
        if (logError.code === "23505") {
          skipped++;
          continue;
        }
        failed++;
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", notif.user_id)
        .limit(1);

      if (!subs?.length) {
        skipped++;
        continue;
      }

      try {
        const pushRes = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: notif.user_id,
            title: notif.title,
            body: notif.body,
            data: notif.data,
          }),
        });

        if (pushRes.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
    }

    return new Response(JSON.stringify({ total: notifications.length, sent, skipped, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
