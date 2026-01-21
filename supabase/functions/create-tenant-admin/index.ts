
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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    let createdUserId = null;
    let createdTenantId = null;

    try {
        const body = await req.json();
        const { name, ownerEmail, adminName, planId, modules = [], cnpj, phone, subscriptionStart, subscriptionEnd } = body;
        let { password } = body;

        // FIX: Default password if frontend doesn't send one
        if (!password) {
            password = "EcoFlow@2024";
            console.log("[V9] Using default password");
        }

        console.log(`[V9] Request for ${ownerEmail} (${name})`);

        // 1. CREATE AUTH USER
        let authUser = null;
        const { data: createdData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: ownerEmail,
            password: password,
            email_confirm: true,
            user_metadata: { name: adminName }
        });

        if (authError) {
            // HANDLER FOR "User already exists" (Orphan cleanup)
            console.log(`[V9][AUTH_CONFLICT] ${authError.message} - Checking for orphan...`);

            // Lookup User ID by Email (Secure RPC)
            const { data: existingUserId, error: lookupError } = await supabaseAdmin.rpc('get_user_id_by_email', { p_email: ownerEmail });

            if (lookupError || !existingUserId) {
                console.error(`[V9][LOOKUP_FAIL] Could not find user: ${lookupError?.message}`);
                throw new Error(`Error creating user: ${authError.message}`); // Original error
            }

            // Check if Profile exists
            const { data: existingProfile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', existingUserId)
                .single();

            if (existingProfile) {
                console.error(`[V9][CONFLICT] User exists AND has active profile. Aborting.`);
                throw new Error('Este email já está em uso por um usuário ativo em outra empresa.');
            } else {
                console.log(`[V9][ORPHAN] Found orphan user ${existingUserId}. Deleting and recreating...`);
                // Delete orphan
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUserId);
                if (deleteError) {
                    console.error(`[V9][DELETE_FAIL] ${deleteError.message}`);
                    throw new Error('Falha ao limpar registro antigo de usuário.');
                }

                // Retry Creation
                const { data: retryData, error: retryError } = await supabaseAdmin.auth.admin.createUser({
                    email: ownerEmail,
                    password: password,
                    email_confirm: true,
                    user_metadata: { name: adminName }
                });

                if (retryError) throw new Error(`Error creating user (retry): ${retryError.message}`);
                authUser = retryData;
            }
        } else {
            authUser = createdData;
        }

        createdUserId = authUser.user.id;
        console.log(`[V9] User created: ${createdUserId}`);

        // 2. CREATE TENANT
        const { data: newTenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({
                name,
                owner_email: ownerEmail,
                admin_name: adminName,
                contracted_modules: modules,
                plan_id: planId,
                cnpj: cnpj, // Save CNPJ/Document
                phone: phone, // Save Phone
                subscription_start: subscriptionStart,
                subscription_end: subscriptionEnd,
                settings: { calendar: {} }
            })
            .select()
            .single();

        if (tenantError) {
            throw new Error(`Error creating tenant: ${tenantError.message}`);
        }

        createdTenantId = newTenant.id;
        console.log(`[V9] Tenant created: ${createdTenantId}`);

        // 3. RETRY LOOP FOR PROFILE
        let profileLinked = false;
        let lastProfileError = null;

        const adminPerms = {
            routines: { view: true, edit: true, create: true },
            finance: { view: true, edit: true, create: true },
            commercial: { view: true, edit: true, create: true },
            reports: { view: true }
        };

        for (let i = 0; i < 5; i++) {
            console.log(`[V9][PROFILE] Attempt ${i + 1}...`);

            // Use UPSERT to override the trigger's default and sync the tenant_id
            const { error: upsertError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: createdUserId,
                    tenant_id: createdTenantId,
                    role: 'admin', // Enforce admin role
                    name: adminName,
                    email: ownerEmail, // Save Email
                    phone: phone, // Save Phone
                    permissions: adminPerms
                });

            if (!upsertError) {
                profileLinked = true;
                break;
            }

            lastProfileError = upsertError;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!profileLinked) {
            console.error(`[V9][PROFILE_ERROR] ${lastProfileError?.message}`);
            throw new Error(`Profile fail: ${lastProfileError?.message}`);
        }

        return new Response(JSON.stringify({ success: true, tenantId: createdTenantId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error(`[V9][FATAL] ${error.message}`);

        // ROLLBACK
        if (createdUserId) {
            console.log(`[V9][ROLLBACK] Deleting user ${createdUserId}`);
            await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        }
        if (createdTenantId) {
            console.log(`[V9][ROLLBACK] Deleting tenant ${createdTenantId}`);
            await supabaseAdmin.from('tenants').delete().eq('id', createdTenantId);
        }

        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
