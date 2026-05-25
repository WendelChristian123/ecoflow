-- ==========================================
-- NUCLEAR RLS SECURITY POLICIES
-- ==========================================

-- 1. Helper function to get the current user's company_id
-- We look up the profiles table to see what company the user belongs to.
-- Since profiles is secure, users can only access data belonging to their company.
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Force RLS on all main tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Drop all existing permissive policies (if any)
DROP POLICY IF EXISTS "Companies are isolated" ON public.companies;
DROP POLICY IF EXISTS "Tasks isolated by company" ON public.tasks;
DROP POLICY IF EXISTS "Projects isolated by company" ON public.projects;
DROP POLICY IF EXISTS "Contacts isolated by company" ON public.contacts;
DROP POLICY IF EXISTS "Quotes isolated by company" ON public.quotes;
DROP POLICY IF EXISTS "Finance isolated by company" ON public.financial_transactions;

-- 4. Create Strict Policies

-- COMPANIES: Users can only see and update their own company
CREATE POLICY "Companies are isolated"
ON public.companies
FOR ALL
USING ( id = public.get_my_company_id() );

-- PROFILES: Users can see profiles in their company, but only update their own
CREATE POLICY "Profiles viewable by company"
ON public.profiles
FOR SELECT
USING ( company_id = public.get_my_company_id() );

-- (Assuming handle_new_user bypasses RLS using SECURITY DEFINER to insert profiles)

-- TASKS
CREATE POLICY "Tasks isolated by company"
ON public.tasks
FOR ALL
USING ( company_id = public.get_my_company_id() );

-- PROJECTS
CREATE POLICY "Projects isolated by company"
ON public.projects
FOR ALL
USING ( company_id = public.get_my_company_id() );

-- CONTACTS
CREATE POLICY "Contacts isolated by company"
ON public.contacts
FOR ALL
USING ( company_id = public.get_my_company_id() );

-- QUOTES
CREATE POLICY "Quotes isolated by company"
ON public.quotes
FOR ALL
USING ( company_id = public.get_my_company_id() );

-- FINANCIAL TRANSACTIONS
CREATE POLICY "Finance isolated by company"
ON public.financial_transactions
FOR ALL
USING ( company_id = public.get_my_company_id() );
