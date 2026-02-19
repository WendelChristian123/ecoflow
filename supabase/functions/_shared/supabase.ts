import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const createSupabaseClient = (req: Request) => {
    return createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
            global: {
                headers: { Authorization: req.headers.get("Authorization")! },
            },
        }
    );
};

export const createSupabaseAdmin = () => {
    return createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
};


export const validateCpfCnpj = (val: string) => {
    // Basic length check, real validation can be added
    const clean = val.replace(/\D/g, "");
    return clean.length === 11 || clean.length === 14;
};

export const sanitizeString = (val: string) => val ? val.trim() : "";
export const sanitizeNumbers = (val: string) => val ? val.replace(/\D/g, "") : "";
