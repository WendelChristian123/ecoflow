-- ==============================================================================
-- MIGRATION: SAFE UUID CAST (DEPENDENCY FIX)
-- DESCRIPTION: Updates get_current_tenant_id logic to safely handle non-UUID strings
--              without changing the return type (which would break dependencies).
-- ==============================================================================

-- We use CREATE OR REPLACE because we are maintaining the signature (RETURNS uuid).
-- This avoids the "cannot drop function" error.

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_id_text text;
BEGIN
  -- 1. Attempt to get from JWT first as Text
  tenant_id_text := (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');
  
  -- 2. If not in JWT, query profiles (Bypassing RLS due to SECURITY DEFINER)
  IF tenant_id_text IS NULL THEN
    SELECT p.tenant_id INTO tenant_id_text
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  -- 3. Validate and Return
  -- If it looks like a UUID, return it casted.
  -- If it's something else (e.g. 'tenant-1' or null), return NULL.
  -- This prevents "invalid input syntax for type uuid" crashes.
  
  IF tenant_id_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN tenant_id_text::uuid;
  ELSE
    RETURN NULL; 
  END IF;
END;
$$;
