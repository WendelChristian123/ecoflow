-- Migration: Super Admin RLS Policies
-- Description: Add RLS policies to allow super_admin users to manage companies, subscriptions, company_modules, and company_addons.

-- 1. Policies for company_modules
DROP POLICY IF EXISTS "Super admins can manage all company modules" ON public.company_modules;
CREATE POLICY "Super admins can manage all company modules" ON public.company_modules
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 2. Policies for subscriptions
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can manage all subscriptions" ON public.subscriptions
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 3. Policies for companies
DROP POLICY IF EXISTS "Super admins can manage all companies" ON public.companies;
CREATE POLICY "Super admins can manage all companies" ON public.companies
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 4. Policies for company_addons
DROP POLICY IF EXISTS "Super admins can manage all company addons" ON public.company_addons;
CREATE POLICY "Super admins can manage all company addons" ON public.company_addons
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
