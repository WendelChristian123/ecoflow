import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';

export const DeepLinkHandler: React.FC = () => {
    const [searchParams] = useSearchParams();
    const { switchCompany, currentCompany, loading, availableCompanies } = useCompany();

    useEffect(() => {
        const targetCompanyId = searchParams.get('c');
        
        // Se temos um alvo, não estamos carregando, e a empresa atual é diferente da alvo
        if (targetCompanyId && !loading && currentCompany?.id !== targetCompanyId) {
            
            // Opcional: Verificar se o usuário tem acesso à empresa antes de tentar trocar
            // Se availableCompanies.length > 0 e a empresa não estiver na lista, 
            // a API do backend provavelmente retornará erro, mas podemos alertar preventivamente.
            if (availableCompanies.length > 0) {
                const hasAccess = availableCompanies.some(c => c.id === targetCompanyId);
                if (!hasAccess) {
                    alert('Você não possui mais acesso à empresa relacionada a esta notificação.');
                    return;
                }
            }
            
            switchCompany(targetCompanyId).catch(err => {
                console.error("Falha ao trocar de empresa pelo DeepLinkHandler", err);
                alert('Não foi possível acessar a empresa desta notificação.');
            });
        }
    }, [searchParams, currentCompany, loading, availableCompanies, switchCompany]);

    return null; // Este componente não renderiza nada visualmente
};
