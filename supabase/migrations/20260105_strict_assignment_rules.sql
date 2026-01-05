/*
  # 20260105_strict_assignment_rules.sql
  # MIGRATION: STRICT ASSIGNMENT & WRITE POLICIES (WITH SCHEMA FIX)
  #
  # REPLACES: 20260105_strict_write_policy.sql
  #
  # GOAL: Enforce strict "Responsibility" rules.
  # 1. Ensure 'member_ids' column exists on 'projects' and 'teams' (Fixing schema drift).
  # 2. Tasks: Assignee MUST be Self OR Delegator.
  # 3. Events: Participants MUST be Self OR Delegator.
*/

-- ==============================================================================
-- 1. SCHEMA REPAIR: ENSURE 'member_ids' EXISTS (Matches api.ts)
-- ==============================================================================

DO $$
BEGIN
    -- PROJECTS TABLE
    -- If 'members' exists but 'member_ids' does not, rename it.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'members') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'member_ids') THEN
        ALTER TABLE public.projects RENAME COLUMN members TO member_ids;
    END IF;

    -- If 'member_ids' still missing, create it.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'member_ids') THEN
        ALTER TABLE public.projects ADD COLUMN member_ids jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- TEAMS TABLE
    -- If 'members' exists but 'member_ids' does not, rename it.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'members') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'member_ids') THEN
        ALTER TABLE public.teams RENAME COLUMN members TO member_ids;
    END IF;

    -- If 'member_ids' still missing, create it.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'member_ids') THEN
        ALTER TABLE public.teams ADD COLUMN member_ids jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;


-- ==============================================================================
-- 2. CLEANUP OLD POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Tasks Insert" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Edit" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Delete" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Strict Insert" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Strict Update" ON public.tasks;
DROP POLICY IF EXISTS "Tasks Strict Delete" ON public.tasks;

DROP POLICY IF EXISTS "Events Insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Update" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Delete" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Strict Insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Strict Update" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Strict Delete" ON public.calendar_events;


-- ==============================================================================
-- 3. APPLY STRICT TASK POLICIES
-- ==============================================================================

-- A. TASKS INSERT
CREATE POLICY "Tasks Strict Insert" ON public.tasks
FOR INSERT WITH CHECK (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    (
      -- 1. CONTEXT CHECK
      (
        (project_id IS NOT NULL AND project_id IN (SELECT id FROM projects WHERE member_ids @> to_jsonb(auth.uid()::text)))
        OR
        (team_id IS NOT NULL AND team_id IN (SELECT id FROM teams WHERE member_ids @> to_jsonb(auth.uid()::text)))
        OR
        (project_id IS NULL AND team_id IS NULL)
      )
      AND
      -- 2. ASSIGNMENT CHECK
      (
        assignee_id = auth.uid()
        OR
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
        OR
        (assignee_id IS NULL AND (project_id IS NOT NULL OR team_id IS NOT NULL))
      )
    )
  )
);

-- B. TASKS UPDATE
CREATE POLICY "Tasks Strict Update" ON public.tasks
FOR UPDATE USING (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    (
      -- Ownership or Context Visibility
      (
         assignee_id = auth.uid()
         OR project_id IN (SELECT id FROM projects WHERE member_ids @> to_jsonb(auth.uid()::text))
         OR team_id IN (SELECT id FROM teams WHERE member_ids @> to_jsonb(auth.uid()::text))
         OR EXISTS (SELECT 1 FROM delegations d WHERE d.owner_id = tasks.assignee_id AND d.delegate_id = auth.uid() AND d.module = 'tasks' AND (d.permissions->>'edit')::boolean = true)
      )
    )
  )
) WITH CHECK (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    (
       -- ASSIGNMENT CHECK
      (
        assignee_id = auth.uid()
        OR
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
        OR
        (assignee_id IS NULL AND (project_id IS NOT NULL OR team_id IS NOT NULL))
      )
    )
  )
);

-- C. TASKS DELETE
CREATE POLICY "Tasks Strict Delete" ON public.tasks
FOR DELETE USING (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM delegations d WHERE d.owner_id = tasks.assignee_id AND d.delegate_id = auth.uid() AND d.module = 'tasks' AND (d.permissions->>'edit')::boolean = true)
  )
);


-- ==============================================================================
-- 4. APPLY STRICT EVENT POLICIES
-- ==============================================================================

-- A. EVENTS INSERT
CREATE POLICY "Events Strict Insert" ON public.calendar_events
FOR INSERT WITH CHECK (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    (
        -- STRICT PARTICIPANTS CHECK
        NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(participants) p_id
            WHERE p_id != auth.uid()::text
            AND NOT EXISTS (
                SELECT 1 FROM delegations d
                WHERE d.owner_id = p_id::uuid
                  AND d.delegate_id = auth.uid()
                  AND d.module = 'agenda'
                  AND (d.permissions->>'create')::boolean = true
            )
        )
    )
  )
);

-- B. EVENTS UPDATE
CREATE POLICY "Events Strict Update" ON public.calendar_events
FOR UPDATE USING (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    participants @> to_jsonb(auth.uid()::text)
    OR
     EXISTS (
        SELECT 1 FROM delegations d
        WHERE participants @> to_jsonb(d.owner_id::text)
          AND d.delegate_id = auth.uid()
          AND d.module = 'agenda'
          AND (d.permissions->>'edit')::boolean = true
    )
  )
) WITH CHECK (
   tenant_id = public.get_current_tenant_id()
   AND (
     public.is_admin()
     OR
     (
        -- STRICT PARTICIPANTS CHECK
        NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(participants) p_id
            WHERE p_id != auth.uid()::text
            AND NOT EXISTS (
                SELECT 1 FROM delegations d
                WHERE d.owner_id = p_id::uuid
                  AND d.delegate_id = auth.uid()
                  AND d.module = 'agenda'
                  AND (d.permissions->>'create')::boolean = true
            )
        )
     )
   )
);

-- C. EVENTS DELETE
CREATE POLICY "Events Strict Delete" ON public.calendar_events
FOR DELETE USING (
  tenant_id = public.get_current_tenant_id()
  AND (
    public.is_admin()
    OR
    participants @> to_jsonb(auth.uid()::text)
  )
);
