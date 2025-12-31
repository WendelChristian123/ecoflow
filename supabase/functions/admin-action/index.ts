
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
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Get the user from the request context to verify they are a Super Admin
        const {
            data: { user },
        } = await supabaseClient.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        // Check if the user is a super admin in the profiles table
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: profile } = await serviceClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'super_admin') {
            throw new Error("Forbidden: Super Admin access required");
        }

        const { action, targetId, payload } = await req.json();

        if (!targetId || !action) {
            throw new Error("Missing action or targetId");
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
