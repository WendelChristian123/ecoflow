
export const SYSTEM_MODULES = [
    {
        id: 'mod_tasks',
        name: 'Rotinas & Execução',
        category: 'Core',
        mandatory: true,
        features: [
            { id: 'tasks_overview', name: 'Visão Geral' },
            { id: 'tasks_list', name: 'Tarefas' },
            { id: 'tasks_projects', name: 'Projetos' },
            { id: 'tasks_teams', name: 'Equipes' },
            { id: 'tasks_calendar', name: 'Agenda' }
        ]
    },
    {
        id: 'mod_finance',
        name: 'Gestão Financeira',
        category: 'Financeiro',
        features: [
            { id: 'finance_overview', name: 'Visão Geral' },
            { id: 'finance_transactions', name: 'Lançamentos' },
            { id: 'finance_banking', name: 'Contas e Bancos' },
            { id: 'finance_categories', name: 'Categorias' },
            { id: 'finance_cards', name: 'Cartões' }
        ]
    },
    {
        id: 'mod_commercial',
        name: 'Gestão Comercial',
        category: 'Vendas',
        features: [
            { id: 'crm_overview', name: 'Visão Geral' },
            { id: 'crm_contacts', name: 'Contatos' },
            { id: 'crm_budgets', name: 'Orçamento' },
            { id: 'crm_contracts', name: 'Contratos' },
            { id: 'crm_catalogs', name: 'Catálogos' }
        ]
    },
    {
        id: 'mod_reports',
        name: 'Relatórios Avançados',
        category: 'Analytics',
        features: [
            { id: 'reports_dre', name: 'DRE Gerencial' },
            { id: 'reports_cashflow', name: 'Fluxo de Caixa' },
            { id: 'reports_sales', name: 'Performance de Vendas' },
            { id: 'reports_export', name: 'Exportação em Excel' }
        ]
    },
    {
        id: 'mod_api',
        name: 'API Pública',
        category: 'Dev',
        features: [
            { id: 'api_keys', name: 'Gestão de Chaves (API Keys)' },
            { id: 'api_webhooks', name: 'Webhooks' },
            { id: 'api_docs', name: 'Documentação' },
            { id: 'api_limiting', name: 'Rate Limiting' }
        ]
    },
];
