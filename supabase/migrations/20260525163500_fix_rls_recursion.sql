-- ==========================================
-- FIX RLS INFINITE RECURSION
-- ==========================================

-- 1. Helper function MUST BE SECURITY DEFINER to bypass RLS and avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Note: We do not need to drop/recreate the policies since they just call this function.
-- However, just to be safe, let's redefine the profiles policy to prevent querying other users
-- unless necessary. For now, the SECURITY DEFINER fixes the loop.
