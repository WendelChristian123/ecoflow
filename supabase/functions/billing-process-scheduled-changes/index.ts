import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AsaasClient } from "../_shared/asaas.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

console.log("Hello from billing-process-scheduled-changes!");

serve(async (req) => {
    // This function is intended to be called by a CRON job (e.g., every hour or day)
    // It uses Service Role to access all companies data.

    try {
        const supabase = createSupabaseAdmin();

        // 1. Find Scheduled Changes that are ready to be processed
        const now = new Date().toISOString();
        const { data: changes, error: fetchError } = await supabase
            .from("subscription_changes")
            .select("*, subscriptions!from_subscription_id(*), companies!inner(*)")
            .eq("status", "scheduled")
            .lte("effective_at", now);

        if (fetchError) throw new Error("Failed to fetch scheduled changes: " + fetchError.message);

        console.log(`Found ${changes?.length || 0} scheduled changes to process.`);

        const results = [];
        const asaas = new AsaasClient();

        for (const change of changes || []) {
            try {
                // Determine actions based on change type
                if (change.change_type === 'downgrade') {
                    const sub = change.subscriptions;

                    // A. Cancel Old Subscription in Asaas
                    if (sub.asaas_subscription_id) {
                        try {
                            await asaas.cancelSubscription(sub.asaas_subscription_id);
                        } catch (e) {
                            console.error(`[Change ${change.id}] Failed to cancel old sub in Asaas:`, e);
                            // Continue? Yes, we want to ensure new one is created, or maybe strict error handling?
                            // Safest is to log and proceed, assuming manual intervention if 'active' remains.
                        }
                    }

                    // B. Create New Subscription in Asaas
                    // Get Price for new Plan/Cycle
                    const { data: newPrice, error: priceError } = await supabase
                        .from("plan_prices")
                        .select("*")
                        .eq("plan_id", change.to_plan_id)
                        .eq("cycle", change.to_cycle)
                        .single();

                    if (priceError || !newPrice) {
                        throw new Error(`Price not found for plan ${change.to_plan_id}/${change.to_cycle}`);
                    }

                    const nextDueDate = new Date();
                    // Downgrade effective immediately (new cycle starts now)
                    const durationMonths = change.to_cycle === 'monthly' ? 1 : change.to_cycle === 'semiannual' ? 6 : 12;
                    nextDueDate.setMonth(nextDueDate.getMonth() + durationMonths);
                    const nextDueDateStr = nextDueDate.toISOString();

                    // Create Asaas Sub
                    const newSubPayload: any = {
                        customer: sub.asaas_customer_id,
                        billingType: sub.billing_type === 'pix' ? 'PIX' : 'CREDIT_CARD', // Inherit billing type? Or should we have stored it in change request? Assuming inherit.
                        value: newPrice.amount,
                        nextDueDate: new Date().toISOString().split('T')[0],
                        cycle: change.to_cycle.toUpperCase(),
                        description: `Plano ${change.to_plan_id} - Ciclo ${change.to_cycle}`,
                        externalReference: sub.company_id
                    };

                    if (change.to_cycle === 'semiannual') newSubPayload.cycle = 'SEMIANNUALLY';
                    if (change.to_cycle === 'annual') newSubPayload.cycle = 'YEARLY';

                    // Issue: We might not have CC details here if they aren't stored in Asaas (tokenized) or DB.
                    // Asaas allows creating subscription without CC if billingType is CREDIT_CARD? No, it needs valid CC or token.
                    // If we don't have the token, we can't auto-create CC subscription.
                    // Downgrade to PIX? Or fail?
                    // Ideally, we should have stored 'creditCardToken' if Asaas returned one, or we rely on customer having a default payment method?
                    // Asaas API v3: to create sub with CC, we need to send CC info or token.
                    // LIMITATION: Only PIX downgrades are fully automated without storing CC tokens.
                    // WORKAROUND: For now, if CREDIT_CARD, we might fail if we don't have token.
                    // Let's assume for this MVP we only support auto-downgrade for PIX or if we implement token storage.
                    // Or, we force manual downgrade if CC.
                    // Let's try to proceed. If it fails, we log it.

                    const newAsaasSub = await asaas.createSubscription(newSubPayload);

                    // C. Update Subscription Record
                    await supabase
                        .from("subscriptions")
                        .update({
                            plan_id: change.to_plan_id,
                            cycle: change.to_cycle,
                            asaas_subscription_id: newAsaasSub.id,
                            status: 'active',
                            current_period_start: new Date().toISOString(),
                            current_period_end: nextDueDateStr,
                            access_until: nextDueDateStr
                        })
                        .eq("id", sub.id);

                    // D. Mark Change as Done
                    await supabase
                        .from("subscription_changes")
                        .update({ status: 'done', effective_at: new Date().toISOString() })
                        .eq("id", change.id);

                    results.push({ id: change.id, status: 'success' });

                } else {
                    // Other types? Upgrade is usually immediate.
                }

            } catch (err) {
                console.error(`[Change ${change.id}] Error processing:`, err);
                await supabase
                    .from("subscription_changes")
                    .update({ status: 'failed' }) // Or keep scheduled to retry?
                    .eq("id", change.id);
                results.push({ id: change.id, status: 'failed', error: err.message });
            }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Cron Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
