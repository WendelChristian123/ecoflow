CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id),
    type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
    principal_amount NUMERIC NOT NULL DEFAULT 0,
    installments_count INTEGER NOT NULL DEFAULT 1,
    installment_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    interest_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    first_due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company isolation for loans" ON public.loans;

CREATE POLICY "Company isolation for loans" 
    ON public.loans 
    FOR ALL 
    USING (company_id = get_current_company_id());
