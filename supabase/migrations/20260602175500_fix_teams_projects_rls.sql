-- ==========================================
-- RESTRICTIVE POLICIES FOR TEAMS AND PROJECTS
-- ==========================================

-- Enable RLS explicitly
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Dynamically drop ALL existing policies to ensure a clean slate
DO $$ 
DECLARE 
  pol record;
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'teams' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teams', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
END $$;

-- Teams: Only visible/editable to admins, members, and leads
CREATE POLICY "RBAC Teams Select" ON public.teams FOR SELECT USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR is_admin() OR member_ids @> to_jsonb(auth.uid()::text) OR lead_id = auth.uid()
  )
);
CREATE POLICY "RBAC Teams Insert" ON public.teams FOR INSERT WITH CHECK (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR public.check_user_permission(ARRAY['routines', 'edit']))
);
CREATE POLICY "RBAC Teams Update" ON public.teams FOR UPDATE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR public.check_user_permission(ARRAY['routines', 'edit']) OR lead_id = auth.uid())
);
CREATE POLICY "RBAC Teams Delete" ON public.teams FOR DELETE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR public.check_user_permission(ARRAY['routines', 'edit']))
);

-- Projects: Only visible/editable to admins, members
CREATE POLICY "RBAC Projects Select" ON public.projects FOR SELECT USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR is_admin() OR member_ids @> to_jsonb(auth.uid()::text)
  )
);
CREATE POLICY "RBAC Projects Insert" ON public.projects FOR INSERT WITH CHECK (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR public.check_user_permission(ARRAY['routines', 'edit']))
);
CREATE POLICY "RBAC Projects Update" ON public.projects FOR UPDATE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR public.check_user_permission(ARRAY['routines', 'edit']))
);
CREATE POLICY "RBAC Projects Delete" ON public.projects FOR DELETE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR public.check_user_permission(ARRAY['routines', 'edit']))
);
