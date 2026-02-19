-- Migration: Asaas Integration Tables
-- Description: Creates tables for companies, plans, subscriptions, payments, and logs for Asaas integration. Includes RLS policies.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Companies
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id),
    legal_name TEXT NOT NULL,
    cpf_cnpj TEXT NOT NULL, -- Numeric only, sanitized
    whatsapp TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for RLS and lookups
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_cpf_cnpj ON public.companies(cpf_cnpj);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email ON public.companies(email);


-- 2. Company Addresses
CREATE TABLE IF NOT EXISTS public.company_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    postal_code TEXT NOT NULL,
    address TEXT NOT NULL,
    address_number TEXT NOT NULL,
    complement TEXT,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_company_addresses_company_id ON public.company_addresses(company_id);


-- 3. Plans (Catalog)
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY, -- 'starter', 'pro', etc.
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. Plan Prices (Catalog)
CREATE TABLE IF NOT EXISTS public.plan_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    cycle TEXT NOT NULL CHECK (cycle IN ('monthly', 'semiannual', 'annual')),
    amount NUMERIC(12,2) NOT NULL,
    installment_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_id, cycle)
);


-- 5. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id),
    cycle TEXT NOT NULL CHECK (cycle IN ('monthly', 'semiannual', 'annual')),
    billing_type TEXT NOT NULL CHECK (billing_type IN ('credit_card', 'pix')),
    status TEXT NOT NULL CHECK (status IN ('trialing', 'pending_payment', 'active', 'overdue', 'cancel_requested', 'canceled', 'suspended')),
    
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    access_until TIMESTAMPTZ, -- Derived logical access expiration
    
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    
    asaas_customer_id TEXT,
    asaas_subscription_id TEXT,
    
    next_billing_at TIMESTAMPTZ,
    last_asaas_event_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_ids ON public.subscriptions(asaas_customer_id, asaas_subscription_id);


-- 6. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id),
    
    asaas_payment_id TEXT UNIQUE,
    billing_type TEXT CHECK (billing_type IN ('credit_card', 'pix')),
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'failed', 'canceled')),
    
    due_date DATE,
    paid_at TIMESTAMPTZ,
    
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    invoice_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_asaas_payment_id ON public.payments(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);


-- 7. Subscription Changes (Upgrade/Downgrade Logs)
CREATE TABLE IF NOT EXISTS public.subscription_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    from_subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
    to_plan_id TEXT NOT NULL REFERENCES public.plans(id),
    to_cycle TEXT NOT NULL CHECK (to_cycle IN ('monthly', 'semiannual', 'annual')),
    change_type TEXT NOT NULL CHECK (change_type IN ('upgrade', 'downgrade')),
    
    proration_amount NUMERIC(12,2) DEFAULT 0,
    effective_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'processing', 'done', 'failed')),
    
    asaas_payment_id TEXT, -- If charge was generated
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_changes_company_id ON public.subscription_changes(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_status ON public.subscription_changes(status);


-- 8. Asaas Events (Idempotency)
CREATE TABLE IF NOT EXISTS public.asaas_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE, -- Asaas Event ID for idempotency checks
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW()
);


-- --- RLS POLICIES ---

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_events ENABLE ROW LEVEL SECURITY;

-- 1. Companies: Users can only see their own company
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
CREATE POLICY "Users can view own company" ON public.companies
    FOR SELECT USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update own company" ON public.companies;
CREATE POLICY "Users can update own company" ON public.companies
    FOR UPDATE USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Service Role can manage all companies" ON public.companies;
CREATE POLICY "Service Role can manage all companies" ON public.companies
    FOR ALL USING (auth.role() = 'service_role');
    
-- 2. Addresses: Users can view addresses of their own company
DROP POLICY IF EXISTS "Users can view own company addresses" ON public.company_addresses;
CREATE POLICY "Users can view own company addresses" ON public.company_addresses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = company_addresses.company_id AND c.owner_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own company addresses" ON public.company_addresses;
CREATE POLICY "Users can update own company addresses" ON public.company_addresses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = company_addresses.company_id AND c.owner_user_id = auth.uid()
        )
    );
    
-- 3. Plans & Prices: Public Read (or Authenticated Read), No Write for users
DROP POLICY IF EXISTS "Public read plans" ON public.plans;
CREATE POLICY "Public read plans" ON public.plans
    FOR SELECT USING (true);
    
DROP POLICY IF EXISTS "Public read plan prices" ON public.plan_prices;
CREATE POLICY "Public read plan prices" ON public.plan_prices
    FOR SELECT USING (true);
    
-- 4. Subscriptions: Users can view their own subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = subscriptions.company_id AND c.owner_user_id = auth.uid()
        )
    );

-- 5. Payments: Users can view their own payments
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = payments.company_id AND c.owner_user_id = auth.uid()
        )
    );

-- 6. Subscription Changes: Users can view their own changes
DROP POLICY IF EXISTS "Users can view own subscription changes" ON public.subscription_changes;
CREATE POLICY "Users can view own subscription changes" ON public.subscription_changes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = subscription_changes.company_id AND c.owner_user_id = auth.uid()
        )
    );

-- 7. Asaas Events: Only Service Role can access (Internal log)
DROP POLICY IF EXISTS "Service Role only events" ON public.asaas_events;
CREATE POLICY "Service Role only events" ON public.asaas_events
    FOR ALL USING (auth.role() = 'service_role');


-- --- SEED DATA (Planos e Preços Fixos) ---
-- Insert Plans
INSERT INTO public.plans (id, name) VALUES
('starter', 'Starter'),
('pro', 'Pro')
ON CONFLICT (id) DO NOTHING;

-- Insert Prices (Starter)
INSERT INTO public.plan_prices (plan_id, cycle, amount, installment_count) VALUES
('starter', 'monthly', 47.00, 1),
('starter', 'semiannual', 257.40, 6),
('starter', 'annual', 478.80, 12)
ON CONFLICT (plan_id, cycle) DO UPDATE 
SET amount = EXCLUDED.amount, installment_count = EXCLUDED.installment_count;

-- Insert Prices (Pro)
INSERT INTO public.plan_prices (plan_id, cycle, amount, installment_count) VALUES
('pro', 'monthly', 97.00, 1),
('pro', 'semiannual', 527.40, 6),
('pro', 'annual', 958.80, 12)
ON CONFLICT (plan_id, cycle) DO UPDATE 
SET amount = EXCLUDED.amount, installment_count = EXCLUDED.installment_count;


-- Function for Updated At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_addresses_updated_at ON public.company_addresses;
CREATE TRIGGER update_company_addresses_updated_at BEFORE UPDATE ON public.company_addresses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON public.plans;
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_plan_prices_updated_at ON public.plan_prices;
CREATE TRIGGER update_plan_prices_updated_at BEFORE UPDATE ON public.plan_prices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_changes_updated_at ON public.subscription_changes;
CREATE TRIGGER update_subscription_changes_updated_at BEFORE UPDATE ON public.subscription_changes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
