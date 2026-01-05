/*
  # 20260105_strict_write_policy.sql
  # MIGRATION: STRICT WRITE POLICIES (INSERT/UPDATE/DELETE)
  #
  # DESCRIPTION:
  # Enforces strict creation/edit rules for Tasks as per "Regras Gerais".
  # Replaces generic 'check_user_permission' with scope-based checks.
  # 
  # RULES:
  # 1. Self: Can always create/edit for own assignee_id.
  # 2. Delegation: Can create/edit if explicit delegation exists.
  # 3. Team: Can create/edit for members of same team.
  # 4. Project: Can create/edit within participated projects.
*/

-- DROP OLD PERMISSIVE POLICIES
DROP POLICY IF EXISTS "Tasks Insert" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Edit" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Delete" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Mod" ON public.tasks; -- Just in case

-- 1. STRICT INSERT
CREATE POLICY "Tasks Strict Insert" ON public.tasks
FOR INSERT WITH CHECK (
  tenant_id = public.get_current_tenant_id() AND (
    -- A. Admin
    public.is_admin()
    OR
    -- B. Self-Assignment
    assignee_id = auth.uid()
    OR
    -- C. Project Context: I must be a member of the project defined in project_id
    (
        project_id IS NOT NULL AND 
        project_id IN (SELECT id FROM projects WHERE member_ids @> to_jsonb(auth.uid()::text))
    )
    OR
    -- D. Team Context: I must be a member of the team defined in team_id
    (
        team_id IS NOT NULL AND 
        team_id IN (SELECT id FROM teams WHERE member_ids @> to_jsonb(auth.uid()::text))
    )
    OR
    -- E. Direct Delegation: Creating for someone who delegated 'create' to me
    (
        assignee_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM delegations d
            WHERE d.owner_id = tasks.assignee_id
              AND d.delegate_id = auth.uid()
              AND d.module = 'tasks'
              AND (d.permissions->>'create')::boolean = true
        )
    )
  )
);

-- 2. STRICT UPDATE
CREATE POLICY "Tasks Strict Update" ON public.tasks
FOR UPDATE USING (
  tenant_id = public.get_current_tenant_id() AND (
    -- A. Admin
    public.is_admin()
    OR
    -- B. Self (Assignee)
    auth.uid() = assignee_id
    OR
    -- C. Project Context (Member of project) - Usually need 'edit' permission but adhering to 'Scope determines Access' rule
    -- For safety, let's say Project Members can edit tasks in that project (Collaborative)
    (
        project_id IS NOT NULL AND 
        project_id IN (SELECT id FROM projects WHERE member_ids @> to_jsonb(auth.uid()::text))
    )
    OR
    -- D. Team Context
    (
        team_id IS NOT NULL AND 
        team_id IN (SELECT id FROM teams WHERE member_ids @> to_jsonb(auth.uid()::text))
    )
    OR
    -- E. Direct Delegation: Delegated 'edit'
    EXISTS (
        SELECT 1 FROM delegations d
        WHERE d.owner_id = tasks.assignee_id
          AND d.delegate_id = auth.uid()
          AND d.module = 'tasks'
          AND (d.permissions->>'edit')::boolean = true
    )
  )
);

-- 3. STRICT DELETE
-- Delete is usually restricted to Admin or maybe Owner
CREATE POLICY "Tasks Strict Delete" ON public.tasks
FOR DELETE USING (
  tenant_id = public.get_current_tenant_id() AND (
    public.is_admin() 
    OR
    -- Allow deleting OWN tasks? 
    auth.uid() = assignee_id
  )
);
