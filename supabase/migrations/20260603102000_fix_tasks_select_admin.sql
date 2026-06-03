-- Fix RBAC Tasks Select to allow admins to see all tasks

DROP POLICY IF EXISTS "RBAC Tasks Select" ON public.tasks;

CREATE POLICY "RBAC Tasks Select" ON public.tasks FOR SELECT
USING (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    is_admin() OR
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
    ) OR
    EXISTS (
      SELECT 1 FROM public.shared_access sa
      WHERE (sa.owner_id = tasks.assignee_id OR sa.owner_id = tasks.owner_id)
        AND sa.target_id = auth.uid()
        AND sa.feature_id IN ('tasks', 'mod_tasks', 'tasks_overview', 'routines', 'routines.tasks')
    )
  )
);
