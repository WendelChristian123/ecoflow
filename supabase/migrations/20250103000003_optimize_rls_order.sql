-- ==============================================================================
-- MIGRATION: OPTIMIZE RLS ORDER
-- DESCRIPTION: Reorders RLS conditions to check auth.uid() FIRST.
--              This prevents get_current_tenant_id() from running during self-lookups, blocking recursion.
-- ==============================================================================

-- 1. DROP EXISTING POLICY
DROP POLICY IF EXISTS "Tenant isolation for profiles" ON public.profiles;

-- 2. RE-CREATE POLICY WITH OPTIMIZED ORDER
-- Postgres executes OR conditions left-to-right (mostly).
-- Checking "id = auth.uid()" first ensures that a user loading their OWN profile
-- never triggers the tenant check (which queries profile again -> infinite loop).

CREATE POLICY "Tenant isolation for profiles" ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id)                   -- 1. FASTEST & SAFEST: Is this ME? (Stops recursion)
  OR
  (tenant_id = public.get_current_tenant_id()) -- 2. Standard check: Is it my tenant?
  OR
  is_super_admin()                    -- 3. Admin override (Note: is_super_admin now SECURITY DEFINER too)
);

-- Note: This works in tandem with 20250103000002_fix_recursion_rls.sql
-- Even if SECURITY DEFINER fails context switching, this logic order prevents the loop.
