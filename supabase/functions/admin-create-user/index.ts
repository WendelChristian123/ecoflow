
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
            .select('tenant_id, role')
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

        let tenantId = adminProfile.tenant_id;

        // 5. Parse Request Body
        const { email, password, name, phone, role, permissions, tenantId: reqTenantId } = await req.json();

        // Super Admin override tenant
        if (adminProfile.role === 'super_admin' && reqTenantId) {
            tenantId = reqTenantId;
        }

        if (!email || !password || !name) {
            return new Response(JSON.stringify({ error: 'Missing required fields (email, password, name)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 6. Create User (Supabase Auth Admin)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, tenant_id: tenantId }
        });

        if (createError) {
            return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!newUser.user) {
            return new Response(JSON.stringify({ error: 'Failed to create user object' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 7. Create Profile (Database)
        // Use UPSERT to prevent race conditions if triggers exist, but explicit insert is cleaner for "Creating"
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUser.user.id,
                email,
                name,
                phone,
                role: role || 'user',
                tenant_id: tenantId,
                permissions: permissions, // JSONB
                status: 'active'
            });

        if (profileError) {
            // Optional: Rollback Auth User if profile creation fails?
            // await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
            console.error("Profile Creation Failed:", profileError);
            return new Response(JSON.stringify({ error: `User created but profile failed: ${profileError.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Success
        return new Response(
            JSON.stringify({ user: newUser.user, message: 'User created successfully' }),
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
