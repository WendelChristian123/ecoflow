/*
  # 20260105_fix_recursion_tasks.sql
  # MIGRATION: FIX INFINITE RECURSION IN TASKS RLS
  #
  # DESCRIPTION:
  # Previous policy attempted to query 'tasks' table inside the 'tasks' policy, causing recursion.
  # We now access 'assignee_id' directly from the row being checked.
*/

DROP POLICY IF EXISTS "Tasks View" ON public.tasks;

CREATE POLICY "Tasks View" ON public.tasks
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    -- 1. Admin sees all
    public.is_admin() 
    OR
    -- 2. Assignee
    auth.uid() = assignee_id
    OR
    -- 3. Project/Team Membership
    project_id IN (SELECT id FROM projects WHERE member_ids @> to_jsonb(auth.uid()::text)) 
    OR
    team_id IN (SELECT id FROM teams WHERE member_ids @> to_jsonb(auth.uid()::text) OR lead_id = auth.uid())
    OR
    -- 4. Delegation
    EXISTS (
      SELECT 1 FROM delegations d
      WHERE d.owner_id = assignee_id  -- Use column directly without subquery
        AND d.delegate_id = auth.uid()
        AND d.module = 'tasks'
        AND (d.permissions->>'view')::boolean = true
    )
  )
);
