-- Add multi-cycle pricing to saas_plans
ALTER TABLE saas_plans 
ADD COLUMN IF NOT EXISTS price_monthly numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_semiannually numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_yearly numeric DEFAULT 0;

-- Add subscription control columns to tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS subscription_end timestamp with time zone;
