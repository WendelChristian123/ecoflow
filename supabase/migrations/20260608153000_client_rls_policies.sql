-- Migration: Client RLS Policies for Subscriptions, Company Modules and Company Addons
-- Description: Allow authenticated company users to read their own company's subscriptions, company_modules, and company_addons.

-- 1. Policies for company_modules
DROP POLICY IF EXISTS "Users view own company modules" ON public.company_modules;
CREATE POLICY "Users view own company modules" ON public.company_modules
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_my_company_id());

-- 2. Policies for subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users view own company subscriptions" ON public.subscriptions;
CREATE POLICY "Users view own company subscriptions" ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_my_company_id());

-- 3. Policies for company_addons
DROP POLICY IF EXISTS "Users view own company addons" ON public.company_addons;
CREATE POLICY "Users view own company addons" ON public.company_addons
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_my_company_id());
