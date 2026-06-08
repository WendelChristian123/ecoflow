import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * push-cron Edge Function
 * 
 * Scheduled function that checks for items requiring notifications:
 * 1. Tasks due today (assigned to user)
 * 2. Tasks overdue (assigned to user) 
 * 3. Appointments/Events happening today (user is participant)
 * 4. Financial transactions due today (unpaid)
 * 
 * Idempotency: Uses push_notification_log with unique constraint to prevent duplicates.
 * 
 * Should be called via Supabase Cron (pg_cron) or external scheduler.
 * Uses service_role key — no user auth required.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  company_id: string;
  notification_type: string;
  reference_id: string;
  title: string;
  body: string;
  data: {
    type: string;
    id: string;
    url: string;
    tag: string;
  };
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

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const todayStart = `${todayStr}T00:00:00.000Z`;
    const todayEnd = `${todayStr}T23:59:59.999Z`;

    const notifications: NotificationPayload[] = [];

    // ─── 1. Tasks due today ───
    const { data: tasksDueToday } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, company_id")
      .gte("due_date", todayStart)
      .lte("due_date", todayEnd)
      .neq("status", "done");

    if (tasksDueToday) {
      for (const task of tasksDueToday) {
        if (!task.assignee_id) continue;
        notifications.push({
          user_id: task.assignee_id,
          company_id: task.company_id,
          notification_type: "task_due_today",
          reference_id: task.id,
          title: "📋 Sua tarefa vence hoje",
          body: task.title,
          data: {
            type: "task_due_today",
            id: task.id,
            url: `/#/tasks?open=${task.id}`,
            tag: `task-due-${task.id}`,
          },
        });
      }
    }

    // ─── 2. Tasks overdue ───
    const { data: tasksOverdue } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, company_id")
      .lt("due_date", todayStart)
      .neq("status", "done");

    if (tasksOverdue) {
      for (const task of tasksOverdue) {
        if (!task.assignee_id) continue;
        notifications.push({
          user_id: task.assignee_id,
          company_id: task.company_id,
          notification_type: "task_overdue",
          reference_id: task.id,
          title: "⚠️ Você tem tarefa em atraso",
          body: task.title,
          data: {
            type: "task_overdue",
            id: task.id,
            url: `/#/tasks?open=${task.id}`,
            tag: `task-overdue-${task.id}`,
          },
        });
      }
    }

    // ─── 3. Events today ───
    const { data: eventsToday } = await supabase
      .from("calendar_events")
      .select("id, title, participants, company_id")
      .gte("start_date", todayStart)
      .lte("start_date", todayEnd)
      .neq("status", "completed")
      .neq("status", "cancelled");

    if (eventsToday) {
      for (const event of eventsToday) {
        const participants = Array.isArray(event.participants) ? event.participants : [];
        for (const userId of participants) {
          notifications.push({
            user_id: userId,
            company_id: event.company_id,
            notification_type: "event_today",
            reference_id: event.id,
            title: "📅 Você tem compromisso hoje",
            body: event.title,
            data: {
              type: "event_today",
              id: event.id,
              url: `/#/agenda?open=${event.id}`,
              tag: `event-today-${event.id}`,
            },
          });
        }
      }
    }

    // ─── 4. Financial transactions due today (unpaid) ───
    const { data: financeDueToday } = await supabase
      .from("financial_transactions")
      .select("id, description, company_id")
      .gte("date", todayStart)
      .lte("date", todayEnd)
      .eq("is_paid", false);

    if (financeDueToday) {
      for (const txn of financeDueToday) {
        // Get all users in this company to notify
        const { data: companyUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", txn.company_id);

        if (companyUsers) {
          for (const user of companyUsers) {
            notifications.push({
              user_id: user.id,
              company_id: txn.company_id,
              notification_type: "finance_due_today",
              reference_id: txn.id,
              title: "💰 Seu lançamento vence hoje",
              body: txn.description,
              data: {
                type: "finance_due_today",
                id: txn.id,
                url: `/#/finance/transactions?open=${txn.id}`,
                tag: `finance-due-${txn.id}`,
              },
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
      // Check/insert into log (idempotency)
      const { error: logError } = await supabase
        .from("push_notification_log")
        .insert({
          user_id: notif.user_id,
          company_id: notif.company_id,
          notification_type: notif.notification_type,
          reference_id: notif.reference_id,
          reference_date: todayStr,
          status: "sent",
        });

      if (logError) {
        // Unique constraint violation = already sent today
        if (logError.code === "23505") {
          skipped++;
          continue;
        }
        console.error("Log insert error:", logError.message);
        failed++;
        continue;
      }

      // Check if user has push subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", notif.user_id)
        .limit(1);

      if (!subs?.length) {
        skipped++;
        continue;
      }

      // Call push-notify function
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
          const errText = await pushRes.text();
          console.error(`push-notify failed: ${pushRes.status} ${errText}`);
          failed++;
        }
      } catch (err) {
        console.error("push-notify call error:", err);
        failed++;
      }
    }

    const result = {
      total: notifications.length,
      sent,
      skipped,
      failed,
      date: todayStr,
    };

    console.log("push-cron result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("push-cron error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
