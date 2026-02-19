import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient, corsHeaders } from "../_shared/supabase.ts";

console.log("Hello from billing-schedule-downgrade!");

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

        const { subscription_id, to_plan_id, to_cycle } = await req.json();

        // 1. Verify Ownership
        const { data: sub, error: subError } = await supabase
            .from("subscriptions")
            .select("*, companies!inner(owner_user_id)")
            .eq("id", subscription_id)
            .eq("companies.owner_user_id", user.id)
            .single();

        if (subError || !sub) throw new Error("Subscription not found");

        // 2. Schedule Change
        // Effective at current_period_end

        const { data: changeLog, error: logError } = await supabase
            .from("subscription_changes")
            .insert({
                company_id: sub.company_id,
                from_subscription_id: sub.id,
                to_plan_id: to_plan_id,
                to_cycle: to_cycle,
                change_type: 'downgrade',
                effective_at: sub.current_period_end, // End of current cycle
                status: 'scheduled'
            })
            .select()
            .single();

        if (logError) throw new Error("Failed to schedule downgrade: " + logError.message);

        return new Response(JSON.stringify({
            change_id: changeLog.id,
            status: 'scheduled',
            effective_at: changeLog.effective_at
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
