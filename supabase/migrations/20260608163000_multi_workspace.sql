-- ==============================================================================
-- MIGRATION: MULTI-WORKSPACE SUPPORT
-- DESCRIPTION: Introduces company_users junction table to allow a user to belong
-- to multiple companies. Migrates existing profiles and updates switch_workspace logic.
-- ==============================================================================

-- 1. Create company_users table
CREATE TABLE IF NOT EXISTS public.company_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(company_id, user_id)
);

-- 2. Enable RLS on company_users
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admins can see all
CREATE POLICY "Super admins can see all company_users" ON public.company_users
FOR SELECT USING (public.is_super_admin());

-- Policy: Users can see company_users of the company they are currently active in
CREATE POLICY "Users see members of active company" ON public.company_users
FOR SELECT USING (company_id = public.get_my_company_id());

-- Policy: Users can always see their own records
CREATE POLICY "Users see their own company_users" ON public.company_users
FOR SELECT USING (user_id = auth.uid());

-- Policy: Admins can insert/update company_users for their active company
CREATE POLICY "Admins can manage company_users" ON public.company_users
FOR ALL USING (
    company_id = public.get_my_company_id() 
    AND public.is_admin()
);

-- 3. Migrate existing profiles
INSERT INTO public.company_users (company_id, user_id, role, status)
SELECT company_id, id, role, COALESCE(status, 'active')
FROM public.profiles
WHERE company_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 4. Create switch_workspace RPC
CREATE OR REPLACE FUNCTION public.switch_workspace(target_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Super Admins can switch to ANY company
  IF public.is_super_admin() THEN
    UPDATE public.profiles
    SET company_id = target_company_id
    WHERE id = auth.uid();
    RETURN;
  END IF;

  -- Verify if the user is a member of the target company
  SELECT role INTO v_user_role
  FROM public.company_users
  WHERE company_id = target_company_id AND user_id = auth.uid() AND status = 'active';

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Acesso negado ou empresa não encontrada.';
  END IF;

  -- Update the active session in profiles
  UPDATE public.profiles
  SET company_id = target_company_id,
      role = v_user_role
  WHERE id = auth.uid();
END;
$$;
