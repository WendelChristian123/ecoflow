import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache the application server instance
let appServerPromise: Promise<webpush.ApplicationServer> | null = null;

function getAppServer(): Promise<webpush.ApplicationServer> {
  if (!appServerPromise) {
    appServerPromise = (async () => {
      const vapidKeysJson = Deno.env.get("VAPID_KEYS_JWK") ?? "{}";
      const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contazze@contazze.com";

      const exportedKeys = JSON.parse(vapidKeysJson);

      const vapidKeys = await webpush.importVapidKeys(exportedKeys, {
        extractable: false,
      });

      return webpush.ApplicationServer.new({
        contactInformation: vapidSubject,
        vapidKeys,
      });
    })();
  }
  return appServerPromise;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, title, body: notifBody, data } = body;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "Missing user_id or title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError || !subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get application server
    const appServer = await getAppServer();

    const payload = JSON.stringify({ title, body: notifBody, data });
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];
    const errors: any[] = [];

    for (const sub of subscriptions) {
      try {
        // Create subscriber from subscription data
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        });

        // Send push notification with urgency: high to trigger Heads-Up notifications
        // on Android devices.
        await subscriber.pushTextMessage(payload, { urgency: "high" });
        sent++;
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error(`Push error for ${sub.endpoint}:`, errMsg);

        // Check if subscription is expired (410 Gone or 404)
        if (errMsg.includes("410") || errMsg.includes("404") || errMsg.includes("expired") || errMsg.includes("Gone")) {
          expiredEndpoints.push(sub.endpoint);
        }
        failed++;
        errors.push(errMsg);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      console.log(`Removed ${expiredEndpoints.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({ sent, failed, expired: expiredEndpoints.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("push-notify error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
