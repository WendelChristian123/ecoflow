
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api, getErrorMessage } from '../services/api';
import { Tenant } from '../types';
import { useAuth } from './AuthContext';

interface TenantContextType {
    currentTenant: Tenant | null;
    availableTenants: Tenant[];
    loading: boolean;
    switchTenant: (tenantId: string) => Promise<void>;
    refreshTenants: () => Promise<void>;
    isMultiTenant: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
    const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const mounted = useRef(true);

    const isSuperAdmin = (user as any)?.role === 'super_admin';

    useEffect(() => {
        mounted.current = true;
        
        if (authLoading) return;

        if (!user) {
            setAvailableTenants([]);
            setCurrentTenant(null);
            setLoading(false);
            return;
        }

        const initTenant = async () => {
            try {
                let targetId = localStorage.getItem('ecoflow-mock-tenant-id');
                
                // Se não tiver seleção salva OU não for super admin, usa o tenant real do usuário
                if (!targetId || !isSuperAdmin) {
                    targetId = (user as any).tenantId;
                }
                
                // Fallback para Super Admin se nada estiver selecionado
                if (!targetId && isSuperAdmin) targetId = 'tenant-1'; 

                // GARANTIA: Sincroniza o ID usado pela API
                if (targetId) localStorage.setItem('ecoflow-tenant-id', targetId);

                if (targetId) {
                    try {
                        const tenant = await api.getTenantById(targetId);
                        if (mounted.current && tenant) {
                            setCurrentTenant(tenant);
                            // Para usuários normais, a lista disponível é apenas a própria empresa
                            if (!isSuperAdmin) {
                                setAvailableTenants([tenant]);
                            }
                        }
                    } catch (e) {
                        console.warn("Tenant load failed", e);
                    }
                } 
                
                // Super Admin carrega TODAS as empresas em background
                if (isSuperAdmin) {
                    api.adminListTenants().then(all => {
                        if (mounted.current) setAvailableTenants(all);
                    }).catch(console.warn);
                }

            } catch (err) {
                console.error("Tenant Init Error", err);
            } finally {
                if (mounted.current) setLoading(false);
            }
        };

        initTenant();

        return () => {
            mounted.current = false;
        };
    }, [user, authLoading, isSuperAdmin]);

    const switchTenant = async (tenantId: string) => {
        if (!isSuperAdmin) return;
        
        setLoading(true); // Exibe loading visual durante a troca
        
        try {
            // 1. Atualiza persistência
            localStorage.setItem('ecoflow-mock-tenant-id', tenantId);
            localStorage.setItem('ecoflow-tenant-id', tenantId); // CRUCIAL para a API pegar o tenant certo

            // 2. Busca dados da nova empresa
            const tenant = await api.getTenantById(tenantId);
            
            if (tenant) {
                setCurrentTenant(tenant);
                // Não precisamos recarregar a página (SPA), o React atualizará os componentes dependentes
            }
        } catch (error) {
            console.error("Erro ao trocar empresa:", error);
            alert("Não foi possível acessar esta empresa.");
        } finally {
            setLoading(false);
        }
    };

    const refreshTenants = async () => {
        if (isSuperAdmin) {
            try {
                const allTenants = await api.adminListTenants();
                if (mounted.current) setAvailableTenants(allTenants);
            } catch (e) { console.error(e); }
        }
        if (currentTenant) {
            try {
                const updated = await api.getTenantById(currentTenant.id);
                if (mounted.current && updated) setCurrentTenant(updated);
            } catch (e) { console.error(e); }
        }
    };

    return (
        <TenantContext.Provider value={{ 
            currentTenant, 
            availableTenants, 
            loading, 
            switchTenant,
            refreshTenants,
            isMultiTenant: isSuperAdmin
        }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
