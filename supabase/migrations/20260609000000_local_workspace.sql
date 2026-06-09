-- ==========================================
-- FIX LOCAL WORKSPACE RLS BY HEADER OVERRIDE
-- ==========================================

-- Redefine get_my_company_id to respect the x-company-id header if valid
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_header_company_id text;
  v_final_company_id uuid;
BEGIN
  -- Try to read from custom header
  v_header_company_id := current_setting('request.headers', true)::json->>'x-company-id';
  
  IF v_header_company_id IS NOT NULL AND v_header_company_id <> '' THEN
    -- Validate that the user actually belongs to this company!
    IF EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_header_company_id::uuid 
        AND user_id = auth.uid() 
        AND status = 'active'
    ) OR public.is_super_admin() THEN
      RETURN v_header_company_id::uuid;
    END IF;
  END IF;

  -- Fallback to the one stored in profile
  SELECT company_id INTO v_final_company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN v_final_company_id;
END;
$$;
