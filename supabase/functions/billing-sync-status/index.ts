import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AsaasClient } from "../_shared/asaas.ts";
import { createSupabaseClient, corsHeaders } from "../_shared/supabase.ts";

console.log("Hello from billing-sync-status!");

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

        // Get active subscription for user's company
        const { data: company } = await supabase
            .from("companies")
            .select("id")
            .eq("owner_user_id", user.id)
            .single();

        if (!company) throw new Error("Company not found");

        const { data: sub } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("company_id", company.id)
            .single();

        if (!sub || !sub.asaas_subscription_id) throw new Error("No active subscription linked to Asaas");

        // Poll Asaas
        const asaas = new AsaasClient();
        const asaasSub = await asaas.getSubscription(sub.asaas_subscription_id);

        // Minimal Sync Logic (Status)
        // Map Asaas status to local
        let localStatus = sub.status;
        if (asaasSub.status === 'ACTIVE') localStatus = 'active';
        else if (asaasSub.status === 'EXPIRED') localStatus = 'overdue'; // or canceled depending on logic
        else if (asaasSub.status === 'OVERDUE') localStatus = 'overdue';
        else if (asaasSub.status === 'RECEIVED') localStatus = 'active'; // Sometimes shows as received momentarily?
        else if (asaasSub.status === 'INACTIVE') localStatus = 'canceled';

        // Only update if changed
        if (localStatus !== sub.status) {
            await supabase
                .from("subscriptions")
                .update({
                    status: localStatus,
                    last_asaas_event_at: new Date().toISOString()
                })
                .eq("id", sub.id);
        }

        return new Response(JSON.stringify({
            local_status: localStatus,
            asaas_status: asaasSub.status,
            synced: true
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
