-- 1. Create task_shares table
CREATE TABLE IF NOT EXISTS public.task_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  permission_level text CHECK (permission_level IN ('view', 'edit', 'complete')) DEFAULT 'view',
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for task_shares" ON public.task_shares
USING (company_id = public.get_current_company_id());

-- 2. Alter tasks
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS context_type text CHECK (context_type IN ('personal', 'team', 'project')) DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS context_id uuid;

-- Migrate existing tasks data
UPDATE public.tasks
SET 
  owner_id = assignee_id, -- Assume current assignee is owner for legacy tasks
  context_type = CASE 
    WHEN team_id IS NOT NULL THEN 'team'
    WHEN project_id IS NOT NULL THEN 'project'
    ELSE 'personal'
  END,
  context_id = COALESCE(team_id, project_id);

-- 3. Alter calendar_events
ALTER TABLE public.calendar_events 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS context_type text CHECK (context_type IN ('personal', 'team', 'project')) DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS context_id uuid;

-- Migrate existing events data
UPDATE public.calendar_events
SET 
  context_type = CASE 
    WHEN is_team_event = true THEN 'team'
    ELSE 'personal'
  END;

-- 4. Recreate RLS for Tasks
DROP POLICY IF EXISTS "Tenant isolation for tasks" ON public.tasks;

CREATE POLICY "RBAC Tasks Select" ON public.tasks FOR SELECT
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid() OR
    assignee_id = auth.uid() OR
    (context_type = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = tasks.context_id AND t.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    (context_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = tasks.context_id AND p.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    EXISTS (
      SELECT 1 FROM public.task_shares ts 
      WHERE ts.task_id = tasks.id AND ts.shared_with_user_id = auth.uid()
    )
  )
);

CREATE POLICY "RBAC Tasks Insert" ON public.tasks FOR INSERT
WITH CHECK (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    (context_type = 'personal') OR
    (context_type = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = context_id AND t.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    (context_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = context_id AND p.member_ids @> to_jsonb(auth.uid()::text)
    ))
  )
);

CREATE POLICY "RBAC Tasks Update" ON public.tasks FOR UPDATE
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid() OR
    assignee_id = auth.uid() OR
    (context_type = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = tasks.context_id AND t.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    (context_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = tasks.context_id AND p.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    EXISTS (
      SELECT 1 FROM public.task_shares ts 
      WHERE ts.task_id = tasks.id AND ts.shared_with_user_id = auth.uid() AND ts.permission_level IN ('edit', 'complete')
    )
  )
);

CREATE POLICY "RBAC Tasks Delete" ON public.tasks FOR DELETE
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid()
  )
);

-- 5. Recreate RLS for Calendar Events
DROP POLICY IF EXISTS "Tenant isolation for events" ON public.calendar_events;

CREATE POLICY "RBAC Events Select" ON public.calendar_events FOR SELECT
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid() OR
    participants @> to_jsonb(auth.uid()::text) OR
    (context_type = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = calendar_events.context_id AND t.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    (context_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = calendar_events.context_id AND p.member_ids @> to_jsonb(auth.uid()::text)
    ))
  )
);

CREATE POLICY "RBAC Events Insert" ON public.calendar_events FOR INSERT
WITH CHECK (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    (context_type = 'personal') OR
    (context_type = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = context_id AND t.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    (context_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = context_id AND p.member_ids @> to_jsonb(auth.uid()::text)
    ))
  )
);

CREATE POLICY "RBAC Events Update" ON public.calendar_events FOR UPDATE
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid() OR
    (context_type = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = calendar_events.context_id AND t.member_ids @> to_jsonb(auth.uid()::text)
    )) OR
    (context_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = calendar_events.context_id AND p.member_ids @> to_jsonb(auth.uid()::text)
    ))
  )
);

CREATE POLICY "RBAC Events Delete" ON public.calendar_events FOR DELETE
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid()
  )
);
