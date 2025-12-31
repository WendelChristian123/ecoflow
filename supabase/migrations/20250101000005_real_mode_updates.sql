-- Migration: Real Mode Updates
-- Description: Adds columns to support real implementation of Dashboard, Users, and Plans features.

-- 1. Tenants (Companies) Updates
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'client' CHECK (type IN ('trial', 'client', 'internal')),
ADD COLUMN IF NOT EXISTS financial_status text DEFAULT 'ok' CHECK (financial_status IN ('ok', 'overdue')),
ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- Ensure status column supports all needed values (active, inactive, suspended)
-- If it's an enum, we might need to add values. If text, we add a check constraint.
-- Assuming it is text based on types.ts.
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive', 'suspended'));


-- 2. Profiles (Users) Updates
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked')),
ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();


-- 3. Saas Plans Updates
ALTER TABLE public.saas_plans
ADD COLUMN IF NOT EXISTS type text DEFAULT 'public' CHECK (type IN ('trial', 'public', 'internal', 'custom')),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
ADD COLUMN IF NOT EXISTS module_config jsonb DEFAULT '{}'::jsonb;

-- Backfill Saas Plans 'status' from 'active' boolean if needed
UPDATE public.saas_plans SET status = 'active' WHERE active = true AND status IS NULL;
UPDATE public.saas_plans SET status = 'archived' WHERE active = false AND status IS NULL;

-- 4. Audit Log Table (Minimal)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    target_resource text NOT NULL,
    target_id text,
    details jsonb,
    created_at timestamptz DEFAULT now(),
    tenant_id uuid REFERENCES public.tenants(id)
);

-- RLS for Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins can view all audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
        )
    );

CREATE POLICY "Users can create audit logs (system usage)" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);
