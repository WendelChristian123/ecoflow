
-- ==========================================
-- MIGRATION & SETUP
-- ==========================================

-- 1. SAAS PLANS
CREATE TABLE IF NOT EXISTS public.saas_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric DEFAULT 0,
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  features jsonb DEFAULT '[]',
  allowed_modules jsonb DEFAULT '[]',
  max_users integer DEFAULT 1,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. TENANTS
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status text CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  owner_email text,
  admin_name text,
  cnpj text,
  phone text,
  plan_id uuid REFERENCES public.saas_plans(id),
  contracted_modules jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- MIGRATION: Handle conversion of existing 'tenant-1' text to a real UUID
DO $$ 
DECLARE 
  default_tenant_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN 
  -- 1. Create default tenant if not exists
  INSERT INTO public.tenants (id, name, status)
  VALUES (default_tenant_id, 'EcoFlow Default', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Check if profiles.tenant_id is text type
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tenant_id' AND data_type = 'text') THEN
      
      -- Update all users with 'tenant-1' (or any legacy text) to the new UUID
      UPDATE public.profiles 
      SET tenant_id = default_tenant_id::text 
      WHERE tenant_id = 'tenant-1' OR tenant_id IS NULL;

      -- Now alter the column to UUID
      ALTER TABLE public.profiles 
      ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
      
      -- Add Foreign Key constraint
      ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;
  
  -- If column doesn't exist at all, add it as UUID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tenant_id') THEN
      ALTER TABLE public.profiles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
  END IF;
END $$;

-- ==========================================
-- OPERATIONAL MODULES
-- ==========================================

-- 4. TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  lead_id uuid REFERENCES public.profiles(id),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  member_ids jsonb DEFAULT '[]', -- Array of user IDs
  links jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now()
);

-- 5. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  status text CHECK (status IN ('active', 'completed', 'on_hold')) DEFAULT 'active',
  progress integer DEFAULT 0,
  due_date timestamp with time zone,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  team_ids jsonb DEFAULT '[]', -- References teams
  member_ids jsonb DEFAULT '[]', -- References profiles
  links jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 6. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  status text CHECK (status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  assignee_id uuid REFERENCES public.profiles(id),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  due_date timestamp with time zone,
  tags jsonb DEFAULT '[]',
  links jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 7. CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  type text CHECK (type IN ('meeting', 'deadline', 'review')) DEFAULT 'meeting',
  status text CHECK (status IN ('scheduled', 'completed')) DEFAULT 'scheduled',
  is_team_event boolean DEFAULT false,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  participants jsonb DEFAULT '[]', -- Array of profile IDs
  links jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- FINANCE MODULE
-- ==========================================

-- 8. FINANCIAL ACCOUNTS
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text CHECK (type IN ('checking', 'savings', 'cash', 'investment')) DEFAULT 'checking',
  initial_balance numeric DEFAULT 0,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. FINANCIAL CATEGORIES
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text CHECK (type IN ('income', 'expense')) DEFAULT 'expense',
  color text DEFAULT '#cccccc',
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 10. CREDIT CARDS
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  limit_amount numeric DEFAULT 0,
  closing_day integer,
  due_day integer,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- COMMERCIAL (CRM) MODULE
-- ==========================================

-- 11. CONTACTS
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text CHECK (type IN ('pf', 'pj')) DEFAULT 'pj',
  scope text CHECK (scope IN ('client', 'supplier', 'both')) DEFAULT 'client',
  email text,
  phone text,
  document text, -- CPF/CNPJ
  address text,
  fantasy_name text,
  admin_name text,
  notes text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 12. CATALOG ITEMS
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text CHECK (type IN ('product', 'service')) DEFAULT 'service',
  description text,
  price numeric DEFAULT 0,
  active boolean DEFAULT true,
  financial_category_id uuid REFERENCES public.financial_categories(id),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 13. QUOTES
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  customer_name text, -- Fallback if not registered contact
  customer_phone text,
  status text CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')) DEFAULT 'draft',
  date timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  total_value numeric DEFAULT 0,
  notes text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 14. QUOTE ITEMS
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0
);

