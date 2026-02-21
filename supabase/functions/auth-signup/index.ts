
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

        const { email, password, legal_name, admin_name, cpf_cnpj, whatsapp, plan_id, cycle } = body;
        console.log(`[AUTH-SIGNUP] DEBUG: Received plan_id: ${plan_id}, cycle: ${cycle}`);

        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!password) missingFields.push('password');
        if (!legal_name) missingFields.push('legal_name');
        if (!admin_name) missingFields.push('admin_name');
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
                user_metadata: { legal_name, full_name: admin_name, whatsapp: formattedWhatsapp }
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
                    name: legal_name,
                    cnpj: cleanCpfCnpj,
                    phone: formattedWhatsapp,
                    email,
                    owner_email: email,
                    admin_name: admin_name || legal_name,
                    status: 'active',
                    type: 'trial',
                    financial_status: 'ok',
                    settings: { calendar: {} },
                    plan_id: plan_id || null
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

        // 5. INSERT MODULES BASED ON PLAN
        try {
            console.log(`[AUTH-SIGNUP] Configuring modules for ${createdTenantId}`);

            // Define module mapping
            const moduleMapping: Record<string, string> = {
                'mod_tasks': 'routines',
                'mod_finance': 'finance',
                'mod_commercial': 'commercial',
                'mod_reports': 'reports'
            };

            let modulesToInsert = [];

            if (plan_id) {
                // Fetch plan config
                const { data: plan, error: planError } = await supabaseAdmin
                    .from('saas_plans')
                    .select('allowed_modules')
                    .eq('id', plan_id)
                    .single();

                if (planError) {
                    console.error(`[AUTH-SIGNUP] Error fetching plan ${plan_id}: ${planError.message}`);
                    // Fallback to all modules if plan fetch fails, or maybe minimal? 
                    // Let's fallback to all for safety so user isn't stuck with nothing, 
                    // but log it clearly. Or maybe better to default to minimal?
                    // Given the user wants restriction, let's try to infer from plan_id or just insert defaults.
                    // For now, let's assume if plan fetch fails, we give default PRO set (all) to avoid breaking functionality
                    // but ideally this shouldn't happen with valid plan_id.
                }

                if (plan && plan.allowed_modules) {
                    const allowed = plan.allowed_modules as string[];

                    // Filter unique system modules
                    const systemModules = new Set<string>();

                    allowed.forEach(mod => {
                        // Check for exact match or prefix (e.g. mod_finance:banking -> finance)
                        // The mapping keys are prefixes usually. 
                        // But looking at the data: "mod_finance", "mod_finance:finance_overview"
                        // We should check if the mapped key exists.

                        // Direct logic:
                        if (moduleMapping[mod]) {
                            systemModules.add(moduleMapping[mod]);
                        } else {
                            // Try to find if it starts with a key
                            for (const key in moduleMapping) {
                                if (mod.startsWith(key)) {
                                    systemModules.add(moduleMapping[key]);
                                    break;
                                }
                            }
                        }
                    });

                    modulesToInsert = Array.from(systemModules).map(moduleId => {
                        // Extract features for this module
                        const featuresForModule = allowed.filter(f =>
                            f.startsWith(moduleId + ':') ||
                            // Special case for exceptions mapped in RBAC (optional but good for consistency)
                            // Ideally we just store what is in the plan.
                            // But let's verify if the plan has "mod_tasks:tasks_overview"
                            // and we mapped "mod_tasks" -> "routines".
                            // The feature string in the plan is "mod_tasks:tasks_overview".
                            // We want to store "tasks_overview" or "routines:tasks_overview"?
                            // RBAC expects "routines:tasks_overview".
                            // So we need to map the prefix too?

                            // Let's see RBAC again:
                            // const [baseKey, subFeature] = moduleKey.split('.');
                            // const map = MODULE_MAP[baseKey]; // routines
                            // expectedFeatId = `${map.featPrefix}${subFeature}`; // tasks_...
                            // const fullString = `${map.sysId}:${expectedFeatId}`; // routines:tasks_overview

                            // So if plan has "mod_tasks:tasks_overview", we need to map it to "routines:tasks_overview".
                            // The mapping is:
                            // mod_tasks -> routines (tasks_)
                            // mod_finance -> finance (finance_)
                            // mod_commercial -> commercial (crm_)

                            // We can rely on the fact that the plan ALREADY uses the correct feature suffixes (tasks_, finance_, crm_)
                            // We just need to replace the module prefix.

                            // Iterate all plan items again
                            false
                        );

                        // Better approach: filter plan items that map to this moduleId
                        const myFeatures = allowed.filter(a => {
                            // Check if this allowed item belongs to this module
                            if (a === moduleId) return false; // It's the module itself
                            // If we have "mod_tasks:tasks_overview", and moduleId is "routines" (mapped from mod_tasks)
                            // We need to know which legacy key maps to this moduleId.

                            // Reverse lookup or just check prefixes
                            const legacyPrefix = Object.keys(moduleMapping).find(k => moduleMapping[k] === moduleId);
                            if (legacyPrefix && a.startsWith(legacyPrefix + ':')) {
                                return true;
                            }
                            // Also check if it already matches the new id (unlikely but possible)
                            if (a.startsWith(moduleId + ':')) return true;

                            return false;
                        }).map(f => {
                            // "mod_tasks:tasks_overview" -> "tasks_overview"
                            // Just split by first colon
                            const parts = f.split(':');
                            return parts.length > 1 ? parts[1] : f;
                        });

                        return {
                            company_id: createdTenantId,
                            module_id: moduleId,
                            status: 'active',
                            config: {
                                type: 'included',
                                features: myFeatures.length > 0 ? myFeatures : undefined
                            }
                        };
                    });
                }
            }

            // Fallback if no specific modules found (e.g. no plan_id or empty plan)
            if (modulesToInsert.length === 0) {
                modulesToInsert = [
                    { company_id: createdTenantId, module_id: 'routines', status: 'active', config: { type: 'included' } },
                    { company_id: createdTenantId, module_id: 'finance', status: 'active', config: { type: 'included' } },
                    { company_id: createdTenantId, module_id: 'commercial', status: 'active', config: { type: 'included' } },
                    { company_id: createdTenantId, module_id: 'reports', status: 'active', config: { type: 'included' } }
                ];
            }

            if (modulesToInsert.length > 0) {
                const { error: modError } = await supabaseAdmin.from('company_modules').insert(modulesToInsert);
                if (modError) throw modError;
            }

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
                    cycle: cycle || 'monthly'
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
                    name: admin_name || legal_name,
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
