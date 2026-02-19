
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

        // 2. Check Admin Permissions
        const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('role, company_id') // Changed tenant_id
            .eq('id', adminUser.id)
            .single();

        if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin')) {
            throw new Error('Forbidden: Only Admins can update users');
        }

        // 3. Parse Request
        const { userId, updates } = await req.json();

        if (!userId || !updates) throw new Error('Missing userId or updates');

        // 4. Verify Target User belongs to same Company (unless Super Admin)
        if (adminProfile.role !== 'super_admin') {
            const { data: targetProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id') // Changed tenant_id
                .eq('id', userId)
                .single();

            if (!targetProfile || targetProfile.company_id !== adminProfile.company_id) {
                throw new Error('Forbidden: Cannot update user from another company');
            }
        }

        // 5. Update Profile (Service Role bypasses RLS)
        // We only allow specific fields to be updated via this endpoint
        const safeUpdates: any = {};
        if (updates.name !== undefined) safeUpdates.name = updates.name;
        if (updates.phone !== undefined) safeUpdates.phone = updates.phone;
        if (updates.role !== undefined) safeUpdates.role = updates.role;
        if (updates.status !== undefined) safeUpdates.status = updates.status;
        if (updates.permissions !== undefined) safeUpdates.permissions = updates.permissions;

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(safeUpdates)
            .eq('id', userId);

        if (updateError) throw updateError;

        // 6. Optional: Update Auth User Metadata if needed (e.g. name)
        if (updates.name) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
                user_metadata: { name: updates.name }
            });
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
