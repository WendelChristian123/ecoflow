-- ==============================================================================
-- MIGRATION: RPC GET MY PROFILE (PERFORMANCE BYPASS)
-- DESCRIPTION: Creates a SECURITY DEFINER function to fetch the current user's profile.
--              This bypasses RLS overhead and recursion risks for the critical login path.
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

  -- 3. Fetch Tenant Status (if tenant_id exists)
  IF (v_profile ->> 'tenant_id') IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', t.id,
      'status', t.status,
      'financial_status', t.financial_status
    ) INTO v_tenant
    FROM public.tenants t
    WHERE t.id = (v_profile ->> 'tenant_id')::uuid; -- Safe cast if properly stored
  END IF;

  -- 4. Merge Tenant into Profile (Simulate the join)
  IF v_tenant IS NOT NULL THEN
    v_profile := v_profile || jsonb_build_object('tenants', v_tenant);
  END IF;

  RETURN v_profile;
END;
$$;
