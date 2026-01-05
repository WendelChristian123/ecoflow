DO $$
BEGIN
  -- Drop the restrictive INSERT policy (previously named "Projects Mod")
  DROP POLICY IF EXISTS "Projects Mod" ON public.projects;

  -- Create a permissive INSERT policy (allows any authenticated user in the tenant to create)
  CREATE POLICY "Projects Insert" ON public.projects
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id()
  );
END $$;
