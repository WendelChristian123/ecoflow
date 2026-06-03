-- ==========================================
-- AUDIT & RBAC UPDATES
-- Restrict team/project creation to admins.
-- Restrict task editing/deletion to owners or explicitly delegated users.
-- ==========================================

-- 1. TEAMS AND PROJECTS (Restrict to Admins)
-- We will dynamically drop policies again to apply the new strict rules

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

-- Teams: Only visible to admins, members, and leads
CREATE POLICY "RBAC Teams Select" ON public.teams FOR SELECT USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR is_admin() OR member_ids @> to_jsonb(auth.uid()::text) OR lead_id = auth.uid()
  )
);
-- Strictly Admins Only
CREATE POLICY "RBAC Teams Insert" ON public.teams FOR INSERT WITH CHECK (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin())
);
CREATE POLICY "RBAC Teams Update" ON public.teams FOR UPDATE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin() OR lead_id = auth.uid())
);
CREATE POLICY "RBAC Teams Delete" ON public.teams FOR DELETE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin())
);

-- Projects: Only visible to admins, members
CREATE POLICY "RBAC Projects Select" ON public.projects FOR SELECT USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR is_admin() OR member_ids @> to_jsonb(auth.uid()::text)
  )
);
-- Strictly Admins Only
CREATE POLICY "RBAC Projects Insert" ON public.projects FOR INSERT WITH CHECK (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin())
);
CREATE POLICY "RBAC Projects Update" ON public.projects FOR UPDATE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin())
);
CREATE POLICY "RBAC Projects Delete" ON public.projects FOR DELETE USING (
  company_id = public.get_current_company_id() AND (is_super_admin() OR is_admin())
);

-- ==========================================
-- 2. TASKS (Restrict UPDATE and DELETE)
-- Users can only modify tasks if they are the owner, assignee, admin, or have explicit shared access.
-- ==========================================

DO $$ 
DECLARE 
  pol record;
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public' AND cmd IN ('UPDATE', 'DELETE') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "RBAC Tasks Update" ON public.tasks FOR UPDATE USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR is_admin() OR
    owner_id = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.task_shares ts 
      WHERE ts.task_id = tasks.id AND ts.shared_with_user_id = auth.uid() AND ts.permission_level IN ('edit', 'complete')
    ) OR
    EXISTS (
      SELECT 1 FROM public.shared_access sa
      WHERE (sa.owner_id = tasks.owner_id OR sa.owner_id = tasks.assignee_id)
        AND sa.target_id = auth.uid()
        AND sa.feature_id IN ('tasks', 'mod_tasks', 'routines.tasks')
    )
  )
);

CREATE POLICY "RBAC Tasks Delete" ON public.tasks FOR DELETE USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR is_admin() OR
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.shared_access sa
      WHERE (sa.owner_id = tasks.owner_id)
        AND sa.target_id = auth.uid()
        AND sa.feature_id IN ('tasks', 'mod_tasks', 'routines.tasks')
    )
  )
);
