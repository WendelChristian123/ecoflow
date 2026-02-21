
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // 0. HANDLE OPTIONS
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    console.log(`[V10] Request Method: ${req.method}`);

    try {
        // 1. VALIDATE PAYLOAD
        let body;
        try {
            body = await req.json();
            console.log("[V10] Payload received:", JSON.stringify(body));
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                type: "validation_error",
                message: "Invalid JSON body"
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        const { name, ownerEmail, adminName, planId, modules = [], cnpj, phone, subscriptionStart, subscriptionEnd } = body;
        let { password } = body;

        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!ownerEmail) missingFields.push('ownerEmail');
        if (!adminName) missingFields.push('adminName');
        // if (!cnpj) missingFields.push('cnpj'); // Optional?

        if (missingFields.length > 0) {
            console.error(`[V10][VALIDATION] Missing fields: ${missingFields.join(', ')}`);
            return new Response(JSON.stringify({
                success: false,
                type: "validation_error",
                message: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        if (!password) {
            password = "EcoFlow@2024";
            console.log("[V10] Using default password");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        let createdUserId = null;
        let createdTenantId = null;
        let authUser = null;

        // 2. CREATE AUTH USER
        try {
            console.log(`[V10] Creating Auth User: ${ownerEmail}`);
            const { data: createdData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: ownerEmail,
                password: password,
                email_confirm: true,
                user_metadata: { name: adminName }
            });

            if (authError) {
                console.error(`[V10][AUTH_FAIL] ${authError.message}`);
                // Simple Orphan Logic
                if (authError.message.includes("already registered")) {
                    return new Response(JSON.stringify({
                        success: false,
                        type: "validation_error",
                        message: "Este email já está cadastrado no sistema."
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
                }
                throw authError;
            }
            authUser = createdData;
            createdUserId = authUser.user.id;
            console.log(`[V10] User created: ${createdUserId}`);

        } catch (error: any) {
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: error.message || "Erro ao criar usuário"
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 3. CREATE COMPANY (TENANT)
        try {
            console.log(`[V10] Creating Company for user: ${createdUserId}`);
            const { data: newCompany, error: companyError } = await supabaseAdmin
                .from('companies')
                .insert({
                    owner_user_id: createdUserId,
                    name: name,
                    cnpj: cnpj,
                    phone: phone,
                    email: ownerEmail,
                    owner_email: ownerEmail,
                    admin_name: adminName,
                    status: 'active',
                    type: 'client',
                    financial_status: 'ok',
                    settings: { calendar: {} }
                })
                .select()
                .single();

            if (companyError) {
                console.error(`[V10][COMPANY_FAIL] ${companyError.message}`);
                throw new Error(`Erro ao criar empresa: ${companyError.message}`);
            }
            createdTenantId = newCompany.id;
            console.log(`[V10] Company created: ${createdTenantId}`);

        } catch (error: any) {
            // ROLLBACK USER
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: error.message
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 4. CREATE SUBSCRIPTION
        try {
            if (planId) {
                console.log(`[V10] Creating Subscription: Plan ${planId}`);
                const { error: subError } = await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        company_id: createdTenantId,
                        plan_id: planId,
                        status: 'active',
                        current_period_start: subscriptionStart || new Date(),
                        current_period_end: subscriptionEnd,
                        access_until: subscriptionEnd,
                        cycle: 'monthly'
                    });

                if (subError) throw subError;
            }
        } catch (error: any) {
            console.error(`[V10][SUB_FAIL] ${error.message}`);
            // Non-fatal? Or Rollback? Let's treat as fatal for consistency
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            if (createdTenantId) await supabaseAdmin.from('companies').delete().eq('id', createdTenantId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: `Erro ao criar assinatura: ${error.message}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 5. INSERT MODULES
        try {
            if (modules && modules.length > 0) {
                console.log(`[V10] Inserting Modules: ${modules.length}`);

                // Process and Deduplicate
                const uniqueModules = new Map();

                modules.forEach((m: string) => {
                    const parts = m.split(':');
                    let modId = parts[0];
                    const type = parts[1] === 'extra' ? 'extra' : 'included';

                    if (modId === 'mod_tasks') modId = 'routines';
                    if (modId === 'mod_finance') modId = 'finance';
                    if (modId === 'mod_commercial') modId = 'commercial';

                    // Use Map to ensure uniqueness by modId
                    // If duplicate, last one wins (or first? Here we just take the last config)
                    uniqueModules.set(modId, {
                        company_id: createdTenantId,
                        module_id: modId,
                        status: 'active',
                        config: { type }
                    });
                });

                const companyModules = Array.from(uniqueModules.values());
                console.log(`[V10] Unique Modules to Insert: ${companyModules.length}`);

                const { error: modError } = await supabaseAdmin.from('company_modules').insert(companyModules);
                if (modError) throw modError;
            }
        } catch (error: any) {
            console.error(`[V10][MODULE_FAIL] ${error.message}`);
            // Rollback everything
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            if (createdTenantId) await supabaseAdmin.from('companies').delete().eq('id', createdTenantId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: `Erro ao configurar módulos: ${error.message}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 6. LINK PROFILE (Retry Loop)
        try {
            let profileLinked = false;
            let lastError = null;
            const adminPerms = {
                routines: { view: true, edit: true, create: true },
                finance: { view: true, edit: true, create: true },
                commercial: { view: true, edit: true, create: true },
                reports: { view: true }
            };

            for (let i = 0; i < 3; i++) {
                console.log(`[V10][PROFILE] Link Attempt ${i + 1}`);
                const { error: upsertError } = await supabaseAdmin
                    .from('profiles')
                    .upsert({
                        id: createdUserId,
                        company_id: createdTenantId,
                        role: 'admin',
                        name: adminName,
                        email: ownerEmail,
                        phone: phone,
                        permissions: adminPerms
                    });

                if (!upsertError) {
                    profileLinked = true;
                    break;
                }
                lastError = upsertError;
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!profileLinked) throw lastError;

        } catch (error: any) {
            console.error(`[V10][PROFILE_FAIL] ${error.message}`);
            // Rollback? If profile fails, user is created but can't access. 
            // Better to rollback to avoid phantom users.
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            if (createdTenantId) await supabaseAdmin.from('companies').delete().eq('id', createdTenantId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: `Erro ao vincular perfil: ${error.message}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 7. SUCCESS
        console.log(`[V10] Success! Tenant ID: ${createdTenantId}`);
        return new Response(JSON.stringify({
            success: true,
            data: {
                tenantId: createdTenantId,
                userId: createdUserId
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });

    } catch (error: any) {
        console.error(`[V10][UNHANDLED_FATAL] ${error.message}`);
        return new Response(JSON.stringify({
            success: false,
            type: "internal_error",
            message: `Erro interno não tratado: ${error.message}`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
