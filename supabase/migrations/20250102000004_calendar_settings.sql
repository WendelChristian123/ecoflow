ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS calendar_settings jsonb 
DEFAULT '{"commitments":true,"tasks":true,"financial":{"enabled":true,"budgets":true,"receivable":true,"payable":true,"credit_card":true}}'::jsonb;
