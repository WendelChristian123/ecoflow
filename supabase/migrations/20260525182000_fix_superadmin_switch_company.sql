-- ==========================================
-- FIX SUPER ADMIN COMPANY SWITCHING
-- ==========================================

-- Create an RPC to safely allow Super Admins to switch their active company
-- Since RLS strict policies block direct UPDATEs to profiles.
CREATE OR REPLACE FUNCTION switch_active_company(new_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Check current role
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  -- 2. Allow switch if Super Admin
  IF v_role = 'super_admin' THEN
     UPDATE public.profiles SET company_id = new_company_id WHERE id = auth.uid();
  ELSE
     RAISE EXCEPTION 'Acesso negado: Apenas Super Admins podem alternar entre empresas ativamente.';
  END IF;
END;
$$;
