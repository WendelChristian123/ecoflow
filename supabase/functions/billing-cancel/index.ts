import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AsaasClient } from "../_shared/asaas.ts";
import { createSupabaseClient, corsHeaders } from "../_shared/supabase.ts";

console.log("Hello from billing-cancel!");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createSupabaseClient(req);
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Unauthorized");

        const { subscription_id } = await req.json();

        if (!subscription_id) throw new Error("Missing subscription_id");

        // 1. Get Subscription and Verify Ownership
        const { data: sub, error: subError } = await supabase
            .from("subscriptions")
            .select("*, companies!inner(owner_user_id)")
            .eq("id", subscription_id)
            .eq("companies.owner_user_id", user.id)
            .single();

        if (subError || !sub) throw new Error("Subscription not found or unauthorized");

        if (sub.status === 'canceled' || sub.status === 'cancel_requested') {
            throw new Error("Subscription already canceled or cancellation requested");
        }

        // 2. Cancel in Asaas
        const asaas = new AsaasClient();
        try {
            await asaas.cancelSubscription(sub.asaas_subscription_id);
        } catch (e) {
            console.error("Failed to cancel in Asaas:", e);
            // We might want to continue to mark it locally even if Asaas fails (e.g., if already canceled there)
            // ideally logic should be robust enough to handle "already canceled" response from Asaas gracefully
        }

        // 3. Update Local Subscription
        // access_until remains as is (end of current period)
        const { data: updatedSub, error: updateError } = await supabase
            .from("subscriptions")
            .update({
                status: 'cancel_requested',
                cancel_at_period_end: true,
                canceled_at: new Date().toISOString()
            })
            .eq("id", subscription_id)
            .select()
            .single();

        if (updateError) throw new Error("Failed to update subscription status");

        return new Response(JSON.stringify({
            status: updatedSub.status,
            access_until: updatedSub.access_until
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
