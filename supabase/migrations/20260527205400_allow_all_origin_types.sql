ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_origin_type_check;

ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_origin_type_check 
CHECK (origin_type IN ('manual', 'quote', 'recurring', 'setup', 'technical', 'credit_card', 'loan', 'interest_link', 'cc_technical_limit_release', 'loan_setup'));
