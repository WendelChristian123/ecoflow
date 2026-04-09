ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS gross_amount NUMERIC DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
