/*
  # 20260105_strict_rules_implementation.sql
  # MIGRATION: STRICT RLS & CALENDAR CONTEXT
  #
  # DESCRIPTION:
  # 1. Adds team_id and project_id to calendar_events.
  # 2. Implements strict visibility rules for Tasks and Calendar Events:
  #    - Tenant Isolation (Base)
  #    - Project Context: Visible to members of the same project.
  #    - Team Context: Visible to members of the same team.
  #    - Direct Delegation: Visible if explicit delegation exists.
  #    - NO OTHER ACCESS PERMITTED.
*/

DO $$
BEGIN
    -- 1. ADD COLUMNS TO CALENDAR_EVENTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'team_id') THEN
        ALTER TABLE public.calendar_events ADD COLUMN team_id uuid REFERENCES public.teams(id);
        CREATE INDEX idx_calendar_team ON public.calendar_events(team_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'project_id') THEN
        ALTER TABLE public.calendar_events ADD COLUMN project_id uuid REFERENCES public.projects(id);
        CREATE INDEX idx_calendar_project ON public.calendar_events(project_id);
    END IF;
END $$;

-- 2. DROP EXISTING POLICIES (Tasks & Calendar)
DROP POLICY IF EXISTS "Tasks View" ON public.tasks;
DROP POLICY IF EXISTS "Events View" ON public.calendar_events;

-- 3. STRICT RLS: TASKS
CREATE POLICY "Tasks Strict View" ON public.tasks
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    -- A. Self (Assignee or Creator? Usually Assignee is key)
    auth.uid() = assignee_id
    OR
    -- B. Admin Override
    public.is_admin()
    OR
    -- C. Project Context: I am in the Project of this task
    project_id IN (
        SELECT p.id FROM projects p 
        WHERE p.member_ids @> to_jsonb(auth.uid()::text)
    )
    OR
    -- D. Team Context: I am in the Team of this task (or Lead)
    team_id IN (
        SELECT t.id FROM teams t 
        WHERE t.member_ids @> to_jsonb(auth.uid()::text) 
           OR t.lead_id = auth.uid()
    )
    OR
    -- E. Direct Delegation: The ASSIGNEE delegated 'view' access to ME
    EXISTS (
        SELECT 1 FROM delegations d
        WHERE d.owner_id = tasks.assignee_id      -- The task owner (assignee)
          AND d.delegate_id = auth.uid()          -- Me (the viewer)
          AND d.module = 'tasks'                  -- Module check
          AND (d.permissions->>'view')::boolean = true
    )
  )
);

-- 4. STRICT RLS: CALENDAR
-- Note: Calendar events ownership is tricky without owner_id column, but 'participants' usually implies explicit involvement.
-- Ideally we should add created_by or owner_id. For now, we rely on 'participants'.
-- AND we now have project_id / team_id for Context.

CREATE POLICY "Events Strict View" ON public.calendar_events
FOR SELECT USING (
  tenant_id = public.get_current_tenant_id() AND (
    -- A. Self (Participant)
    participants @> to_jsonb(auth.uid()::text)
    OR
    -- B. Admin Override
    public.is_admin()
    OR
    -- C. Project Context: I am in the same Project
    project_id IN (
        SELECT p.id FROM projects p 
        WHERE p.member_ids @> to_jsonb(auth.uid()::text)
    )
    OR
    -- D. Team Context: I am in the same Team
    team_id IN (
        SELECT t.id FROM teams t 
        WHERE t.member_ids @> to_jsonb(auth.uid()::text) 
           OR t.lead_id = auth.uid()
    )
    OR
    -- E. Direct Delegation: A PARTICIPANT has delegated 'agenda' view to ME
    EXISTS (
        SELECT 1 FROM delegations d
        WHERE d.delegate_id = auth.uid()           -- Me
          AND d.module = 'agenda'                  -- Module
          AND (d.permissions->>'view')::boolean = true
          AND calendar_events.participants @> to_jsonb(d.owner_id::text) -- The Delegator is involved in this event
    )
  )
);
