-- ==============================================================================
-- MIGRATION: FIX RECURSION IN RLS (CRITICAL)
-- DESCRIPTION: Makes get_current_tenant_id SECURITY DEFINER to bypass RLS and avoid infinite loops.
-- ==============================================================================

-- 1. Redefine get_current_tenant_id to be SECURITY DEFINER
-- This ensures it runs with the privileges of the creator (usually postgres/admin),
-- bypassing the RLS on 'profiles' table which calls this function.
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- <--- CRITICAL FIX
SET search_path = public -- Secure search path
AS $$
DECLARE
  tenant_id_found uuid;
BEGIN
  -- Attempt to get from JWT first (faster, no DB hit)
  tenant_id_found := (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid;
  
  -- If not in JWT, query profiles (this query now bypasses RLS due to SECURITY DEFINER)
  IF tenant_id_found IS NULL THEN
    SELECT p.tenant_id INTO tenant_id_found
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  RETURN tenant_id_found;
END;
$$;

-- 2. Ensure is_super_admin is also safe
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$;
