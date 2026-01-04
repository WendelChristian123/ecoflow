

-- 1. ADD COLUMNS TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "routines": {"view": true, "create": true, "edit": true},
  "commercial": {"view": true, "create": true, "edit": true},
  "finance": {"view": false, "create": false, "edit": false},
  "reports": {"view": false}
}'::jsonb,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. HELPER FUNCTIONS

-- 2.1 Check if user is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 Check if user is Admin (or Super Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 Check granular permission
CREATE OR REPLACE FUNCTION public.check_user_permission(perm_path text[])
RETURNS boolean AS $$
DECLARE
  user_perms jsonb;
  result jsonb;
BEGIN
  -- Super Admin bypass
  IF public.is_super_admin() THEN RETURN true; END IF;

  -- Get user permissions
  SELECT permissions INTO user_perms FROM public.profiles WHERE id = auth.uid();
  
  -- Navigate JSON path using #> operator (handles text[] path)
  result := user_perms #> perm_path;
  
  -- If path doesn't exist or is null, return false
  IF result IS NULL THEN RETURN false; END IF;

  -- Return true only if the JSON value is explicitly boolean true
  RETURN (result = 'true'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ENABLE RLS ON CRITICAL TABLES
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 4. FINANCE POLICIES
DROP POLICY IF EXISTS "Finance View" ON public.financial_transactions;
DROP POLICY IF EXISTS "Finance Edit" ON public.financial_transactions;

CREATE POLICY "Finance View" ON public.financial_transactions
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND
  (public.check_user_permission(ARRAY['finance', 'view']) OR public.is_admin())
);

CREATE POLICY "Finance Edit" ON public.financial_transactions
FOR ALL USING (
  tenant_id = public.get_current_tenant_id() AND
  (public.check_user_permission(ARRAY['finance', 'edit']) OR public.is_admin())
);


-- 5. TASKS POLICIES
DROP POLICY IF EXISTS "Tasks View" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Edit" ON public.tasks;

CREATE POLICY "Tasks View" ON public.tasks
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    auth.uid() = assignee_id OR
    public.is_admin() OR
    project_id IN (SELECT id FROM projects WHERE member_ids @> to_jsonb(auth.uid()::text)) OR
    team_id IN (SELECT id FROM teams WHERE member_ids @> to_jsonb(auth.uid()::text) OR lead_id = auth.uid())
  )
);

CREATE POLICY "Tasks Edit" ON public.tasks
FOR ALL USING (
  tenant_id = public.get_current_tenant_id() AND (
    auth.uid() = assignee_id OR
    public.is_admin() OR
    public.check_user_permission(ARRAY['routines', 'edit'])
  )
);

-- 6. AGENDA POLICIES
DROP POLICY IF EXISTS "Events View" ON public.calendar_events;

CREATE POLICY "Events View" ON public.calendar_events
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    participants @> to_jsonb(auth.uid()::text) OR
    public.is_admin()
  )
);

-- 7. PROJECTS & TEAMS
DROP POLICY IF EXISTS "Projects View" ON public.projects;
CREATE POLICY "Projects View" ON public.projects
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    member_ids @> to_jsonb(auth.uid()::text) OR
    public.is_admin()
  )
);

DROP POLICY IF EXISTS "Teams View" ON public.teams;
CREATE POLICY "Teams View" ON public.teams
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    member_ids @> to_jsonb(auth.uid()::text) OR
    lead_id = auth.uid() OR
    public.is_admin()
  )
);