-- 15. RECURRING SERVICES
CREATE TABLE IF NOT EXISTS public.recurring_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  setup_fee numeric DEFAULT 0,
  recurring_amount numeric DEFAULT 0,
  start_date timestamp with time zone NOT NULL,
  frequency text CHECK (frequency IN ('monthly', 'yearly')) DEFAULT 'monthly',
  contract_months integer,
  active boolean DEFAULT true,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 16. FINANCIAL TRANSACTIONS (Links everything)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  description text NOT NULL,
  amount numeric DEFAULT 0,
  type text CHECK (type IN ('income', 'expense', 'transfer')) NOT NULL,
  date timestamp with time zone NOT NULL,
  is_paid boolean DEFAULT false,
  
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL, -- For transfers
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  origin_type text CHECK (origin_type IN ('manual', 'quote', 'recurring', 'setup')),
  origin_id uuid, -- Polymorphic ID (could be quote_id, recurring_service_id)
  
  recurrence_id uuid, -- For grouping recurring installments
  installment_index integer,
  total_installments integer,
  
  links jsonb DEFAULT '[]',
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);


-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_services ENABLE ROW LEVEL SECURITY;

-- 1. SAAS PLANS (Public Read)
CREATE POLICY "Public read saas plans" ON public.saas_plans FOR SELECT USING (true);

-- 2. TENANTS (Read Own)
CREATE POLICY "Users can view own tenant" ON public.tenants 
FOR SELECT USING (id = public.get_current_tenant_id());

-- 3. GENERIC POLICY FOR TENANT-SCOPED DATA
-- (Repeat for each table: users can only see data where tenant_id matches their profile's tenant_id)

-- Teams
CREATE POLICY "Tenant isolation for teams" ON public.teams
USING (tenant_id = public.get_current_tenant_id());

-- Projects
CREATE POLICY "Tenant isolation for projects" ON public.projects
USING (tenant_id = public.get_current_tenant_id());

-- Tasks
CREATE POLICY "Tenant isolation for tasks" ON public.tasks
USING (tenant_id = public.get_current_tenant_id());

-- Calendar
CREATE POLICY "Tenant isolation for events" ON public.calendar_events
USING (tenant_id = public.get_current_tenant_id());

-- Financial Accounts
CREATE POLICY "Tenant isolation for accounts" ON public.financial_accounts
USING (tenant_id = public.get_current_tenant_id());

-- Financial Categories
CREATE POLICY "Tenant isolation for categories" ON public.financial_categories
USING (tenant_id = public.get_current_tenant_id());

-- Credit Cards
CREATE POLICY "Tenant isolation for cards" ON public.credit_cards
USING (tenant_id = public.get_current_tenant_id());

-- transactions
CREATE POLICY "Tenant isolation for transactions" ON public.financial_transactions
USING (tenant_id = public.get_current_tenant_id());

-- Contacts
CREATE POLICY "Tenant isolation for contacts" ON public.contacts
USING (tenant_id = public.get_current_tenant_id());

-- Catalog
CREATE POLICY "Tenant isolation for catalog" ON public.catalog_items
USING (tenant_id = public.get_current_tenant_id());

-- Quotes
CREATE POLICY "Tenant isolation for quotes" ON public.quotes
USING (tenant_id = public.get_current_tenant_id());

-- Quote Items (Inherit from Quote via Join or simply check quote's tenant? Simpler to blindly allow if user has access to quote, but RLS works row-by-row)
-- Quote Items don't have tenant_id in my schema above. Let's rely on quote_id link.
-- TO BE SAFE: Add tenant_id to quote_items OR use EXISTS query.
-- Using EXISTS is slightly more expensive but cleaner schema-wise.
CREATE POLICY "Tenant isolation for quote_items" ON public.quote_items
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.tenant_id = public.get_current_tenant_id()
  )
);

-- Recurring
CREATE POLICY "Tenant isolation for recurring" ON public.recurring_services
USING (tenant_id = public.get_current_tenant_id());

-- ==========================================
-- SEED DATA (OPTIONAL)
-- ==========================================
-- Insert a default tenant and plan if empty
INSERT INTO public.saas_plans (name, price, features, allowed_modules)
VALUES ('Starter', 0, '["basic"]', '["tasks", "finance"]')
ON CONFLICT DO NOTHING;

-- Note: Tenants are usually created via signup flow.
