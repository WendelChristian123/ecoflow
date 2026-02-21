
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Unauthorized: Missing Authorization header');
        }
        const token = authHeader.replace('Bearer ', '');

        // Decode the JWT to get the user ID (since we already know the gateway allowed it vaguely, or we just trust the internal service check)
        const payloadStr = token.split('.')[1];
        if (!payloadStr) throw new Error('Unauthorized: Invalid JWT format');
        let payloadObj;
        try {
            payloadObj = JSON.parse(atob(payloadStr));
        } catch (e) {
            throw new Error('Unauthorized: Could not decode JWT');
        }

        const userId = payloadObj.sub;
        if (!userId) {
            throw new Error('Unauthorized: No user ID in token');
        }

        // We use the service role client from here out anyway
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Check if the user is a super admin in the profiles table
        const { data: profile } = await serviceClient
            .from('profiles')
            .select('role, company_id')
            .eq('id', userId)
            .single();

        if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
            throw new Error("Forbidden: Admin access required");
        }

        const { action, targetId, payload } = await req.json();

        if (!targetId || !action) {
            throw new Error("Missing action or targetId");
        }

        // TENANT SECURITY CHECK (For non-super_admins)
        if (profile.role !== 'super_admin') {
            // 1. Fetch target user profile to check tenant
            const { data: targetProfile, error: targetError } = await serviceClient
                .from('profiles')
                .select('company_id, role')
                .eq('id', targetId)
                .single();

            if (targetError || !targetProfile) {
                // If user exists in Auth but not Profile, it's an edge case. 
                // But for safety, we block unless we are sure.
                // Or maybe we allow deleting "orphaned" users? safer to block.
                throw new Error("Target user profile not found or access denied");
            }

            // 2. Strict Tenant Match
            if (targetProfile.company_id !== profile.company_id) {
                throw new Error("Forbidden: You can only manage users in your own organization");
            }

            // 3. Prevent deleting yourself
            if (targetId === userId) {
                throw new Error("Operation not allowed on yourself");
            }
        }

        let result;

        switch (action) {
            case 'resetPassword':
                if (!payload?.password) throw new Error("Missing password");
                const { data: resetData, error: resetError } = await serviceClient.auth.admin.updateUserById(
                    targetId,
                    { password: payload.password }
                );
                if (resetError) throw resetError;
                result = resetData;
                break;

            case 'forceLogout':
                const { error: logoutError } = await serviceClient.auth.admin.signOut(targetId);
                if (logoutError) throw logoutError;
                result = { success: true };
                break;

            case 'updateUserAuth': // Safe wrapper for generic auth updates (email, phone, etc)
                const { data: updateData, error: updateError } = await serviceClient.auth.admin.updateUserById(
                    targetId,
                    payload
                );
                if (updateError) throw updateError;
                result = updateData;
                break;

            case 'deleteUser':
                // PREVENT DELETING COMPANY OWNERS
                // If the user owns a company, deleting them triggers a CASCADE to delete the company,
                // which then fails due to NO ACTION foreign keys (like profiles.company_id).
                const { data: ownedCompanies, error: ownershipError } = await serviceClient
                    .from('companies')
                    .select('id, name')
                    .eq('owner_user_id', targetId)
                    .limit(1);

                if (ownershipError) throw ownershipError;

                if (ownedCompanies && ownedCompanies.length > 0) {
                    throw new Error(`Cannot delete user: They are the owner of company "${ownedCompanies[0].name}". Please transfer ownership or delete the company instead.`);
                }

                const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetId);
                if (deleteError) throw deleteError;
                result = { success: true };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // Optional: Audit Log (Using the service client to bypass RLS if needed, or rely on normal flow)
        // For now, we trust the client logic to insert into audit_logs, or we could do it here securely.

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
