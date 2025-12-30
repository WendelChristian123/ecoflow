
-- ==============================================================================
-- MIGRATION: SECURITY HARDENING & COMMERCIAL AUTOMATION
-- DESCRIPTION: Enforces strict tenant isolation on INSERT/UPDATE and adds Quote->Finance trigger.
-- ==============================================================================

-- 1. SECURITY HARDENING (RLS WITH CHECK)
-- Recreate policies to ensure users cannot insert data into other tenants.

-- Helper macro-like approach: We will Drop and Recreate policies.

-- Teams
DROP POLICY IF EXISTS "Tenant isolation for teams" ON public.teams;
CREATE POLICY "Tenant isolation for teams" ON public.teams
USING (tenant_id = public.get_current_tenant_id() OR is_super_admin())
WITH CHECK (tenant_id = public.get_current_tenant_id() OR is_super_admin());

-- Projects
DROP POLICY IF EXISTS "Tenant isolation for projects" ON public.projects;
CREATE POLICY "Tenant isolation for projects" ON public.projects
USING (tenant_id = public.get_current_tenant_id() OR is_super_admin())
WITH CHECK (tenant_id = public.get_current_tenant_id() OR is_super_admin());

-- Tasks
DROP POLICY IF EXISTS "Tenant isolation for tasks" ON public.tasks;
CREATE POLICY "Tenant isolation for tasks" ON public.tasks
USING (tenant_id = public.get_current_tenant_id() OR is_super_admin())
WITH CHECK (tenant_id = public.get_current_tenant_id() OR is_super_admin());

-- Calendar
DROP POLICY IF EXISTS "Tenant isolation for events" ON public.calendar_events;
CREATE POLICY "Tenant isolation for events" ON public.calendar_events
USING (tenant_id = public.get_current_tenant_id() OR is_super_admin())
WITH CHECK (tenant_id = public.get_current_tenant_id() OR is_super_admin());

-- Financial Accounts
DROP POLICY IF EXISTS "Tenant isolation for accounts" ON public.financial_accounts;
CREATE POLICY "Tenant isolation for accounts" ON public.financial_accounts
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Financial Categories
DROP POLICY IF EXISTS "Tenant isolation for categories" ON public.financial_categories;
CREATE POLICY "Tenant isolation for categories" ON public.financial_categories
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Credit Cards
DROP POLICY IF EXISTS "Tenant isolation for cards" ON public.credit_cards;
CREATE POLICY "Tenant isolation for cards" ON public.credit_cards
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Transactions
DROP POLICY IF EXISTS "Tenant isolation for transactions" ON public.financial_transactions;
CREATE POLICY "Tenant isolation for transactions" ON public.financial_transactions
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Contacts
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON public.contacts;
CREATE POLICY "Tenant isolation for contacts" ON public.contacts
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Catalog
DROP POLICY IF EXISTS "Tenant isolation for catalog" ON public.catalog_items;
CREATE POLICY "Tenant isolation for catalog" ON public.catalog_items
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Quotes
DROP POLICY IF EXISTS "Tenant isolation for quotes" ON public.quotes;
CREATE POLICY "Tenant isolation for quotes" ON public.quotes
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Recurring Services
DROP POLICY IF EXISTS "Tenant isolation for recurring" ON public.recurring_services;
CREATE POLICY "Tenant isolation for recurring" ON public.recurring_services
USING (tenant_id = public.get_current_tenant_id())
WITH CHECK (tenant_id = public.get_current_tenant_id());


-- 2. COMMERCIAL AUTOMATION (TRIGGER)
-- Logic: When Quote status becomes 'approved', create a Financial Transaction.

CREATE OR REPLACE FUNCTION public.handle_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_category_id uuid;
    v_account_id uuid;
    v_description text;
BEGIN
    -- Only proceed if status changed to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- 1. Find or Create Category 'Receita de Vendas'
        SELECT id INTO v_category_id FROM public.financial_categories 
        WHERE tenant_id = NEW.tenant_id AND name ILIKE 'Receita de Vendas' LIMIT 1;
        
        IF v_category_id IS NULL THEN
            INSERT INTO public.financial_categories (id, name, type, color, tenant_id)
            VALUES (gen_random_uuid(), 'Receita de Vendas', 'income', '#10b981', NEW.tenant_id)
            RETURNING id INTO v_category_id;
        END IF;

        -- 2. Find a Default Account (First 'checking' account found)
        SELECT id INTO v_account_id FROM public.financial_accounts
        WHERE tenant_id = NEW.tenant_id AND type = 'checking' LIMIT 1;
        
        -- If no account exists, create one
        IF v_account_id IS NULL THEN
            INSERT INTO public.financial_accounts (id, name, type, initial_balance, tenant_id)
            VALUES (gen_random_uuid(), 'Conta Principal', 'checking', 0, NEW.tenant_id)
            RETURNING id INTO v_account_id;
        END IF;

        -- 3. Determine Description
        -- Use customer name or contact name if available
        v_description := 'Venda Aprovada';
        IF NEW.customer_name IS NOT NULL THEN
            v_description := v_description || ' - ' || NEW.customer_name;
        END IF;

        -- 4. Create Transaction
        INSERT INTO public.financial_transactions (
            description,
            amount,
            type,
            date,
            is_paid,
            account_id,
            category_id,
            origin_type,
            origin_id,
            tenant_id
        ) VALUES (
            v_description,
            NEW.total_value,
            'income', -- Receita
            NOW(),
            false, -- Pendente por padrão
            v_account_id,
            v_category_id,
            'quote',
            NEW.id,
            NEW.tenant_id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_quote_approve ON public.quotes;

CREATE TRIGGER on_quote_approve
AFTER UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.handle_quote_approval();

