import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Company, SaasPlan } from '../../types';
import { maskCNPJ, maskPhone, maskCPF } from '../../utils/masks';
import { useRBAC } from '../../context/RBACContext';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { Loader, Button, Input, Card, Badge, Modal, Select, cn } from '../../components/Shared';
import { FilterSelect } from '../../components/FilterSelect';
import {
    Building2, Plus, Search, Globe, Lock, CheckCircle2, Edit2, Package, RefreshCw,
    AlertTriangle, Terminal, MoreVertical, CreditCard, PauseCircle,
    Trash2, PlayCircle, Shield, Calendar, Filter, UserCog, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SYSTEM_MODULES } from '../../lib/constants';

export const SuperAdminDashboard: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { user } = useAuth();
    const { availableCompanies, refreshCompanies, switchCompany, currentCompany } = useCompany();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [filterMetric, setFilterMetric] = useState<'all' | 'active_companies' | 'active_plans'>('all');

    const [stats, setStats] = useState({ totalCompanies: 0, activeCompanies: 0, totalUsers: 0, activePlans: 0 });

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createTab, setCreateTab] = useState<'data' | 'plans' | 'modules'>('data');
    const [newCompany, setNewCompany] = useState({
        name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active',
        planId: '', billingCycle: 'monthly', subscriptionStart: '', subscriptionEnd: ''
    });
    const [draftModules, setDraftModules] = useState<string[]>(['mod_tasks']);
    // New Granular Module State
    const [moduleConfig, setModuleConfig] = useState<Record<string, 'included' | 'locked' | 'extra'>>({});
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
    const [activeCategoryTab, setActiveCategoryTab] = useState<string>('Todos');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [userCreationError, setUserCreationError] = useState<string | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [docType, setDocType] = useState<'CNPJ' | 'CPF'>('CNPJ');

    // New Plans State
    const [availablePlans, setAvailablePlans] = useState<SaasPlan[]>([]);
    const [customLimits, setCustomLimits] = useState({ maxUsers: 5 });

    // Click outside to close menu
    React.useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/');
            return;
        }
        loadData();
    }, [isSuperAdmin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const s = await api.getGlobalStats();
            setStats(s);
            await refreshCompanies();
            const plans = await api.getSaasPlans(); // Fetch plans
            setAvailablePlans(plans.filter(p => p.status === 'active' || p.status === 'hidden'));
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleOpenCreate = () => {
        setEditingId(null);
        setNewCompany({ name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active', planId: '', billingCycle: 'monthly', subscriptionStart: '', subscriptionEnd: '' });
        setDraftModules(['mod_tasks']);
        setSelectedFeatures(new Set());
        setCustomLimits({ maxUsers: 5 });
        setTempPassword('');
        setUserCreationError(null);
        setCreateTab('data');
        setDocType('CNPJ');
        setIsModalOpen(true);
    };

    const handleEdit = (company: Company) => {
        setEditingId(company.id);
        setNewCompany({
            name: company.name,
            ownerEmail: company.ownerEmail || '',
            phone: company.phone || '',
            document: company.cnpj || '',
            adminName: company.adminName || '',
            password: '',
            status: company.status,
            planId: company.planId || 'custom',
            billingCycle: company.billingCycle || 'monthly',
            subscriptionStart: '', // Only set if creating/renewing explicitly
            subscriptionEnd: company.subscriptionEnd || ''
        });

        const baseModules = new Set<string>();
        const feats = new Set<string>();
        company.contractedModules?.forEach(m => {
            if (m.includes(':')) {
                feats.add(m);
                baseModules.add(m.split(':')[0]);
            } else {
                baseModules.add(m);
            }
        });
        setDraftModules(Array.from(baseModules));
        setSelectedFeatures(feats);

        // @ts-ignore
        const customLim = company.settings?.custom_limits?.maxUsers || company.settings?.calendar?.custom_limits?.maxUsers || 5;
        setCustomLimits({ maxUsers: customLim });

        setCreateTab('data');
        setIsModalOpen(true);
        setActiveMenuId(null);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir a empresa "${name}"? Esta ação é irreversível e apagará todos os dados.`)) return;
        try {
            await api.deleteCompany(id);
            await loadData();
        } catch (error: any) {
            alert("Erro ao excluir: " + getErrorMessage(error));
        }
        setActiveMenuId(null);
    };

    const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'TEXTAREA' && target.getAttribute('type') !== 'submit') {
                e.preventDefault();
            }
        }
    };

    const handleCreateOrUpdate = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();
        setCreating(true);
        setUserCreationError(null);

        // Validation
        if (!newCompany.name || (!editingId && !newCompany.ownerEmail)) {
            alert("Campos obrigatórios faltando.");
            setCreating(false);
            return;
        }

        try {
            const isCustom = newCompany.planId === 'custom' || !newCompany.planId;
            const customModulesPayload: Record<string, string[]> = {};
            if (isCustom) {
                draftModules.forEach(mod => {
                    const feats = Array.from<string>(selectedFeatures)
                        .filter(f => f.startsWith(mod + ':'))
                        .map(f => f.split(':')[1]);
                    customModulesPayload[mod] = feats;
                });
            }

            const payload = {
                name: newCompany.name,
                ownerEmail: newCompany.ownerEmail,
                phone: newCompany.phone,
                cnpj: newCompany.document,
                adminName: newCompany.adminName,
                status: newCompany.status,
                planId: isCustom ? null : newCompany.planId,
                billingCycle: newCompany.billingCycle,
                subscriptionStart: newCompany.subscriptionStart,
                subscriptionEnd: newCompany.subscriptionEnd,
                modules: isCustom ? [] : draftModules,
                customLimits: isCustom ? customLimits : undefined,
                customModules: isCustom ? customModulesPayload : undefined
            };

            if (editingId) {
                await api.updateCompany(editingId, payload);
            } else {
                await api.createCompany({ ...payload, password: newCompany.password });
            }
            setIsModalOpen(false);
            loadData();
            alert('Operação realizada com sucesso!');
            // Simple alert or toast if available. Since I don't see toast imported yet, I will check imports first.
            // But to be safe and quick, I can use window.alert or just rely on the list update.
            // The user said "nao teve nenhuma confirmação".
            // Let's add a simple alert for now if no toast lib found, or better, add a toast if I see one.
            // Wait, I am viewing imports in parallel.
            // I will return to this after viewing imports.
        } catch (err: any) {
            console.error(err);
            setUserCreationError(getErrorMessage(err));
        } finally {
            setCreating(false);
        }
    };

    const handleLoginAs = async (companyId: string) => {
        try {
            await switchCompany(companyId);
            // Optionally redirect to home to refresh context fully if needed, but Context switch should handle it
            // navigate('/'); 
        } catch (error) {
            console.error("Failed to switch company identity", error);
        }
        setActiveMenuId(null);
    }

    // --- Computed ---
    const filteredCompanies = availableCompanies.filter(t => {
        const matchesSearch = (t.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
            t.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ||
            t.cnpj?.includes(search);
        const matchesType = filterType === 'all' ? true : t.type === filterType;
        const matchesStatus = filterStatus === 'all' ? true : t.status === filterStatus;
        const matchesPlan = filterPlan === 'all' ? true : (t as any).planName === filterPlan; // Assuming planName is enriched in availableCompanies

        return matchesSearch && matchesType && matchesStatus && matchesPlan;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200';
            case 'suspended': return 'bg-red-100 text-red-700 border-red-200';
            case 'trial': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-6 md:space-y-8 bg-background min-h-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Super Admin</h1>
                    <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">Gerenciamento global de empresas e sistema</p>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                    <Button variant="outline" onClick={() => navigate('/super-admin/users')} className="flex-1 md:flex-none h-7 px-3 text-[10px] gap-1.5">
                        <UserCog size={14} />
                        <span className="hidden sm:inline">Usuários Globais</span>
                        <span className="sm:hidden">Usuários</span>
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/super-admin/companies')} className="flex-1 md:flex-none h-7 px-3 text-[10px] gap-1.5">
                        <Building2 size={14} />
                        <span className="hidden sm:inline">Gerenciar Detalhado</span>
                        <span className="sm:hidden">Detalhes</span>
                    </Button>
                    <Button onClick={handleOpenCreate} className="flex-1 md:flex-none h-7 px-3 text-[10px] gap-1.5">
                        <Plus size={14} />
                        <span className="hidden sm:inline">Nova Empresa</span>
                        <span className="sm:hidden">Nova</span>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <Card className="p-5 md:p-6 bg-card shadow-sm border border-border/50 relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex flex-col gap-3 relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                                <Building2 className="w-5 h-5 text-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">{stats.totalCompanies}</h3>
                            <p className="text-sm font-medium text-muted-foreground mt-1">Total Empresas</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 md:p-6 bg-card shadow-sm border border-border/50 relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex flex-col gap-3 relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">{stats.activeCompanies}</h3>
                            <p className="text-sm font-medium text-muted-foreground mt-1">Empresas Ativas</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 md:p-6 bg-card shadow-sm border border-border/50 relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex flex-col gap-3 relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="p-2.5 bg-purple-500/10 rounded-xl">
                                <UserCog className="w-5 h-5 text-purple-500" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">{stats.totalUsers}</h3>
                            <p className="text-sm font-medium text-muted-foreground mt-1">Total Usuários</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 md:p-6 bg-card shadow-sm border border-border/50 relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex flex-col gap-3 relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="p-2.5 bg-amber-500/10 rounded-xl">
                                <CreditCard className="w-5 h-5 text-amber-500" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">{stats.activePlans}</h3>
                            <p className="text-sm font-medium text-muted-foreground mt-1">Planos Ativos</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content Area */}
            <Card className="border border-border shadow-sm overflow-hidden bg-card">
                <div className="p-5 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-foreground">
                        <Building2 className="w-5 h-5" />
                        <h2 className="font-semibold">Empresas Cadastradas</h2>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 items-end lg:items-center w-full lg:w-auto">
                        <div className="relative w-full lg:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar empresa..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-10 text-sm bg-card text-foreground border-input focus:border-primary"
                            />
                        </div>
                        <div className="w-full lg:w-40">
                            <FilterSelect
                                inlineLabel="Status:"
                                value={filterStatus}
                                onChange={(val) => setFilterStatus(val)}
                                options={[
                                    { value: 'all', label: 'Todos' },
                                    { value: 'active', label: 'Ativos' },
                                    { value: 'suspended', label: 'Suspensos' },
                                    { value: 'trial', label: 'Trial' }
                                ]}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={loadData} className="h-10 bg-card hover:bg-muted text-foreground border-input">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-4 md:mx-0 bg-muted/5 p-4 md:p-6 rounded-b-xl">
                    <div className="min-w-[800px] w-full">
                        <table className="w-full text-sm text-left border-separate border-spacing-y-3">
                            <thead>
                                <tr className="text-muted-foreground text-xs uppercase font-bold tracking-wider">
                                    <th className="px-6 py-2 w-[280px]">Empresa</th>
                                    <th className="px-6 py-2 w-[120px]">Status</th>
                                    <th className="px-6 py-2 w-[150px]">Plano / Pgto</th>
                                    <th className="px-6 py-2">Módulos</th>
                                    <th className="px-6 py-2 w-[160px]">Período</th>
                                    <th className="px-6 py-2 text-right w-[100px]">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground bg-card rounded-2xl border border-border/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="p-4 bg-muted/50 rounded-full">
                                                    <Search className="w-8 h-8 text-muted-foreground" />
                                                </div>
                                                <p className="font-medium text-base">Nenhuma empresa encontrada</p>
                                                <p className="text-xs">Tente ajustar os filtros de busca.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCompanies.map((company) => (
                                        <tr key={company.id} className="group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                                            {/* Empresa */}
                                            <td className="px-6 py-4 align-middle bg-card rounded-l-2xl border-y border-l border-border/50 group-hover:border-primary/30 transition-colors">
                                                <div className="min-w-0 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                                                        <span className="font-bold text-primary text-lg">
                                                            {company.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-foreground block text-base leading-tight">{company.name}</span>
                                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 flex-wrap font-medium">
                                                            {company.cnpj && <span className="shrink-0">{company.cnpj}</span>}
                                                            {company.cnpj && company.ownerEmail && <span className="opacity-50">•</span>}
                                                            {company.ownerEmail && (
                                                                <span className="truncate max-w-[160px]">{company.ownerEmail}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Status */}
                                            <td className="px-6 py-4 align-middle bg-card border-y border-border/50 group-hover:border-primary/30 transition-colors">
                                                <Badge className={cn("px-3 py-1 font-bold text-[10px] tracking-wider rounded-full", getStatusColor(company.status))}>
                                                    {company.status === 'active' && <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />}
                                                    {company.status === 'suspended' && <PauseCircle className="w-3.5 h-3.5 mr-1 inline" />}
                                                    {company.status === 'trial' && <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />}
                                                    {company.status.toUpperCase()}
                                                </Badge>
                                            </td>
                                            {/* Plano / Pgto */}
                                            <td className="px-6 py-4 align-middle bg-card border-y border-border/50 group-hover:border-primary/30 transition-colors">
                                                <span className="font-bold text-foreground text-sm">{(company as any).planName || 'Custom'}</span>
                                                {company.billingType && (
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-medium">
                                                        <CreditCard className="w-3.5 h-3.5 text-primary/70" />
                                                        {company.billingType === 'credit_card' ? 'Cartão de Crédito' : company.billingType.toUpperCase()}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Módulos */}
                                            <td className="px-6 py-4 align-middle bg-card border-y border-border/50 group-hover:border-primary/30 transition-colors">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {company.contractedModules?.slice(0, 4).map(m => {
                                                        const moduleMap: Record<string, string> = {
                                                            'FINANCE': 'Fin', 'COMMERCIAL': 'Com', 'ROUTINES': 'Rot', 'REPORTS': 'Rel', 'API': 'API',
                                                            'mod_finance': 'Fin', 'mod_commercial': 'Com', 'mod_tasks': 'Rot', 'mod_reports': 'Rel', 'mod_api': 'API'
                                                        };
                                                        const name = moduleMap[m] || m.replace('mod_', '').substring(0, 3).toUpperCase();
                                                        return (
                                                            <span key={m} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-secondary/80 text-secondary-foreground border border-border uppercase tracking-widest shadow-sm">
                                                                {name}
                                                            </span>
                                                        );
                                                    })}
                                                    {(company.contractedModules?.length || 0) > 4 && (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-muted text-muted-foreground border border-border shadow-sm">
                                                            +{(company.contractedModules?.length || 0) - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Período */}
                                            <td className="px-6 py-4 align-middle text-sm text-foreground bg-card border-y border-border/50 group-hover:border-primary/30 transition-colors">
                                                {company.subscriptionStart ? (
                                                    <div className="flex flex-col gap-1.5 text-[11px] font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Início</span>
                                                            <span>{new Date(company.subscriptionStart).toLocaleDateString('pt-BR')}</span>
                                                        </div>
                                                        {company.subscriptionEnd && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Venc</span>
                                                                <span className="font-bold text-primary">
                                                                    {new Date(company.subscriptionEnd).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1 text-[11px] font-medium">
                                                        <div className="text-muted-foreground flex items-center gap-2">
                                                            <span className="uppercase tracking-wider text-[9px]">Criado</span> 
                                                            {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {/* Ações */}
                                            <td className="px-6 py-4 align-middle text-right bg-card rounded-r-2xl border-y border-r border-border/50 group-hover:border-primary/30 transition-colors">
                                                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" onClick={() => handleLoginAs(company.id)} title="Acessar como Admin" className="hover:bg-primary/10 hover:text-primary">
                                                        <Globe className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(company)} title="Editar Dados" className="hover:bg-blue-500/10 hover:text-blue-500">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <div className="w-px h-6 bg-border mx-1"></div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id, company.name)} title="Excluir Empresa" className="hover:bg-destructive/10 hover:text-destructive">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>

            {/* Create / Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? `Editar Empresa: ${newCompany.name}` : "Nova Empresa"}
                width="max-w-4xl"
            >
                {/* Modal Content - Simplified for Brevity (Same fields as original but using newCompany state) */}
                <div onKeyDown={handleFormKeyDown} className="space-y-6">
                    {/* Tabs Header */}
                    <div className="flex border-b border-border mb-4 overflow-x-auto">
                        <button type="button" onClick={() => setCreateTab('data')} className={cn("px-4 py-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap", createTab === 'data' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Dados da Empresa</button>
                        <button type="button" onClick={() => setCreateTab('plans')} className={cn("px-4 py-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap", createTab === 'plans' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Administrador</button>
                        <button type="button" onClick={() => setCreateTab('modules')} className={cn("px-4 py-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap", createTab === 'modules' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Plano e Permissões</button>
                    </div>

                    <div className="min-h-[300px]">
                        {createTab === 'data' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                                <Input label="Nome da Empresa" value={newCompany.name} onChange={e => setNewCompany({ ...newCompany, name: e.target.value })} required />
                                <Input label="Email Principal" value={newCompany.ownerEmail} onChange={e => setNewCompany({ ...newCompany, ownerEmail: e.target.value })} required disabled={!!editingId} />
                                <div className="flex gap-2 items-end">
                                    <div className="w-24">
                                        <Select
                                            label="Tipo Doc"
                                            value={docType}
                                            onChange={e => setDocType(e.target.value as any)}
                                            options={[
                                                { value: 'CNPJ', label: 'CNPJ' },
                                                { value: 'CPF', label: 'CPF' }
                                            ]}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            label="Documento"
                                            value={newCompany.document}
                                            onChange={e => setNewCompany({ ...newCompany, document: docType === 'CNPJ' ? maskCNPJ(e.target.value) : maskCPF(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <Input label="Telefone" value={newCompany.phone} onChange={e => setNewCompany({ ...newCompany, phone: maskPhone(e.target.value) })} />

                                <div>
                                    <Select
                                        label="Status"
                                        value={newCompany.status}
                                        onChange={e => setNewCompany({ ...newCompany, status: e.target.value })}
                                        options={[
                                            { value: 'active', label: 'Ativo' },
                                            { value: 'suspended', label: 'Suspenso' },
                                            { value: 'trial', label: 'Trial' }
                                        ]}
                                    />
                                </div>
                            </div>
                        )}

                        {createTab === 'plans' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <Input label="Nome do Responsável/Admin" value={newCompany.adminName} onChange={e => setNewCompany({ ...newCompany, adminName: e.target.value })} />
                                {!editingId && (
                                    <Input label="Senha Inicial do Admin" type="password" value={newCompany.password} onChange={e => setNewCompany({ ...newCompany, password: e.target.value })} />
                                )}
                                {editingId && (
                                    <div className="p-4 bg-muted/30 rounded-lg border border-border flex items-center justify-between mt-4">
                                        <div>
                                            <h4 className="font-semibold text-sm text-foreground">Acesso Administrativo</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Conecte-se como administrador desta empresa para suporte ou auditoria.</p>
                                        </div>
                                        <Button type="button" variant="outline" onClick={() => handleLoginAs(editingId)}>Acessar Empresa</Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {createTab === 'modules' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Select
                                            label="Tipo de Plano"
                                            value={newCompany.planId === 'custom' ? 'custom' : newCompany.planId}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNewCompany({ ...newCompany, planId: val });
                                                if (val && val !== 'custom') {
                                                    const plan = availablePlans.find(p => p.id === val);
                                                    if (plan) {
                                                        const baseModules = new Set<string>();
                                                        const feats = new Set<string>();
                                                        plan.allowedModules?.forEach(m => {
                                                            if (m.includes(':')) {
                                                                feats.add(m);
                                                                baseModules.add(m.split(':')[0]);
                                                            } else {
                                                                baseModules.add(m);
                                                            }
                                                        });
                                                        setDraftModules(Array.from(baseModules));
                                                        setSelectedFeatures(feats);
                                                    }
                                                }
                                            }}
                                            options={[
                                                { value: '', label: 'Selecione um plano (Opcional)' },
                                                ...availablePlans.map(p => ({ value: p.id, label: `${p.name} (${p.maxUsers} usu.)` })),
                                                { value: 'custom', label: 'Plano Personalizado (Avulso)' }
                                            ]}
                                        />
                                    </div>

                                    {(newCompany.planId === 'custom' || !newCompany.planId) && (
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">Limite Máx. Usuários</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={customLimits.maxUsers.toString()}
                                                onChange={e => setCustomLimits({ ...customLimits, maxUsers: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">Vencimento da Assinatura</label>
                                        <Input
                                            type="date"
                                            value={newCompany.subscriptionEnd ? newCompany.subscriptionEnd.split('T')[0] : ''}
                                            onChange={e => setNewCompany({ ...newCompany, subscriptionEnd: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                                        />
                                    </div>
                                </div>

                                {/* Modules Selection (Granular) */}
                                {(newCompany.planId === 'custom' || !newCompany.planId) && (
                                    <div className="border border-border rounded-lg overflow-hidden mt-4">
                                        <div className="bg-muted px-4 py-3 border-b border-border">
                                            <h4 className="font-semibold text-sm text-foreground">Configuração de Módulos Avulsos</h4>
                                        </div>
                                        <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                                            {SYSTEM_MODULES.map(module => {
                                                const isModuleSelected = draftModules.includes(module.id);

                                                return (
                                                    <div key={module.id} className="border border-border rounded-lg overflow-hidden">
                                                        <div
                                                            onClick={() => {
                                                                if (isModuleSelected) {
                                                                    setDraftModules(draftModules.filter(m => m !== module.id));
                                                                } else {
                                                                    setDraftModules([...draftModules, module.id]);
                                                                }
                                                            }}
                                                            className={cn("p-3 flex items-center justify-between cursor-pointer transition-colors", isModuleSelected ? "bg-indigo-50/10 border-b border-indigo-200 dark:border-indigo-900/50" : "bg-card hover:bg-muted/30")}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                                    isModuleSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                                                                )}>
                                                                    {isModuleSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-sm text-foreground">{module.name}</span>
                                                                    <p className="text-xs text-muted-foreground hidden md:block">{module.description}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isModuleSelected && module.features && (
                                                            <div className="p-4 bg-muted/30 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {module.features.map(feat => {
                                                                    const featKey = `${module.id}:${feat.id}`;
                                                                    const hasFeat = selectedFeatures.has(featKey);
                                                                    return (
                                                                        <div key={feat.id} onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newSet = new Set(selectedFeatures);
                                                                            if (hasFeat) newSet.delete(featKey);
                                                                            else newSet.add(featKey);
                                                                            setSelectedFeatures(newSet);
                                                                        }} className="flex items-center gap-2 cursor-pointer group">
                                                                            <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors", hasFeat ? "bg-primary border-primary" : "border-border group-hover:border-primary/50")}>
                                                                                {hasFeat && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                                                            </div>
                                                                            <span className="text-sm text-foreground/80 group-hover:text-foreground">{feat.name}</span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {userCreationError && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2 mt-4">
                            <AlertTriangle className="w-4 h-4" />
                            {userCreationError}
                        </div>
                    )}

                    <div className="flex flex-wrap justify-between items-center gap-4 pt-6 mt-6 border-t border-border">
                        <div>
                            {createTab !== 'data' && <Button type="button" variant="outline" onClick={() => setCreateTab(createTab === 'modules' ? 'plans' : 'data')}>Voltar</Button>}
                        </div>
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            {createTab !== 'modules' ? (
                                <Button type="button" onClick={() => setCreateTab(createTab === 'data' ? 'plans' : 'modules')}>Avançar</Button>
                            ) : (
                                <Button onClick={handleCreateOrUpdate} loading={creating}>
                                    {editingId ? 'Salvar Alterações' : 'Criar Empresa'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};