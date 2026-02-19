
export const PLANS = [
    {
        id: 'start',
        name: 'Start',
        description: 'Ideal para quem está começando',
        prices: {
            monthly: 47.00,
            semiannual: 42.90, // preço mensal no plano semestral
            annual: 39.90,     // preço mensal no plano anual
        },
        benefits: [
            'Até 2 usuários',
            'Gestão de Leads Básica',
            'Dashboard Financeiro',
            'Suporte por Email'
        ]
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'Para empresas em crescimento',
        prices: {
            monthly: 97.00,
            semiannual: 87.90,
            annual: 79.90,
        },
        popular: true,
        benefits: [
            'Até 5 usuários',
            'Automação de Marketing',
            'CRM Avançado',
            'Relatórios Personalizados',
            'Suporte Prioritário'
        ]
    },
    {
        id: 'expert',
        name: 'Expert',
        description: 'Solução completa para grandes times',
        prices: {
            monthly: 197.00,
            semiannual: 177.90,
            annual: 159.90,
        },
        benefits: [
            'Usuários Ilimitados',
            'API Aberta',
            'Gestão Multi-CNPJ',
            'Gerente de Conta Dedicado',
            'Onboarding Personalizado'
        ]
    }
];
