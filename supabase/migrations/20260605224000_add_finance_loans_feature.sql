-- Adiciona a funcionalidade de "Dívidas e Empréstimos" à tabela do sistema.
INSERT INTO public.app_features (id, module_id, name, status) 
VALUES ('finance_loans', 'mod_finance', 'Dívidas e Empréstimos', 'active')
ON CONFLICT (id) DO NOTHING;
