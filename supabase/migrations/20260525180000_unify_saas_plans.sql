-- Unify SaaS Plans (Remove duplicated Asaas plan tables)

-- 1. Drop constraints that depend on public.plans
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_id_fkey;
ALTER TABLE IF EXISTS public.subscription_changes DROP CONSTRAINT IF EXISTS subscription_changes_to_plan_id_fkey;

-- 2. Clear invalid testing data that has text 'starter' or 'pro' as plan_id instead of UUID
DELETE FROM public.subscription_changes;
DELETE FROM public.payments;
DELETE FROM public.subscriptions;
DELETE FROM public.asaas_events;

-- 3. Change column type from TEXT to UUID
ALTER TABLE public.subscriptions ALTER COLUMN plan_id TYPE UUID USING plan_id::uuid;
ALTER TABLE public.subscription_changes ALTER COLUMN to_plan_id TYPE UUID USING to_plan_id::uuid;

-- 4. Add correct foreign keys pointing to saas_plans
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.saas_plans(id);
ALTER TABLE public.subscription_changes ADD CONSTRAINT subscription_changes_to_plan_id_fkey FOREIGN KEY (to_plan_id) REFERENCES public.saas_plans(id);

-- 5. Drop the old Asaas migration tables
DROP TABLE IF EXISTS public.plan_prices CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
