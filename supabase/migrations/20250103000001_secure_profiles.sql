-- ==============================================================================
-- MIGRATION: SECURE PROFILES (MULTI-TENANT ISOLATION)
-- DESCRIPTION: Fixes critical security risk where profiles were readable by everyone.
-- ==============================================================================

-- 1. DROP INSECURE POLICY
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 2. CREATE SECURE POLICY
-- Users can only see profiles belonging to their own tenant (or if they are super_admin)
CREATE POLICY "Tenant isolation for profiles" ON public.profiles
FOR SELECT
USING (
  tenant_id = public.get_current_tenant_id() 
  OR 
  (auth.uid() = id) -- User can always see themselves (redundant if tenant matches, but safe)
  OR
  is_super_admin()
);

-- Note: Insert/Update policies are already strictly scoped to auth.uid() = id in schema.sql, 
-- but we could harden them too. For now, read access is the main leak.
