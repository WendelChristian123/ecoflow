import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AsaasClient, AsaasCustomer } from "../_shared/asaas.ts";
import { createSupabaseClient, corsHeaders, validateCpfCnpj, sanitizeNumbers } from "../_shared/supabase.ts";

console.log("Hello from billing-checkout!");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createSupabaseClient(req);
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        const {
            company, // legal_name, cpf_cnpj, whatsapp, email
            address, // postal_code, address, address_number, complement, province, city, state
            plan_id,
            cycle,
            billing_type,
            credit_card,
        } = await req.json();

        // 1. Validate Input
        if (!company.legal_name || !company.cpf_cnpj || !company.email) throw new Error("Missing company info");
        if (!validateCpfCnpj(company.cpf_cnpj)) throw new Error("Invalid CPF/CNPJ");

        // 2. Get Plan Price (Server-Side Validation)
        const { data: priceData, error: priceError } = await supabase
            .from("plan_prices")
            .select("*")
            .eq("plan_id", plan_id)
            .eq("cycle", cycle)
            .single();

        if (priceError || !priceData) throw new Error("Invalid plan or cycle");

        // 3. Create/Get Company & Address in DB
        // Check if company already exists for this user (one company per user rule)
        let { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("*")
            .eq("owner_user_id", user.id)
            .maybeSingle();

        if (!companyData) {
            const { data: newCompany, error: createError } = await supabase
                .from("companies")
                .insert({
                    owner_user_id: user.id,
                    legal_name: company.legal_name,
                    cpf_cnpj: sanitizeNumbers(company.cpf_cnpj),
                    whatsapp: sanitizeNumbers(company.whatsapp),
                    email: company.email,
                })
                .select()
                .single();

            if (createError) throw new Error("Failed to create company: " + createError.message);
            companyData = newCompany;
        }

        // 4. Create/Get Customer in Asaas
        const asaas = new AsaasClient();
        const asaasCustomer = await asaas.createCustomer({
            name: company.legal_name,
            cpfCnpj: sanitizeNumbers(company.cpf_cnpj),
            email: company.email,
            mobilePhone: sanitizeNumbers(company.whatsapp),
            externalReference: companyData.id,
            notificationDisabled: false,
        });

        if (!asaasCustomer.id) throw new Error("Failed to create customer in Asaas");

        // 5. Create Subscription in Asaas
        // Trial logic: nextDueDate = now + 7 days
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + 7);
        const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

        const subscriptionPayload: any = {
            customer: asaasCustomer.id,
            billingType: billing_type === 'pix' ? 'PIX' : 'CREDIT_CARD',
            value: priceData.amount,
            nextDueDate: nextDueDateStr, // Trial ends here
            cycle: cycle.toUpperCase(), // MONTHLY, SEMIANNUALLY, ANNUAL -> YEARLY
            description: `Plano ${plan_id} - Ciclo ${cycle}`,
            externalReference: companyData.id,
        };

        if (cycle === 'semiannual') subscriptionPayload.cycle = 'SEMIANNUALLY';
        if (cycle === 'annual') subscriptionPayload.cycle = 'YEARLY';

        if (billing_type === 'credit_card') {
            if (!credit_card) throw new Error("Missing credit card info");
            subscriptionPayload.creditCard = {
                holderName: credit_card.holderName,
                number: credit_card.number,
                expiryMonth: credit_card.expiryMonth,
                expiryYear: credit_card.expiryYear,
                ccv: credit_card.ccv,
            };
            subscriptionPayload.creditCardHolderInfo = {
                name: credit_card.holderName,
                email: company.email,
                cpfCnpj: sanitizeNumbers(company.cpf_cnpj),
                postalCode: sanitizeNumbers(address.postal_code),
                addressNumber: address.address_number,
                phone: sanitizeNumbers(company.whatsapp),
            };
        }

        let asaasSubscription;
        try {
            asaasSubscription = await asaas.createSubscription(subscriptionPayload);
        } catch (e) {
            // Handle specific Asaas errors (e.g., credit card invalid)
            throw e;
        }

        // 6. Save Subscription in DB (Status = trialing)
        const { data: subData, error: subError } = await supabase
            .from("subscriptions")
            .insert({
                company_id: companyData.id,
                plan_id: plan_id,
                cycle: cycle,
                billing_type: billing_type,
                status: 'trialing',
                trial_ends_at: nextDueDate.toISOString(),
                current_period_start: new Date().toISOString(),
                current_period_end: nextDueDate.toISOString(),
                access_until: nextDueDate.toISOString(),
                asaas_customer_id: asaasCustomer.id,
                asaas_subscription_id: asaasSubscription.id,
            })
            .select()
            .single();

        if (subError) {
            // Rollback: Cancel Asaas Subscription
            await asaas.cancelSubscription(asaasSubscription.id);
            throw new Error("Failed to save subscription: " + subError.message);
        }

        // 7. Handle PIX specifics (if needed immediately)
        // Asaas Subscriptions with PIX usually generate the first charge automatically.
        // We might need to fetch the pending payment to get the QR Code.
        let pixData = null;
        if (billing_type === 'pix') {
            // List payments for this subscription to find the pending one
            const payments = await asaas.request(`/subscriptions/${asaasSubscription.id}/payments`, "GET");
            const pendingPayment = payments.data?.find((p: any) => p.status === 'PENDING');

            if (pendingPayment) {
                const qrCode = await asaas.getPixQrCode(pendingPayment.id);
                pixData = {
                    paymentId: pendingPayment.id,
                    encodedImage: qrCode.encodedImage,
                    payload: qrCode.payload,
                    expirationDate: qrCode.expirationDate
                };

                // Save payment record
                await supabase.from("payments").insert({
                    subscription_id: subData.id,
                    company_id: companyData.id,
                    asaas_payment_id: pendingPayment.id,
                    billing_type: 'pix',
                    amount: pendingPayment.value,
                    status: 'pending',
                    due_date: pendingPayment.dueDate,
                    pix_qr_code: qrCode.encodedImage,
                    pix_copy_paste: qrCode.payload,
                    invoice_url: pendingPayment.invoiceUrl,
                });
            }
        }

        return new Response(JSON.stringify({
            subscription_id: subData.id,
            status: 'trialing',
            pix: pixData
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
