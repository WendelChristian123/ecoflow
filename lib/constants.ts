
import { AppModule } from '../types';

export const SYSTEM_MODULES: AppModule[] = [
    {
        id: 'mod_tasks',
        name: 'Rotinas & Execução',
        category: 'Core',
        description: 'Gerenciamento completo de tarefas, projetos e equipes com visão Kanban e cronograma.',
        features: [
            { id: 'tasks_overview', name: 'Visão Geral', module_id: 'mod_tasks' },
            { id: 'tasks_list', name: 'Tarefas', module_id: 'mod_tasks' },
            { id: 'tasks_projects', name: 'Projetos', module_id: 'mod_tasks' },
            { id: 'tasks_teams', name: 'Equipes', module_id: 'mod_tasks' },
            { id: 'tasks_calendar', name: 'Agenda', module_id: 'mod_tasks' }
        ]
    },
    {
        id: 'mod_finance',
        name: 'Gestão Financeira',
        category: 'Financeiro',
        description: 'Controle de fluxo de caixa, contas a pagar/receber, conciliação bancária e DRE.',
        features: [
            { id: 'finance_overview', name: 'Visão Geral', module_id: 'mod_finance' },
            { id: 'finance_transactions', name: 'Lançamentos', module_id: 'mod_finance' },
            { id: 'finance_banking', name: 'Contas e Bancos', module_id: 'mod_finance' },
            { id: 'finance_categories', name: 'Categorias', module_id: 'mod_finance' },
            { id: 'finance_cards', name: 'Cartões', module_id: 'mod_finance' }
        ]
    },
    {
        id: 'mod_commercial',
        name: 'Gestão Comercial',
        category: 'Vendas',
        description: 'CRM completo para gestão de leads, funil de vendas, orçamentos e contratos.',
        features: [
            { id: 'crm_overview', name: 'Visão Geral', module_id: 'mod_commercial' },
            { id: 'crm_contacts', name: 'Contatos', module_id: 'mod_commercial' },
            { id: 'crm_budgets', name: 'Orçamento', module_id: 'mod_commercial' },
            { id: 'crm_contracts', name: 'Contratos', module_id: 'mod_commercial' },
            { id: 'crm_catalogs', name: 'Catálogos', module_id: 'mod_commercial' }
        ]
    },
    {
        id: 'mod_reports',
        name: 'Relatórios Avançados',
        category: 'Analytics',
        description: 'Dashboards executivos, exportação de dados e análise de performance.',
        features: [
            { id: 'reports_dre', name: 'DRE Gerencial', module_id: 'mod_reports' },
            { id: 'reports_cashflow', name: 'Fluxo de Caixa', module_id: 'mod_reports' },
            { id: 'reports_sales', name: 'Performance de Vendas', module_id: 'mod_reports' },
            { id: 'reports_export', name: 'Exportação em Excel', module_id: 'mod_reports' }
        ]
    },
    {
        id: 'mod_api',
        name: 'API Pública',
        category: 'Dev',
        description: 'Acesso programático aos dados da empresa via API REST segura.',
        features: [
            { id: 'api_keys', name: 'Gestão de Chaves (API Keys)', module_id: 'mod_api' },
            { id: 'api_webhooks', name: 'Webhooks', module_id: 'mod_api' },
            { id: 'api_docs', name: 'Documentação', module_id: 'mod_api' },
            { id: 'api_limiting', name: 'Rate Limiting', module_id: 'mod_api' }
        ]
    },
];
