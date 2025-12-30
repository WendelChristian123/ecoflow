
-- ==============================================================================
-- MIGRATION: RECURRING CONTRACTS GENERATION TRIGGER
-- DESCRIPTION: Auto-generates future transactions (installments) when a recurring service is created.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_recurring_service()
RETURNS TRIGGER AS $$
DECLARE
    v_months int;
    v_limit int;
    v_due_date timestamptz;
    v_category_id uuid;
    v_account_id uuid;
    v_description text;
    v_contact_name text;
    i int;
BEGIN
    -- 1. Determine number of months to generate
    -- If contract_months is NULL (indefinite), generate 12 months.
    -- Otherwise use contract_months.
    v_months := COALESCE(NEW.contract_months, 12);
    
    -- Safety limit for bulk generation (e.g. max 60 months just in case)
    IF v_months > 60 THEN v_months := 60; END IF;

    -- 2. Find Category and Account (Reusing logic for robustness)
    -- Find 'Recorrência' or 'Receita de Vendas'
    SELECT id INTO v_category_id FROM public.financial_categories
    WHERE tenant_id = NEW.tenant_id AND name ILIKE '%Recorrência%' LIMIT 1;

    IF v_category_id IS NULL THEN
        SELECT id INTO v_category_id FROM public.financial_categories
        WHERE tenant_id = NEW.tenant_id AND name ILIKE 'Receita de Vendas' LIMIT 1;
    END IF;
    
    -- If still null, create default
    IF v_category_id IS NULL THEN
        INSERT INTO public.financial_categories (id, name, type, color, tenant_id)
        VALUES (gen_random_uuid(), 'Receita Recorrente', 'income', '#8b5cf6', NEW.tenant_id)
        RETURNING id INTO v_category_id;
    END IF;

    -- Find Account
    SELECT id INTO v_account_id FROM public.financial_accounts
    WHERE tenant_id = NEW.tenant_id AND type = 'checking' LIMIT 1;
    
    IF v_account_id IS NULL THEN
        INSERT INTO public.financial_accounts (id, name, type, initial_balance, tenant_id)
        VALUES (gen_random_uuid(), 'Conta Principal', 'checking', 0, NEW.tenant_id)
        RETURNING id INTO v_account_id;
    END IF;

    -- Get Contact Name for description
    SELECT name INTO v_contact_name FROM public.contacts WHERE id = NEW.contact_id;
    IF v_contact_name IS NULL THEN v_contact_name := 'Cliente'; END IF;

    -- 3. Loop and Generate Transactions
    FOR i IN 0..(v_months - 1) LOOP
        -- Calculate Due Date: start_date + i months
        v_due_date := NEW.start_date + (i || ' months')::interval;
        
        -- Description
        v_description := 'Mensalidade ' || (i + 1) || '/' || (CASE WHEN NEW.contract_months IS NULL THEN '∞' ELSE NEW.contract_months::text END) || ' - ' || v_contact_name;

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
            contact_id,
            tenant_id,
            installment_index,
            total_installments
        ) VALUES (
            v_description,
            NEW.recurring_amount,
            'income',
            v_due_date,
            false, -- Pending
            v_account_id,
            v_category_id,
            'recurring',
            NEW.id,
            NEW.contact_id,
            NEW.tenant_id,
            i + 1,
            NEW.contract_months
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_recurring_service_created ON public.recurring_services;

-- Create Trigger
CREATE TRIGGER on_recurring_service_created
AFTER INSERT ON public.recurring_services
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_recurring_service();
