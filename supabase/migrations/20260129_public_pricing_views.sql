-- 0. ENRICH SCHEMA: Add missing columns for Frontend Display
-- The base tables app_modules and app_features were minimal.
-- We need to add fields used by the Landing Page.

-- app_modules: Add category and status
ALTER TABLE public.app_modules 
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- app_features: Add description and status
ALTER TABLE public.app_features 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 0.1 SEED DATA UPDATES (Populate new columns)
-- Finance
UPDATE public.app_modules SET category = 'Financeiro', description = 'Controle total das finanças' WHERE id = 'finance';
-- Routines
UPDATE public.app_modules SET category = 'Rotinas', description = 'Organização e produtividade' WHERE id = 'routines';
-- Commercial
UPDATE public.app_modules SET category = 'Comercial', description = 'Vendas e CRM' WHERE id = 'commercial';

-- 1. VIEW: Public SaaS Plans
-- Exposes only safe fields for active, public plans.
CREATE OR REPLACE VIEW public_saas_plans AS
SELECT 
    id, 
    name, 
    price_monthly, 
    price_semiannually, 
    price_yearly, 
    max_users, 
    allowed_modules, 
    features
FROM 
    saas_plans
WHERE 
    status = 'active' AND type = 'public';

-- 2. VIEW: Public App Modules
-- Exposes active modules with their new category field.
CREATE OR REPLACE VIEW public_app_modules AS
SELECT 
    id, 
    name, 
    category, 
    description
FROM 
    app_modules
WHERE 
    status = 'active';

-- 3. VIEW: Public App Features
CREATE OR REPLACE VIEW public_app_features AS
SELECT 
    id, 
    module_id, 
    name,
    description
FROM 
    app_features
WHERE 
    status = 'active';

-- 4. PERMISSIONS (Grant Access to Public Views)
GRANT SELECT ON public_saas_plans TO anon, authenticated;
GRANT SELECT ON public_app_modules TO anon, authenticated;
GRANT SELECT ON public_app_features TO anon, authenticated;

-- 5. RLS POLICIES (Updates)
-- Ensure selecting from the underlying tables is allowed if RLS is on.

-- saas_plans
DROP POLICY IF EXISTS "Public Read Active Plans" ON saas_plans;
CREATE POLICY "Public Read Active Plans" ON saas_plans
FOR SELECT TO anon, authenticated
USING (status = 'active' AND type = 'public');

-- app_modules
DROP POLICY IF EXISTS "Public Read Active Modules" ON app_modules;
CREATE POLICY "Public Read Active Modules" ON app_modules
FOR SELECT TO anon, authenticated
USING (status = 'active');

-- app_features
DROP POLICY IF EXISTS "Public Read Active Features" ON app_features;
CREATE POLICY "Public Read Active Features" ON app_features
FOR SELECT TO anon, authenticated
USING (status = 'active');
