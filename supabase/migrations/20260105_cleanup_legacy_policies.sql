/*
  # 20260105_cleanup_legacy_policies.sql
  # MIGRATION: CLEANUP LEGACY POLICIES
  #
  # DESCRIPTION:
  # Drops conflicting "Tenant isolation" policies that are too broad and override 
  # the new granular RBAC policies.
*/

-- 1. DROP LEGACY TASKS POLICY
DROP POLICY IF EXISTS "Tenant isolation for tasks" ON public.tasks;

-- 2. DROP LEGACY CALENDAR POLICY
DROP POLICY IF EXISTS "Tenant isolation for events" ON public.calendar_events;

-- 3. DROP LEGACY TEAMS POLICY
DROP POLICY IF EXISTS "Tenant isolation for teams" ON public.teams;

-- 4. DROP LEGACY PROJECTS POLICY
DROP POLICY IF EXISTS "Tenant isolation for projects" ON public.projects;

-- 5. DROP LEGACY FINANCE POLICIES (If they exist under this name)
DROP POLICY IF EXISTS "Tenant isolation for transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Tenant isolation for accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Tenant isolation for categories" ON public.financial_categories;
DROP POLICY IF EXISTS "Tenant isolation for cards" ON public.credit_cards;

-- NOTE: The granular policies in '20260105_enforce_rbac.sql' will now be the ONLY authority.
