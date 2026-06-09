import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';

export const DeepLinkHandler: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { switchCompany, currentCompany, loading, availableCompanies } = useCompany();

    const { user } = useAuth();

    useEffect(() => {
        // Só tenta processar deep links se o usuário estiver completamente logado
        if (!user) return;

        const targetCompanyId = searchParams.get('c');
        
        if (targetCompanyId && !loading && currentCompany?.id !== targetCompanyId) {
            
            if (availableCompanies.length > 0) {
                const hasAccess = availableCompanies.some(c => c.id === targetCompanyId);
                if (!hasAccess) {
                    alert('Você não possui mais acesso à empresa relacionada a esta notificação.');
                    // Limpa o parâmetro para não entrar em loop
                    searchParams.delete('c');
                    setSearchParams(searchParams, { replace: true });
                    return;
                }
            }
            
            switchCompany(targetCompanyId).catch(err => {
                console.error("Falha ao trocar de empresa pelo DeepLinkHandler", err);
                // Limpa o parâmetro para não ficar em loop infinito tentando trocar
                searchParams.delete('c');
                setSearchParams(searchParams, { replace: true });
            });
        }
    }, [searchParams, currentCompany, loading, availableCompanies, switchCompany, user, setSearchParams]);

    return null; // Este componente não renderiza nada visualmente
};
