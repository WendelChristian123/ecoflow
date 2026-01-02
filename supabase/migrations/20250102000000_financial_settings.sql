-- Migration to add settings column to tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN tenants.settings IS 'Stores tenant-level configurations like financial rules (credit_card_expense_mode)';
