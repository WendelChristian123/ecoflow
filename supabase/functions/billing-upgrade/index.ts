import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AsaasClient } from "../_shared/asaas.ts";
import { createSupabaseClient, corsHeaders, sanitizeNumbers } from "../_shared/supabase.ts";

console.log("Hello from billing-upgrade!");

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

        const {
            subscription_id,
            to_plan_id,
            to_cycle,
            billing_type,
            credit_card
        } = await req.json();

        // 1. Verify Subscription & Ownership
        const { data: sub, error: subError } = await supabase
            .from("subscriptions")
            .select("*, companies!inner(*), plan_prices!inner(*)")
            .eq("id", subscription_id)
            .eq("companies.owner_user_id", user.id)
            .single();

        if (subError || !sub) throw new Error("Subscription not found");

        // 2. Get New Plan Price
        const { data: newPrice, error: priceError } = await supabase
            .from("plan_prices")
            .select("*")
            .eq("plan_id", to_plan_id)
            .eq("cycle", to_cycle)
            .single();

        if (priceError || !newPrice) throw new Error("Invalid target plan/cycle");

        // 3. Proration Calculation
        const now = new Date();
        const currentEnd = new Date(sub.current_period_end);
        const currentStart = new Date(sub.current_period_start);

        if (isNaN(currentEnd.getTime()) || isNaN(currentStart.getTime())) {
            throw new Error("Invalid subscription period dates");
        }

        const totalDurationMs = currentEnd.getTime() - currentStart.getTime();
        const remainingMs = Math.max(0, currentEnd.getTime() - now.getTime());

        // Ratio of unused time
        const unusedRatio = totalDurationMs > 0 ? remainingMs / totalDurationMs : 0;

        const currentPlanPrice = sub.plan_prices.amount;
        const creditUnused = currentPlanPrice * unusedRatio;

        // New Price
        const newPlanAmount = newPrice.amount;

        // Charge = Difference
        let charge = newPlanAmount - creditUnused;
        charge = Math.max(0, parseFloat(charge.toFixed(2))); // Round to 2 decimals

        const asaas = new AsaasClient();
        let paymentData = null;

        if (charge > 0) {
            // Create One-Time Charge
            const paymentPayload: any = {
                customer: sub.asaas_customer_id,
                billingType: billing_type === 'pix' ? 'PIX' : 'CREDIT_CARD',
                value: charge,
                dueDate: new Date().toISOString().split('T')[0], // Due Today
                description: `Upgrade para ${to_plan_id} (${to_cycle}) - Proporcional`,
                externalReference: `UPGRADE_${sub.id}_${to_plan_id}_${to_cycle}`
            };

            if (billing_type === 'credit_card' && credit_card) {
                paymentPayload.creditCard = {
                    holderName: credit_card.holderName,
                    number: credit_card.number,
                    expiryMonth: credit_card.expiryMonth,
                    expiryYear: credit_card.expiryYear,
                    ccv: credit_card.ccv,
                };
                paymentPayload.creditCardHolderInfo = {
                    name: credit_card.holderName,
                    email: sub.companies.email,
                    cpfCnpj: sanitizeNumbers(sub.companies.cpf_cnpj),
                    postalCode: "00000000",
                    addressNumber: "0",
                    phone: sanitizeNumbers(sub.companies.whatsapp),
                };
            }

            try {
                paymentData = await asaas.createPayment(paymentPayload);
            } catch (e) {
                throw new Error("Failed to create upgrade charge: " + e.message);
            }
        }

        // 4. Log Subscription Change
        const status = charge > 0 ? 'processing' : 'done';

        const { data: changeLog, error: logError } = await supabase
            .from("subscription_changes")
            .insert({
                company_id: sub.company_id,
                from_subscription_id: sub.id,
                to_plan_id: to_plan_id,
                to_cycle: to_cycle,
                change_type: 'upgrade',
                proration_amount: charge,
                effective_at: new Date().toISOString(),
                status: status,
                asaas_payment_id: paymentData?.id
            })
            .select()
            .single();

        if (logError) throw new Error("Failed to log subscription change");

        // Immediate Upgrade if No Charge (or extremely small)
        if (charge <= 0) {
            // 1. Cancel Old Subscription in Asaas
            await asaas.cancelSubscription(sub.asaas_subscription_id);

            // 2. Create New Subscription in Asaas
            const nextDueDate = new Date();
            // Determine duration based on new cycle for access_until
            const durationMonths = to_cycle === 'monthly' ? 1 : to_cycle === 'semiannual' ? 6 : 12;
            nextDueDate.setMonth(nextDueDate.getMonth() + durationMonths);

            const newSubPayload: any = {
                customer: sub.asaas_customer_id,
                billingType: billing_type === 'pix' ? 'PIX' : 'CREDIT_CARD',
                value: newPrice.amount,
                nextDueDate: new Date().toISOString().split('T')[0],
                cycle: to_cycle.toUpperCase(),
                description: `Plano ${to_plan_id} - Ciclo ${to_cycle}`,
                externalReference: sub.company_id
            };

            if (to_cycle === 'semiannual') newSubPayload.cycle = 'SEMIANNUALLY';
            if (to_cycle === 'annual') newSubPayload.cycle = 'YEARLY';

            if (billing_type === 'credit_card' && credit_card) {
                newSubPayload.creditCard = {
                    holderName: credit_card.holderName,
                    number: credit_card.number,
                    expiryMonth: credit_card.expiryMonth,
                    expiryYear: credit_card.expiryYear,
                    ccv: credit_card.ccv,
                };
                newSubPayload.creditCardHolderInfo = {
                    name: credit_card.holderName,
                    email: sub.companies.email,
                    cpfCnpj: sanitizeNumbers(sub.companies.cpf_cnpj),
                    postalCode: "00000000",
                    addressNumber: "0",
                    phone: sanitizeNumbers(sub.companies.whatsapp),
                };
            }

            const newAsaasSub = await asaas.createSubscription(newSubPayload);

            // 3. Update Local Subscription
            await supabase
                .from("subscriptions")
                .update({
                    plan_id: to_plan_id,
                    cycle: to_cycle,
                    asaas_subscription_id: newAsaasSub.id,
                    status: 'active',
                    current_period_start: new Date().toISOString(),
                    current_period_end: nextDueDate.toISOString(),
                    access_until: nextDueDate.toISOString()
                })
                .eq("id", sub.id);
        }

        // Return Payment Info if Charge exists
        let pixInfo = null;
        if (charge > 0 && billing_type === 'pix' && paymentData) {
            const qrCode = await asaas.getPixQrCode(paymentData.id);
            pixInfo = {
                encodedImage: qrCode.encodedImage,
                payload: qrCode.payload,
                expirationDate: qrCode.expirationDate
            };
        }

        return new Response(JSON.stringify({
            change_id: changeLog.id,
            status: status,
            proration_amount: charge,
            pix: pixInfo,
            payment_id: paymentData?.id
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Upgrade error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
