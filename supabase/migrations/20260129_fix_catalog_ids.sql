-- FIX CATALOG IDS TO MATCH FRONTEND CONSTANTS
-- The previous seed used 'clean' IDs (e.g., 'finance'), but the App and Plans use legacy IDs (e.g., 'mod_finance').
-- This mismatch causes the Landing Page to show modules as "Unavailable" because the IDs don't match.
-- We will replace the Catalog data with the exact structure from `constants.ts`.

-- 1. Clean up existing mismatched data (Cascade deletes features)
TRUNCATE TABLE public.app_features CASCADE;
DELETE FROM public.app_modules;

-- 2. Insert Modules (Matching constants.ts)
INSERT INTO public.app_modules (id, name, category, description, status) VALUES
('mod_tasks', 'Rotinas & Execução', 'Core', 'Gestão completa de tarefas e projetos', 'active'),
('mod_finance', 'Gestão Financeira', 'Financeiro', 'Controle total das finanças e lançamentos', 'active'),
('mod_commercial', 'Gestão Comercial', 'Vendas', 'CRM, Contratos e Orçamentos', 'active'),
('mod_reports', 'Relatórios Avançados', 'Analytics', 'DRE, Fluxo de Caixa e relatórios gerenciais', 'active'),
('mod_api', 'API Pública', 'Dev', 'Gestão de Chaves, Webhooks e Documentação', 'active');

-- 3. Insert Features (Matching constants.ts)
INSERT INTO public.app_features (id, module_id, name, status) VALUES
-- Rotinas (mod_tasks)
('tasks_overview', 'mod_tasks', 'Visão Geral', 'active'),
('tasks_list', 'mod_tasks', 'Tarefas', 'active'),
('tasks_projects', 'mod_tasks', 'Projetos', 'active'),
('tasks_teams', 'mod_tasks', 'Equipes', 'active'),
('tasks_calendar', 'mod_tasks', 'Agenda', 'active'),

-- Financeiro (mod_finance)
('finance_overview', 'mod_finance', 'Visão Geral', 'active'),
('finance_transactions', 'mod_finance', 'Lançamentos', 'active'),
('finance_banking', 'mod_finance', 'Contas e Bancos', 'active'),
('finance_categories', 'mod_finance', 'Categorias', 'active'),
('finance_cards', 'mod_finance', 'Cartões', 'active'),

-- Comercial (mod_commercial)
('crm_overview', 'mod_commercial', 'Visão Geral', 'active'),
('crm_contacts', 'mod_commercial', 'Contatos', 'active'),
('crm_budgets', 'mod_commercial', 'Orçamento', 'active'),
('crm_contracts', 'mod_commercial', 'Contratos', 'active'),
('crm_catalogs', 'mod_commercial', 'Catálogos', 'active'),

-- Relatórios (mod_reports)
('reports_dre', 'mod_reports', 'DRE Gerencial', 'active'),
('reports_cashflow', 'mod_reports', 'Fluxo de Caixa', 'active'),
('reports_sales', 'mod_reports', 'Performance de Vendas', 'active'),
('reports_export', 'mod_reports', 'Exportação em Excel', 'active'),

-- API (mod_api)
('api_keys', 'mod_api', 'Gestão de Chaves (API Keys)', 'active'),
('api_webhooks', 'mod_api', 'Webhooks', 'active'),
('api_docs', 'mod_api', 'Documentação', 'active'),
('api_limiting', 'mod_api', 'Rate Limiting', 'active');

-- 4. Re-apply Permissions (Just in case)
GRANT SELECT ON public.app_modules TO anon, authenticated;
GRANT SELECT ON public.app_features TO anon, authenticated;
