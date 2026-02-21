
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

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('No authorization header');

        const token = authHeader.replace('Bearer ', '');

        let userId;
        try {
            const payloadStr = atob(token.split('.')[1]);
            const payload = JSON.parse(payloadStr);
            userId = payload.sub;
            if (!userId) throw new Error('Invalid token payload');
        } catch (e) {
            throw new Error(`Auth session missing or invalid token!`);
        }

        // Verify if user is super admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'super_admin') {
            throw new Error("Forbidden: Admin access required");
        }

        const { companyId } = await req.json();

        if (!companyId) throw new Error('Company ID is required');

        console.log(`[DELETE] Starting deletion for company: ${companyId} by SuperAdmin: ${userId}`);

        // 1. Get all users associated with this company
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('company_id', companyId);

        if (profileError) throw new Error(`Error fetching profiles: ${profileError.message}`);

        console.log(`[DELETE] Found ${profiles.length} users to delete.`);

        // 2. Delete each user from Auth
        for (const profile of profiles) {
            console.log(`[DELETE] Deleting user ${profile.id} (${profile.email})`);
            const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);

            if (deleteUserError) {
                console.error(`[DELETE_ERROR] Failed to delete user ${profile.id}: ${deleteUserError.message}`);
                // Continue deleting others even if one fails
            }
        }

        // 3. Delete the Company (Cascades to profiles, delegations, etc.)
        console.log(`[DELETE] Deleting company record...`);
        const { error: deleteCompanyError } = await supabaseAdmin
            .from('companies') // Changed from tenants
            .delete()
            .eq('id', companyId);

        if (deleteCompanyError) throw new Error(`Error deleting company: ${deleteCompanyError.message}`);

        return new Response(JSON.stringify({ success: true, message: 'Company and users deleted.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error(`[FATAL] ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
