
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    console.log(`[AUTH-SIGNUP] Request Method: ${req.method}`);

    try {
        // 1. VALIDATE PAYLOAD
        let body;
        try {
            body = await req.json();
            console.log("[AUTH-SIGNUP] Payload received:", JSON.stringify({ ...body, password: '***' }));
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                type: "validation_error",
                message: "Invalid JSON body"
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        const { email, password, legal_name, cpf_cnpj, whatsapp, plan_id } = body;

        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!password) missingFields.push('password');
        if (!legal_name) missingFields.push('legal_name');
        if (!cpf_cnpj) missingFields.push('cpf_cnpj');

        if (missingFields.length > 0) {
            console.error(`[AUTH-SIGNUP][VALIDATION] Missing fields: ${missingFields.join(', ')}`);
            return new Response(JSON.stringify({
                success: false,
                type: "validation_error",
                message: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        const cleanCpfCnpj = cpf_cnpj.replace(/\D/g, "");
        const formattedWhatsapp = whatsapp ? whatsapp.replace(/\D/g, "") : "";

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 2. CHECK DUPLICATES
        const { data: existingCompany } = await supabaseAdmin
            .from("companies")
            .select("id")
            .or(`email.eq.${email},cpf_cnpj.eq.${cleanCpfCnpj}`)
            .maybeSingle();

        if (existingCompany) {
            return new Response(JSON.stringify({
                success: false,
                type: "validation_error",
                message: "Empresa ou e-mail já cadastrado"
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        let createdUserId = null;
        let createdTenantId = null;

        // 3. CREATE AUTH USER
        try {
            console.log(`[AUTH-SIGNUP] Creating user: ${email}`);
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true, // Auto-confirm for trial
                user_metadata: { legal_name, whatsapp: formattedWhatsapp }
            });

            if (authError) throw authError;
            createdUserId = authUser.user.id;

        } catch (error: any) {
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: error.message || "Erro ao criar usuário"
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 4. CREATE COMPANY
        try {
            console.log(`[AUTH-SIGNUP] Creating company for user: ${createdUserId}`);
            const { data: newCompany, error: compError } = await supabaseAdmin
                .from("companies")
                .insert({
                    owner_user_id: createdUserId,
                    legal_name,
                    cpf_cnpj: cleanCpfCnpj,
                    whatsapp: formattedWhatsapp,
                    email,
                    owner_email: email,
                    admin_name: legal_name,
                    status: 'active',
                    type: 'trial',
                    financial_status: 'ok',
                    settings: { calendar: {} }
                })
                .select()
                .single();

            if (compError) throw compError;
            createdTenantId = newCompany.id;

        } catch (error: any) {
            // Rollback User
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: `Erro ao criar empresa: ${error.message}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 5. INSERT DEFAULT MODULES (Standard PRO Trial)
        try {
            console.log(`[AUTH-SIGNUP] Inserting default modules for ${createdTenantId}`);
            // Default modules for trial: All main modules included
            const modulesToInsert = [
                { company_id: createdTenantId, module_id: 'routines', status: 'active', config: { type: 'included' } },
                { company_id: createdTenantId, module_id: 'finance', status: 'active', config: { type: 'included' } },
                { company_id: createdTenantId, module_id: 'commercial', status: 'active', config: { type: 'included' } },
                { company_id: createdTenantId, module_id: 'reports', status: 'active', config: { type: 'included' } }
            ];

            const { error: modError } = await supabaseAdmin.from('company_modules').insert(modulesToInsert);
            if (modError) throw modError;

        } catch (error: any) {
            console.error(`[AUTH-SIGNUP] Module Error: ${error.message}`);
            // Rollback everything
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            if (createdTenantId) await supabaseAdmin.from('companies').delete().eq('id', createdTenantId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: `Erro ao configurar módulos: ${error.message}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 6. CREATE TRIAL SUBSCRIPTION
        try {
            const now = new Date();
            const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const { error: subError } = await supabaseAdmin
                .from("subscriptions")
                .insert({
                    company_id: createdTenantId,
                    status: 'trialing',
                    trial_ends_at: trialEnds.toISOString(),
                    current_period_start: now.toISOString(),
                    current_period_end: trialEnds.toISOString(),
                    access_until: trialEnds.toISOString(),
                    plan_id: plan_id || null, // Ensure plan_id is valid UUID if provided
                    cycle: 'monthly'
                });

            if (subError) throw subError;

        } catch (error: any) {
            console.error(`[AUTH-SIGNUP] Subscription Error: ${error.message}`);
            if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            if (createdTenantId) await supabaseAdmin.from('companies').delete().eq('id', createdTenantId);
            return new Response(JSON.stringify({
                success: false,
                type: "internal_error",
                message: `Erro ao criar assinatura: ${error.message}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

        // 7. SETUP USER METADATA & PROFILE
        try {
            // Update Auth Metadata
            await supabaseAdmin.auth.admin.updateUserById(createdUserId, {
                user_metadata: {
                    companyId: createdTenantId, // Changed from tenantId
                    legal_name,
                    whatsapp: formattedWhatsapp
                }
            });

            // Create Profile
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: createdUserId,
                    company_id: createdTenantId, // Changed from tenant_id
                    name: legal_name,
                    role: 'admin',
                    email: email,
                    phone: formattedWhatsapp
                });

            if (profileError) throw profileError;

        } catch (error: any) {
            console.error(`[AUTH-SIGNUP] Profile Error: ${error.message}`);
            // Non-fatal? Maybe fatal for consistency
        }

        // SUCCESS
        console.log(`[AUTH-SIGNUP] Success! Tenant ID: ${createdTenantId}`);
        return new Response(JSON.stringify({
            success: true,
            id: createdTenantId, // Legacy support for frontend expecting 'id'
            message: "Conta criada com sucesso!"
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });

    } catch (error: any) {
        console.error(`[AUTH-SIGNUP] Unhandled Error: ${error.message}`);
        return new Response(JSON.stringify({
            success: false,
            type: "internal_error",
            message: `Erro interno: ${error.message}`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
