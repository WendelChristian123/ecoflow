-- ==============================================================================
-- MIGRATION: PRODUCTION READINESS (AUDIT LOGS & PERFORMANCE)
-- DESCRIPTION: Creates audit_logs table, adds performance indexes, and fixes usage of profiles.
-- ==============================================================================

-- 1. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid, -- Can be null for general actions or if record deleted? Ideally kept.
  action text CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACTION')) NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid DEFAULT auth.uid(), -- The user performing the action
  tenant_id uuid, -- Optional, but recommended for Multi-tenant isolation
  description text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only see their own logs (if tenant_id is set)
CREATE POLICY "Tenant isolation for audit_logs" ON public.audit_logs
USING (tenant_id = public.get_current_tenant_id());

-- 2. CREATE INDEXES FOR PERFORMANCE
-- Critical FKs widely used in RLS filtering

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON public.financial_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.financial_transactions(date); -- Common filter range

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON public.quotes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON public.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON public.teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tenant ON public.calendar_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON public.financial_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.financial_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cards_tenant ON public.credit_cards(tenant_id);

-- 3. ENSURE PROFILES SCHEMA
DO $$
BEGIN
    -- Ensure permissions column exists (used in api.ts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'permissions') THEN
        ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}';
    END IF;
    
    -- Ensure tenant_id is indexed in profiles for faster RLS Lookups
    -- (Since get_current_tenant_id() queries profiles by ID, it uses PK index, which is fine. 
    -- But finding "all users of a tenant" needs index on tenant_id)
    -- idx_profiles_tenant might not exist.
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
