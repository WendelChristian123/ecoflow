-- ==========================================
-- TRIGGER: QUOTE TO REVENUE AUTOMATION
-- ==========================================

-- Function to handle quote approval
CREATE OR REPLACE FUNCTION public.handle_quote_approval()
RETURNS trigger AS $$
BEGIN
    -- Only trigger if status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        -- Insert a new financial transaction for the revenue
        INSERT INTO public.financial_transactions (
            description,
            amount,
            gross_amount,
            type,
            date,
            is_paid,
            contact_id,
            origin_type,
            origin_id,
            company_id
        ) VALUES (
            'Fatura referente ao Orçamento ' || substring(NEW.id::text from 1 for 8),
            NEW.total_value,
            NEW.total_value,
            'income',
            COALESCE(NEW.valid_until, current_date), -- Vencimento (ou data atual)
            false,
            NEW.contact_id,
            'quote',
            NEW.id,
            NEW.company_id -- or tenant_id if schema uses tenant_id. I will use company_id as api.ts does.
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_quote_approved ON public.quotes;
CREATE TRIGGER on_quote_approved
    AFTER UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_quote_approval();
