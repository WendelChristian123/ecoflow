-- Fix calendar_events RLS for shared access

-- Drop old restrictive or buggy policies
DROP POLICY IF EXISTS "Events Strict Insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Management" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Strict View" ON public.calendar_events;
DROP POLICY IF EXISTS "Events Insert" ON public.calendar_events;

-- Ensure the RBAC policy allows delegated users to insert
DROP POLICY IF EXISTS "RBAC Events Insert" ON public.calendar_events;
CREATE POLICY "RBAC Events Insert" ON public.calendar_events FOR INSERT
WITH CHECK (
  company_id = public.get_current_company_id() AND (
    is_super_admin() OR
    owner_id = auth.uid() OR
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
