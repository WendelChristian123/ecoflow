import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

console.log("Hello from webhooks-asaas!");

serve(async (req) => {
    try {
        // 1. Validate Token
        const token = req.headers.get("asaas-access-token") || req.headers.get("x-asaas-access-token");
        if (token !== ASAAS_WEBHOOK_TOKEN) {
            return new Response("Unauthorized", { status: 401 });
        }

        const { event, payment, subscription } = await req.json();
        const eventId = payment?.id + "_" + event; // Simple ID generation if Asaas doesn't send unique event ID in header/body

        const supabase = createSupabaseAdmin();

        // 2. Idempotency Check
        const { data: existingEvent } = await supabase
            .from("asaas_events")
            .select("id")
            .eq("event_id", eventId)
            .maybeSingle();

        if (existingEvent) {
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 3. Log Event
        await supabase.from("asaas_events").insert({
            event_id: eventId,
            type: event,
            payload: { event, payment, subscription }
        });

        // 4. Process Events
        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
            // Handle Payment Confirmation
            // Find subscription by Asaas ID or External Reference if available
            let { data: sub } = await supabase
                .from("subscriptions")
                .select("*")
                .eq("asaas_subscription_id", payment.subscription)
                .single();

            if (sub) {
                // Update Subscription to Active
                // Calculate new period
                const cycleMonths = sub.cycle === 'monthly' ? 1 : sub.cycle === 'semiannual' ? 6 : 12;
                const startDate = new Date(payment.paymentDate || payment.confirmedDate || new Date()); // Use confirmation date
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + cycleMonths);

                await supabase
                    .from("subscriptions")
                    .update({
                        status: 'active',
                        current_period_start: startDate.toISOString(),
                        current_period_end: endDate.toISOString(),
                        access_until: endDate.toISOString(),
                        last_asaas_event_at: new Date().toISOString()
                    })
                    .eq("id", sub.id);

                // Update/Create Payment Record
                // Upsert payment
                await supabase
                    .from("payments")
                    .upsert({
                        asaas_payment_id: payment.id,
                        subscription_id: sub.id,
                        company_id: sub.company_id,
                        billing_type: payment.billingType === 'PIX' ? 'pix' : 'credit_card',
                        amount: payment.value,
                        status: 'confirmed',
                        paid_at: startDate.toISOString(),
                        due_date: payment.dueDate,
                        invoice_url: payment.invoiceUrl
                    }, { onConflict: 'asaas_payment_id' });
            }
        }
        else if (event === "PAYMENT_OVERDUE") {
            // Handle Overdue
            await supabase
                .from("subscriptions")
                .update({ status: 'overdue', last_asaas_event_at: new Date().toISOString() })
                .eq("asaas_subscription_id", payment.subscription);

            await supabase
                .from("payments")
                .update({ status: 'overdue' })
                .eq("asaas_payment_id", payment.id);
        }
        else if (event === "PAYMENT_REFUNDED") {
            await supabase
                .from("payments")
                .update({ status: 'refunded' })
                .eq("asaas_payment_id", payment.id);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Webhook Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
});
