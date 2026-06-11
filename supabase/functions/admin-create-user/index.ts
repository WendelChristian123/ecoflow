// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-company-id',
};

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Manual JWT Verification (Bypassing Gateway for better error control)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('AUTH_HEADER_MISSING');
        }

        const token = authHeader.replace('Bearer ', '');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // Create a client to verify the user's token
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user: adminUser }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !adminUser) {
            console.error("Auth Error:", userError);
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token', code: 'AUTH_INVALID_TOKEN' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Initialize Admin Client (Service Role)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 4. Verify Admin Role & Permissions
        const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id, role') // Changed from tenant_id
            .eq('id', adminUser.id)
            .single();

        if (!adminProfile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Allow 'admin' and 'super_admin'
        if (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin') {
            return new Response(JSON.stringify({ error: 'Forbidden: Admin access required', code: 'AUTH_FORBIDDEN' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let companyId = adminProfile.company_id; // Changed from tenantId

        // 5. Parse Request Body
        const { email, password, name, phone, role, permissions, granular_permissions, teams, projects, companyId: reqCompanyId } = await req.json();

        // Super Admin override company
        if (adminProfile.role === 'super_admin' && reqCompanyId) {
            companyId = reqCompanyId;
        }

        if (!email || !password || !name) {
            return new Response(JSON.stringify({ error: 'Missing required fields (email, password, name)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 5.5 Validate User Limits
        const { data: companyData, error: companyError } = await supabaseAdmin
            .from('companies') // Changed from tenants
            .select(`
                id,
                saas_plans (id, max_users, config),
                company_addons (addon_type, quantity, active)
            `)
            .eq('id', companyId)
            .single();

        if (companyData) {
            // Calculate Limit
            const plan = companyData.saas_plans as any;
            const addons = (companyData.company_addons || []) as any[];

            const baseLimit = plan?.config?.max_users ?? plan?.max_users ?? 1;
            const addonLimit = addons
                .filter((a: any) => a.addon_type === 'user_slot' && a.active)
                .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

            const maxUsers = baseLimit + addonLimit;

            // Count Current Users
            const { count: currentCount } = await supabaseAdmin
                .from('company_users')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('status', 'active');

            if ((currentCount || 0) >= maxUsers) {
                return new Response(JSON.stringify({
                    error: `Limite de usuários atingido (${currentCount}/${maxUsers}). Faça upgrade do plano.`
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // 6. Create User (Supabase Auth Admin)
        let userId;
        let isNewUser = true;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, companyId }
        });

        if (createError) {
            if (createError.message.includes('already been registered') || createError.message.includes('already registered')) {
                isNewUser = false;
                // Fetch existing user ID from profiles
                const { data: existingProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .single();

                if (!existingProfile) {
                    return new Response(JSON.stringify({ error: 'User exists in Auth but not in Profiles. Please contact support.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
                userId = existingProfile.id;
            } else {
                return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        } else {
            if (!newUser.user) {
                return new Response(JSON.stringify({ error: 'Failed to create user object' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            userId = newUser.user.id;
        }

        // 7. Profile Handling
        if (isNewUser) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    email,
                    name,
                    phone,
                    role: role || 'user',
                    company_id: companyId,
                    permissions: permissions, // JSONB
                    status: 'active'
                });

            if (profileError) {
                await supabaseAdmin.auth.admin.deleteUser(userId);
                return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        // 8. Insert into company_users (The Junction Table for Multi-Workspace)
        const { error: companyUserError } = await supabaseAdmin
            .from('company_users')
            .upsert({
                company_id: companyId,
                user_id: userId,
                role: role || 'user',
                status: 'active'
            }, { onConflict: 'company_id,user_id' });

        if (companyUserError) {
             console.error("Company User Insert Error:", companyUserError);
             // Non-fatal if we managed to create the user, but bad.
        }


        // 8. Insert Granular Permissions
        if (granular_permissions && Array.isArray(granular_permissions) && granular_permissions.length > 0) {
            const toInsert = granular_permissions.map((p: any) => ({
                ...p,
                id: crypto.randomUUID(),
                user_id: userId,
                company_id: companyId
            }));
            const { error: permError } = await supabaseAdmin.from('user_permissions').insert(toInsert);
            if (permError) console.error("Granular Permissions Error:", permError);
        }

        // 9. Assign Teams
        if (teams && Array.isArray(teams) && teams.length > 0) {
            for (const teamId of teams) {
                const { data: teamData } = await supabaseAdmin.from('teams').select('member_ids').eq('id', teamId).single();
                if (teamData) {
                    const members = teamData.member_ids || [];
                    if (!members.includes(userId)) {
                        members.push(userId);
                        await supabaseAdmin.from('teams').update({ member_ids: members }).eq('id', teamId);
                    }
                }
            }
        }

        // 10. Assign Projects
        if (projects && Array.isArray(projects) && projects.length > 0) {
            for (const projectId of projects) {
                const { data: projData } = await supabaseAdmin.from('projects').select('member_ids').eq('id', projectId).single();
                if (projData) {
                    const members = projData.member_ids || [];
                    if (!members.includes(userId)) {
                        members.push(userId);
                        await supabaseAdmin.from('projects').update({ member_ids: members }).eq('id', projectId);
                    }
                }
            }
        }

        // Success
        return new Response(
            JSON.stringify({ user: { id: userId, email }, message: 'User created or linked successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error("Internal Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
