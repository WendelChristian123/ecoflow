import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Company } from '../types';
import { useAuth } from './AuthContext';

interface CompanyContextType {
    currentCompany: Company | null;
    availableCompanies: Company[];
    loading: boolean;
    switchCompany: (companyId: string) => Promise<void>;
    refreshCompanies: () => Promise<void>;
    isMultiCompany: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Force HMR Update
    const { user, loading: authLoading } = useAuth();
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const mounted = useRef(true);

    const isSuperAdmin = (user as any)?.role === 'super_admin';

    useEffect(() => {
        mounted.current = true;

        if (authLoading) return;

        if (!user) {
            setAvailableCompanies([]);
            setCurrentCompany(null);
            setLoading(false);
            return;
        }

        const initCompany = async () => {
            try {
                let targetId = localStorage.getItem('ecoflow-mock-company-id');

                // Se não tiver seleção salva OU não for super admin, usa a empresa real do usuário
                if (!targetId || !isSuperAdmin) {
                    targetId = (user as any).companyId || localStorage.getItem('ecoflow-company-id');
                }

                // Fallback para Super Admin se nada estiver selecionado
                // Assuming '00000000-0000-0000-0000-000000000001' is still the default company ID
                if (!targetId && isSuperAdmin) targetId = '00000000-0000-0000-0000-000000000001';

                // Carrega a lista de empresas do usuário
                let allCompanies = [];
                if (isSuperAdmin) {
                    allCompanies = await api.adminListCompanies().catch(e => { console.warn(e); return []; });
                } else {
                    allCompanies = await api.getMyCompanies().catch(e => { console.warn(e); return []; });
                }

                if (mounted.current) setAvailableCompanies(allCompanies);

                // Auto-select first company if targetId is still missing
                if (!targetId && allCompanies.length > 0) {
                    targetId = allCompanies[0].id;
                }

                // GARANTIA: Sincroniza o ID usado pela API
                if (targetId) localStorage.setItem('ecoflow-company-id', targetId);

                if (targetId) {
                    try {
                        const company = await api.getCompanyById(targetId);
                        if (mounted.current && company) {
                            // Avoid unnecessary updates if same company
                            setCurrentCompany(prev => {
                                if (prev?.id === company.id && prev?.name === company.name) return prev;
                                return company;
                            });
                        }
                    } catch (e) {
                        console.warn("Company load failed", e);
                    }
                }

            } catch (err) {
                console.error("Company Init Error", err);
            } finally {
                if (mounted.current) setLoading(false);
            }
        };

        initCompany();

        return () => {
            mounted.current = false;
        };
    }, [user, authLoading, isSuperAdmin]);

    const switchCompany = async (companyId: string) => {
        // removed if (!isSuperAdmin) return;

        setLoading(true); // Exibe loading visual durante a troca

        try {
            // 1. Atualiza persistência
            localStorage.setItem('ecoflow-mock-company-id', companyId);
            localStorage.setItem('ecoflow-company-id', companyId); // CRUCIAL para a API pegar a empresa certa

            // 1.5. Sincronização global removida para manter isolamento (Web vs App)

            // 2. Busca dados da nova empresa
            const company = await api.getCompanyById(companyId);

            if (company) {
                setCurrentCompany(company);
                // Refresh forçado para garantir que todos os contextos (RBAC, Auth)
                // e listagens busquem os dados corretos da nova empresa
                window.location.reload();
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Erro ao trocar empresa:", error);
            alert("Não foi possível acessar esta empresa.");
            setLoading(false);
        }
    };

    const refreshCompanies = async () => {
        if (isSuperAdmin) {
            try {
                const allCompanies = await api.adminListCompanies();
                if (mounted.current) setAvailableCompanies(allCompanies);
            } catch (e) { console.error(e); }
        } else {
            try {
                const allCompanies = await api.getMyCompanies();
                if (mounted.current) setAvailableCompanies(allCompanies);
            } catch (e) { console.error(e); }
        }
        if (currentCompany) {
            try {
                const updated = await api.getCompanyById(currentCompany.id);
                if (mounted.current && updated) setCurrentCompany(updated);
            } catch (e) { console.error(e); }
        }
    };

    const value = React.useMemo(() => ({
        currentCompany,
        availableCompanies,
        loading,
        switchCompany,
        refreshCompanies,
        isMultiCompany: isSuperAdmin || availableCompanies.length > 1
    }), [currentCompany, availableCompanies, loading, isSuperAdmin]);

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
};

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
};
