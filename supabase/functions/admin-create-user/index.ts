
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get the requester (Admin)
        const {
            data: { user: adminUser },
        } = await supabaseClient.auth.getUser();

        if (!adminUser) throw new Error('Unauthorized');

        // 2. Get Admin's Profile to find Tenant ID
        const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('tenant_id, role')
            .eq('id', adminUser.id)
            .single();

        if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin')) {
            throw new Error('Only Admins can create users');
        }

        const tenantId = adminProfile.tenant_id;

        // 3. Parse Request
        const { email, password, name, phone, role, permissions } = await req.json();

        if (!email || !password || !name) throw new Error('Missing fields');

        // 4. Create Auth User (Admin API)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, tenant_id: tenantId }
        });

        if (createError) throw createError;

        // 5. Create Profile (Service Role bypasses RLS)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: newUser.user.id,
                email,
                name,
                phone,
                role: role || 'user',
                tenant_id: tenantId,
                permissions: permissions
            }); if (profileError) {
                // Rollback auth user if profile fails (Manual rollback for now)
                await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
                throw profileError;
            }

        return new Response(
            JSON.stringify(newUser),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
