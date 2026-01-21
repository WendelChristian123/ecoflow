-- Migration: create_get_user_id_by_email
-- Description: Create a function to lookup auth.users.id by email. This is used by Edge Functions to handle orphaned users.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to service_role (Edge Functions use this)
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
