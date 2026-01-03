-- ==============================================================================
-- MIGRATION: RPC GET MY PROFILE (SAFE MODE)
-- DESCRIPTION: Updates get_my_profile to handle invalid tenant_ids safely.
--              Returns NULL for tenant details if ID is not a valid UUID.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile jsonb;
  v_tenant jsonb;
  v_tenant_id_text text;
BEGIN
  -- 1. Get Current User ID safely
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch Profile (Direct Query, No RLS)
  SELECT to_jsonb(p.*) INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Fetch Tenant Status (Safely)
  v_tenant_id_text := v_profile ->> 'tenant_id';

  IF v_tenant_id_text IS NOT NULL THEN
    -- Check if it is a valid UUID before casting/querying
    IF v_tenant_id_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      SELECT jsonb_build_object(
        'id', t.id,
        'status', t.status,
        'financial_status', t.financial_status
      ) INTO v_tenant
      FROM public.tenants t
      WHERE t.id = v_tenant_id_text::uuid;
    ELSE
      -- Legacy/Invalid ID: Return a placeholder or null tenant
      -- We will treat it as 'no tenant details found' but NOT crash.
      v_tenant := NULL; 
    END IF;
  END IF;

  -- 4. Merge Tenant into Profile
  IF v_tenant IS NOT NULL THEN
    v_profile := v_profile || jsonb_build_object('tenants', v_tenant);
  END IF;

  RETURN v_profile;
END;
$$;
