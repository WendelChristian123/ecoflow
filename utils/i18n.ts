
export const translateFrequency = (frequency: string | undefined): string => {
    if (!frequency) return '---';
    const map: Record<string, string> = {
        'daily': 'Diário',
        'weekly': 'Semanal',
        'monthly': 'Mensal',
        'yearly': 'Anual'
    };
    return map[frequency.toLowerCase()] || frequency;
};

export const translateRecurringStatus = (active: boolean): string => {
    return active ? 'Ativo' : 'Inativo';
};

export const translateCatalogType = (type: string | undefined): string => {
    if (!type) return '---';
    const map: Record<string, string> = {
        'product': 'Produto',
        'service': 'Serviço'
    };
    return map[type.toLowerCase()] || type;
};

export const translateQuoteStatus = (status: string | undefined): string => {
    if (!status) return '---';
    const map: Record<string, string> = {
        'draft': 'Rascunho',
        'sent': 'Enviado',
        'approved': 'Aprovado',
        'rejected': 'Rejeitado',
        'expired': 'Expirado'
    };
    return map[status.toLowerCase()] || status;
};

export const translateContactScope = (scope: string | undefined): string => {
    if (!scope) return '---';
    const map: Record<string, string> = {
        'client': 'Cliente',
        'supplier': 'Fornecedor',
        'both': 'Ambos'
    };
    return map[scope.toLowerCase()] || scope;
};

export const translatePersonType = (type: string | undefined): string => {
    if (!type) return '---';
    const map: Record<string, string> = {
        'pf': 'Pessoa Física',
        'pj': 'Pessoa Jurídica'
    };
    return map[type.toLowerCase()] || type;
};

export const translatePriority = (priority: string | undefined): string => {
    if (!priority) return '---';
    const map: Record<string, string> = {
        'low': 'Baixa',
        'medium': 'Média',
        'high': 'Alta',
        'urgent': 'Urgente'
    };
    return map[priority.toLowerCase()] || priority;
};

export const translateTaskStatus = (status: string | undefined): string => {
    if (!status) return '---';
    const map: Record<string, string> = {
        'todo': 'A Fazer',
        'in_progress': 'Em Progresso',
        'review': 'Revisão',
        'done': 'Concluído'
    };
    return map[status.toLowerCase()] || status;
};

export const translateStatus = (status: string | undefined): string => {
    if (!status) return '---';
    // Combine all status mappings for generic usage
    const map: Record<string, string> = {
        'todo': 'A Fazer',
        'in_progress': 'Em Progresso',
        'review': 'Revisão',
        'done': 'Concluído',
        'scheduled': 'Agendado',
        'completed': 'Concluído',
        'active': 'Ativo',
        'on_hold': 'Em Espera',
        'draft': 'Rascunho',
        'sent': 'Enviado',
        'approved': 'Aprovado',
        'rejected': 'Rejeitado',
        'expired': 'Expirado'
    };
    return map[status.toLowerCase()] || status;
};
