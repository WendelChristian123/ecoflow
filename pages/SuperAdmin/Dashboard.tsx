import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant, SaasPlan } from '../../types';
import { maskCNPJ, maskPhone, maskCPF } from '../../utils/masks';
import { useRBAC } from '../../context/RBACContext';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Loader, Button, Input, Card, Badge, Modal, Select, cn } from '../../components/Shared';
import {
    Building2, Plus, Search, Globe, Lock, CheckCircle2, Edit2, Package,
    AlertTriangle, Terminal, MoreVertical, CreditCard, PauseCircle,
    Trash2, PlayCircle, Shield, Calendar, Filter, UserCog, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SYSTEM_MODULES } from '../../lib/constants';

// --- Extended Types (Removed - Real Data Used) ---

export const SuperAdminDashboard: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { user } = useAuth();
    const { availableTenants, refreshTenants, switchTenant, currentTenant } = useTenant();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [filterMetric, setFilterMetric] = useState<'all' | 'active_companies' | 'active_plans'>('all');

    const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, totalUsers: 0, activePlans: 0 });

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createTab, setCreateTab] = useState<'data' | 'plans' | 'modules'>('data');
    const [newTenant, setNewTenant] = useState({
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
            await refreshTenants();
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
        setNewTenant({ name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active' });
        setDraftModules(['mod_tasks']);
        setTempPassword('');
        setUserCreationError(null);
        setCreateTab('data');
        setDocType('CNPJ');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (tenant: Tenant, mode: 'data' | 'modules' = 'data') => {
        setEditingId(tenant.id);
        setNewTenant({
            name: tenant.name,
            ownerEmail: tenant.ownerEmail || '',
            phone: tenant.phone || '',
            document: tenant.cnpj || '',
            adminName: tenant.adminName || '',
            password: '',
            status: tenant.status,
            planId: tenant.planId || '',
            billingCycle: tenant.billingCycle || 'monthly',
            subscriptionStart: tenant.subscriptionStart || '',
            subscriptionEnd: tenant.subscriptionEnd || ''
        });

        let modules: string[] = ['mod_tasks'];
        if (Array.isArray(tenant.contractedModules)) modules = [...tenant.contractedModules];
        if (!modules.includes('mod_tasks')) modules.push('mod_tasks');

        // Parse into Module Config & Clean Draft Modules
        const config: Record<string, 'included' | 'locked' | 'extra'> = {};
        const initialFeats = new Set<string>();
        const cleanModules: string[] = [];

        modules.forEach(m => {
            const parts = m.split(':');
            const modId = parts[0];
            const suffix = parts[1];

            // Logic to handle features
            const knownMod = SYSTEM_MODULES.find(sys => sys.id === modId);
            if (knownMod) {
                if (suffix === 'extra') {
                    config[modId] = 'extra';
                    cleanModules.push(modId);
                } else if (suffix && knownMod.features?.some(f => f.id === suffix)) {
                    // It is a feature
                    initialFeats.add(suffix);
                    // Ensure module is included
                    if (!config[modId]) config[modId] = 'included';
                    if (!cleanModules.includes(modId)) cleanModules.push(modId);
                } else {
                    // Just module ID
                    config[modId] = 'included';
                    cleanModules.push(modId);
                    // Legacy: auto-select features? let's do manual only for now to be safe or all?
                    // Let's select all if legacy
                    if (knownMod.features) knownMod.features.forEach(f => initialFeats.add(f.id));
                }
            } else {
                // Fallback
                if (m.includes(':extra')) {
                    config[m.split(':')[0]] = 'extra';
                } else {
                    config[m] = 'included';
                }
            }
        });

        setModuleConfig(config);
        setSelectedFeatures(initialFeats);
        setDraftModules(cleanModules);
        setCreateTab(mode);

        // Auto-detect Document Type for Edit
        const cleanDoc = (tenant.cnpj || '').replace(/\D/g, '');
        if (cleanDoc.length > 11) {
            setDocType('CNPJ');
        } else {
            setDocType('CPF');
        }

        setIsModalOpen(true);
    };

    const handleImpersonate = (tenantId: string) => {
        switchTenant(tenantId);
        navigate('/dashboard'); // Go to dashboard as that tenant
    };

    const calculateDates = (cycle: string) => {
        const start = new Date();
        const end = new Date();
        if (cycle === 'monthly') end.setMonth(end.getMonth() + 1);
        else if (cycle === 'semiannually') end.setMonth(end.getMonth() + 6);
        else if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1);

        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    };

    const selectPlan = (plan: SaasPlan | 'custom', cycle: string = 'monthly') => {
        const dates = calculateDates(cycle);

        if (plan === 'custom') {
            setNewTenant(prev => ({
                ...prev,
                planId: 'custom',
                billingCycle: cycle,
                subscriptionStart: dates.start,
                subscriptionEnd: dates.end
            }));
            // Set custom limits?
        } else {
            setNewTenant(prev => ({
                ...prev,
                planId: plan.id,
                billingCycle: cycle,
                subscriptionStart: dates.start,
                subscriptionEnd: dates.end
            }));
            // Auto-fill modules logic could go here if we want to enforce it
            if (plan) {
                const planModules = plan.allowedModules || [];
                const config: Record<string, 'included' | 'locked' | 'extra'> = {};
                const feats = new Set<string>();
                const cleanModules: string[] = [];

                SYSTEM_MODULES.forEach(sysMod => {
                    let status: 'included' | 'locked' | 'extra' = 'locked';

                    if (planModules.includes(sysMod.id)) {
                        status = 'included';
                    } else if (planModules.includes(sysMod.id + ':extra')) {
                        status = 'extra';
                    }

                    if (sysMod.mandatory) status = 'included';

                    config[sysMod.id] = status;
                    if (status !== 'locked') cleanModules.push(sysMod.id);

                    if (status !== 'locked' && sysMod.features) {
                        const specificFeatures = planModules.filter(m => m.startsWith(sysMod.id + ':') && m !== sysMod.id + ':extra');
                        if (specificFeatures.length > 0) {
                            specificFeatures.forEach(sf => feats.add(sf.split(':')[1]));
                        } else {
                            sysMod.features.forEach(f => feats.add(f.id));
                        }
                    }
                });

                setModuleConfig(config);
                setDraftModules(cleanModules);
                setSelectedFeatures(feats);
            }
        }
    };

    const handleDelete = async (tenantId: string) => {
        if (confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita (Hard Delete).')) {
            try {
                await api.deleteTenant(tenantId);
                alert('Empresa excluída com sucesso.');
                loadData();
            } catch (error: any) {
                console.error(error);
                alert('Erro ao excluir: ' + (error.message || 'Verifique se existem registros vinculados.'));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (createTab === 'data') {
            setCreateTab('plans');
            return;
        }
        if (createTab === 'plans') {
            if (!newTenant.planId) {
                alert("Selecione um plano para continuar.");
                return;
            }
            setCreateTab('modules');
            return;
        }

        setCreating(true);
        setUserCreationError(null);

        try {
            // Construct Final Modules Array
            // Construct Final Modules Array
            const finalModules: string[] = [];
            Object.entries(moduleConfig).forEach(([modId, status]) => {
                if (status === 'locked') return;

                finalModules.push(status === 'extra' ? `${modId}:extra` : modId);

                // Add Features
                const mod = SYSTEM_MODULES.find(m => m.id === modId);
                if (mod && mod.features) {
                    mod.features.forEach(f => {
                        if (selectedFeatures.has(f.id)) {
                            finalModules.push(`${modId}:${f.id}`);
                        }
                    });
                }
            });

            // Ensure mod_tasks is present
            if (!finalModules.some(m => m === 'mod_tasks' || m.startsWith('mod_tasks:'))) {
                finalModules.push('mod_tasks');
            }

            if (editingId) {
                await api.updateTenant(editingId, {
                    name: newTenant.name,
                    phone: newTenant.phone,
                    cnpj: newTenant.document,
                    adminName: newTenant.adminName,
                    status: newTenant.status as any,
                    modules: finalModules,
                    planId: newTenant.planId,
                    billingCycle: newTenant.billingCycle,
                    financialStatus: 'ok', // Default to ok on edit unless specified
                    subscriptionStart: newTenant.subscriptionStart || undefined,
                    subscriptionEnd: newTenant.subscriptionEnd || undefined
                });
                alert('Empresa atualizada com sucesso!');
                await loadData(); // Changed: Refresh data to show changes instantly
                setIsModalOpen(false);
            } else {
                const tenantId = await api.createTenant({
                    name: newTenant.name, ownerEmail: newTenant.ownerEmail, cnpj: newTenant.document, phone: newTenant.phone, adminName: newTenant.adminName,
                    modules: finalModules, password: newTenant.password,
                    planId: newTenant.planId, billingCycle: newTenant.billingCycle,
                    subscriptionStart: newTenant.subscriptionStart, subscriptionEnd: newTenant.subscriptionEnd
                });

                await refreshTenants();
                await api.getGlobalStats().then(setStats);
                setTempPassword(newTenant.password);
            }

            if (editingId) closeAndReset();

        } catch (error: any) {
            console.error("Create Tenant Failed:", error);
            alert("Erro crítico ao salvar: " + (error.message || JSON.stringify(error)));
        } finally {
            setCreating(false);
        }
    };

    const closeAndReset = () => {
        setIsModalOpen(false);
        setNewTenant({ name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active' });
        setTempPassword('');
        setUserCreationError(null);
        setCreateTab('data');
        setEditingId(null);
    }

    const toggleDraftModule = (id: string) => {
        if (id === 'mod_tasks') return;
        setDraftModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
    };

    const handleTenantSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        if (id) switchTenant(id);
    };

    // --- Filtering Logic ---
    const filteredTenants = useMemo(() => {
        if (!availableTenants) return [];
        return availableTenants.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                (t.ownerEmail && t.ownerEmail.toLowerCase().includes(search.toLowerCase()));
            const matchesType = filterType === 'all' || (t.type || 'client') === filterType;
            const matchesStatus = filterStatus === 'all' || t.status === filterStatus;

            // Metrics Filters rely on real data now
            const matchesMetric =
                filterMetric === 'all' ? true :
                    filterMetric === 'active_companies' ? t.status === 'active' :
                        filterMetric === 'active_plans' ? t.status === 'active' && t.financialStatus === 'ok' : true;

            return matchesSearch && matchesType && matchesStatus && matchesMetric;
        });
    }, [availableTenants, search, filterType, filterStatus, filterMetric]);

    if (!isSuperAdmin) return null;
    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-indigo-900/50 to-slate-900 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Globe size={120} /></div>
                <div className="z-10">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Globe className="text-indigo-400" /> Backoffice Administrativo</h1>
                    <p className="text-indigo-200/60 text-sm mt-1">Gestão global de empresas (tenants) e licenças.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 z-10 w-full md:w-auto">
                    <div className="relative group">
                        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">
                            <Building2 size={16} className="text-indigo-400" />
                            <span className="text-xs text-slate-500 uppercase font-bold mr-1">Visão Atual:</span>
                            <select value={currentTenant?.id || ''} onChange={handleTenantSwitch} className="bg-transparent outline-none font-bold text-white cursor-pointer min-w-[150px]">
                                {availableTenants.map(t => <option key={t.id} value={t.id} className="bg-slate-900 text-white">{t.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 gap-2 w-full sm:w-auto"><Plus size={18} /> Nova Empresa</Button>
                </div>
            </div>

            {/* Metrics Cards - Clickable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => setFilterMetric('all')} className={`p-5 rounded-xl border cursor-pointer transition-all hover:border-slate-500 ${filterMetric === 'all' ? 'bg-slate-800 border-indigo-500/50 ring-1 ring-indigo-500/50' : 'bg-slate-800 border-slate-700'}`}>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total de Empresas</p>
                    <div className="text-3xl font-bold text-white">{stats.totalTenants}</div>
                </div>
                <div onClick={() => setFilterMetric('active_companies')} className={`p-5 rounded-xl border cursor-pointer transition-all hover:border-emerald-500/50 ${filterMetric === 'active_companies' ? 'bg-slate-800 border-emerald-500/50 ring-1 ring-emerald-500/50' : 'bg-slate-800 border-slate-700'}`}>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Empresas Ativas</p>
                    <div className="text-3xl font-bold text-emerald-400">{stats.activeTenants}</div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 opacity-80 cursor-default">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Usuários</p>
                    <div className="text-3xl font-bold text-slate-200">{stats.totalUsers}</div>
                </div>
                <div onClick={() => setFilterMetric('active_plans')} className={`p-5 rounded-xl border cursor-pointer transition-all hover:border-amber-500/50 ${filterMetric === 'active_plans' ? 'bg-slate-800 border-amber-500/50 ring-1 ring-amber-500/50' : 'bg-slate-800 border-slate-700'}`}>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Planos Ativos</p>
                    <div className="text-3xl font-bold text-amber-400">{stats.activePlans}</div>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Empresas Cadastradas</h2>
                </div>
                <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 py-2 text-sm bg-slate-800 border-slate-700" />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        <div className="min-w-[140px]">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500">
                                <option value="all">Tipos: Todos</option>
                                <option value="client">Cliente</option>
                                <option value="trial">Trial</option>
                                <option value="internal">Interna</option>
                            </select>
                        </div>
                        <div className="min-w-[140px]">
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500">
                                <option value="all">Status: Todos</option>
                                <option value="active">Ativo</option>
                                <option value="suspended">Suspenso</option>
                                <option value="inactive">Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-visible min-h-[400px]">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Empresa / Detalhes</th>
                            <th className="px-6 py-4">Plano</th>
                            <th className="px-6 py-4">Módulos</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filteredTenants.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500 italic">Nenhuma empresa encontrada com os filtros atuais.</td></tr>
                        ) : (
                            filteredTenants.map((tenant) => (
                                <tr key={tenant.id} className="hover:bg-slate-700/20 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg">{tenant.name.charAt(0)}</div>
                                            <div>
                                                <div className="font-medium text-white text-base">{tenant.name}</div>
                                                <div className="flex flex-wrap gap-2 mt-1.5">
                                                    <Badge variant={tenant.type === 'internal' ? 'neutral' : tenant.type === 'client' ? 'success' : 'warning'} className="text-[10px] h-5 px-1.5">
                                                        {tenant.type === 'internal' ? 'Interna' : tenant.type === 'client' ? 'Cliente' : 'Trial'}
                                                    </Badge>

                                                    <Badge variant={tenant.financialStatus === 'ok' ? 'success' : 'error'} className="text-[10px] h-5 px-1.5 flex items-center gap-1">
                                                        {tenant.financialStatus === 'ok' ? 'Financeiro OK' : 'Inadimplente'}
                                                    </Badge>

                                                    {tenant.lastActiveAt ? (
                                                        <span className="text-[10px] text-slate-500 flex items-center gap-1 h-5 pt-0.5" title={`Criado em: ${new Date(tenant.createdAt).toLocaleDateString()}`}>
                                                            <Calendar size={10} /> Última ativ.: {new Date(tenant.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-600 italic h-5 pt-0.5">Nunca acessou</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top pt-5">
                                        <Badge variant="default" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20">{tenant.planName || 'Padrão'}</Badge>
                                    </td>
                                    <td className="px-6 py-4 align-top pt-5">
                                        <div
                                            className="flex gap-1 flex-wrap max-w-[220px] cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => handleOpenEdit(tenant, 'modules')}
                                            title="Gerenciar Módulos"
                                        >
                                            {(tenant.contractedModules || []).map((m: string, i: number) => {
                                                // Mock status logic for visuals
                                                const isExtra = i > 2;
                                                return (
                                                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${isExtra ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-900 text-slate-300 border-slate-700'}`}>
                                                        {m.replace('mod_', '')}
                                                        {isExtra && <span className="text-[8px] opacity-70">($)</span>}
                                                    </span>
                                                )
                                            })}
                                            <span className="text-[10px] text-slate-600 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={10} /></span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top pt-5">
                                        <Badge variant={tenant.status === 'active' ? 'success' : 'error'}>{tenant.status === 'active' ? 'Ativo' : 'Suspenso'}</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right align-top pt-5 relative">
                                        <div className="relative inline-block">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === tenant.id ? null : tenant.id); }}
                                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                            >
                                                <MoreVertical size={18} />
                                            </button>

                                            {activeMenuId === tenant.id && (
                                                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                                    <button onClick={() => handleImpersonate(tenant.id)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-400 text-left w-full transition-colors">
                                                        <UserCog size={16} /> Acessar como Empresa
                                                    </button>
                                                    <button onClick={() => handleOpenEdit(tenant, 'data')} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white text-left w-full transition-colors">
                                                        <CreditCard size={16} /> Gerenciar Licença
                                                    </button>
                                                    <button onClick={() => handleOpenEdit(tenant, 'modules')} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white text-left w-full transition-colors">
                                                        <Package size={16} /> Gerenciar Módulos
                                                    </button>
                                                    <div className="h-px bg-slate-800 my-1" />
                                                    {tenant.status === 'active' ? (
                                                        <button onClick={() => { /* Suspender */ }} className="flex items-center gap-2 px-4 py-2 text-sm text-amber-500 hover:bg-amber-500/10 text-left w-full transition-colors">
                                                            <PauseCircle size={16} /> Suspender Empresa
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => { /* Reativar */ }} className="flex items-center gap-2 px-4 py-2 text-sm text-emerald-500 hover:bg-emerald-500/10 text-left w-full transition-colors">
                                                            <PlayCircle size={16} /> Reativar Empresa
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDelete(tenant.id)} className="flex items-center gap-2 px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 text-left w-full transition-colors">
                                                        <Trash2 size={16} /> Excluir Empresa
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Reuse Existing Modal Logic */}
            <Modal isOpen={isModalOpen} onClose={closeAndReset} title={editingId ? "Gerenciar Empresa" : "Nova Empresa (Tenant)"}>
                {(tempPassword || userCreationError) && !editingId ? (
                    <div className="space-y-6 text-center py-4">
                        {userCreationError ? (
                            <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
                        ) : (
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} /></div>
                        )}

                        <h3 className="text-xl font-bold text-white">
                            {userCreationError ? 'Empresa Criada, mas Atenção!' : 'Empresa Cadastrada!'}
                        </h3>

                        {userCreationError ? (
                            <div className="text-left bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
                                <p className="text-amber-200 text-sm mb-2">{userCreationError}</p>
                                <p className="text-slate-400 text-xs">A empresa <strong>{newTenant.name}</strong> foi criada e já está disponível no seletor.</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-slate-400 text-sm">O ambiente foi criado. Envie os dados abaixo para o administrador responsável.</p>
                                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg text-left space-y-2">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Login</span>
                                        <div className="text-white font-mono">{newTenant.ownerEmail}</div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Senha Definida</span>
                                        <div className="text-emerald-400 font-mono text-lg font-bold flex items-center gap-2">{tempPassword}</div>
                                    </div>
                                </div>
                            </>
                        )}
                        <Button onClick={closeAndReset} className="w-full">Concluir</Button>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-4 border-b border-slate-700 mb-6">
                            <button type="button" onClick={() => setCreateTab('data')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'data' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`}>1. Dados & Licença</button>
                            <button type="button" onClick={() => setCreateTab('plans')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'plans' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`}>2. Seleção de Plano</button>
                            <button type="button" onClick={() => setCreateTab('modules')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'modules' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`}>3. Gestão de Módulos</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {createTab === 'data' ? (
                                <div className="space-y-4">
                                    <Input label="Nome da Empresa" placeholder="Ex: Acme Corp" value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-slate-400 uppercase">Documento</label>
                                                <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDocType('CNPJ')}
                                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${docType === 'CNPJ' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        CNPJ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDocType('CPF')}
                                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${docType === 'CPF' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        CPF
                                                    </button>
                                                </div>
                                            </div>
                                            <Input
                                                placeholder={docType === 'CNPJ' ? "00.000.000/0001-00" : "000.000.000-00"}
                                                value={newTenant.document}
                                                onChange={e => setNewTenant({ ...newTenant, document: docType === 'CNPJ' ? maskCNPJ(e.target.value) : maskCPF(e.target.value) })}
                                                required
                                            />
                                        </div>
                                        <Input label="Telefone" placeholder="(00) 00000-0000" value={newTenant.phone} onChange={e => setNewTenant({ ...newTenant, phone: maskPhone(e.target.value) })} required />
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mt-2">
                                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Lock size={14} /> Dados do Administrador Inicial</h4>
                                        <div className="space-y-3">
                                            <Input label="Nome do Admin" placeholder="Nome completo" value={newTenant.adminName} onChange={e => setNewTenant({ ...newTenant, adminName: e.target.value })} required />
                                            <Input label="Email de Acesso (Login)" type="email" placeholder="admin@empresa.com" value={newTenant.ownerEmail} onChange={e => setNewTenant({ ...newTenant, ownerEmail: e.target.value })} required disabled={!!editingId} />
                                            {!editingId && <Input label="Senha Inicial" type="password" placeholder="Mínimo 6 caracteres" value={newTenant.password} onChange={e => setNewTenant({ ...newTenant, password: e.target.value })} required />}
                                        </div>
                                    </div>
                                    {editingId && (
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Status Financeiro / Acesso</label>
                                            <Select value={newTenant.status} onChange={e => setNewTenant({ ...newTenant, status: e.target.value })}>
                                                <option value="active">Ativa (Acesso Liberado)</option>
                                                <option value="suspended">Suspensa (Inadimplência)</option>
                                                <option value="inactive">Cancelada/Inativa</option>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            ) : createTab === 'plans' ? (
                                <div className="space-y-6">
                                    <div className="flex justify-center">
                                        <div className="inline-flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                                            {['monthly', 'semiannually', 'yearly'].map(cycle => (
                                                <button
                                                    key={cycle}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentPlan = availablePlans.find(p => p.id === newTenant.planId) || (newTenant.planId === 'custom' ? 'custom' : null);
                                                        if (currentPlan) selectPlan(currentPlan, cycle);
                                                        else setNewTenant(prev => ({ ...prev, billingCycle: cycle }));
                                                    }}
                                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${newTenant.billingCycle === cycle ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    {cycle === 'monthly' ? 'Mensal' : cycle === 'semiannually' ? 'Semestral' : 'Anual'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-1">
                                        {availablePlans.map(plan => {
                                            const isSelected = newTenant.planId === plan.id;
                                            const price = newTenant.billingCycle === 'monthly' ? plan.priceMonthly : newTenant.billingCycle === 'semiannually' ? plan.priceSemiannually : plan.priceYearly;
                                            return (
                                                <div
                                                    key={plan.id}
                                                    onClick={() => selectPlan(plan, newTenant.billingCycle)}
                                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className={`font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>{plan.name}</h4>
                                                            <div className="flex items-baseline gap-1 mt-1">
                                                                <span className="text-lg font-bold text-emerald-400">R$ {price?.toFixed(2)}</span>
                                                                <span className="text-xs text-slate-500">/{newTenant.billingCycle === 'monthly' ? 'mês' : newTenant.billingCycle === 'semiannually' ? 'semestre' : 'ano'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-slate-400">Usuários: <span className="text-white">{plan.maxUsers}</span></div>
                                                            <div className="text-xs text-slate-400">Módulos: <span className="text-white">{plan.allowedModules?.length}</span></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <div
                                            onClick={() => selectPlan('custom', newTenant.billingCycle)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${newTenant.planId === 'custom' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500"><UserCog size={20} /></div>
                                                <div>
                                                    <h4 className={`font-bold ${newTenant.planId === 'custom' ? 'text-white' : 'text-slate-200'}`}>Personalizado</h4>
                                                    <p className="text-xs text-slate-400">Definir limites manualmente</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {newTenant.planId && newTenant.subscriptionStart && (
                                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Resumo da Assinatura</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-400 block">Início</span>
                                                    <span className="text-white">{new Date(newTenant.subscriptionStart).toLocaleDateString()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block">Renovação</span>
                                                    <span className="text-white">{new Date(newTenant.subscriptionEnd).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                                    {/* Module Categories Tabs */}
                                    {/* Module Categories Tabs */}
                                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                                        {['Todos', ...Array.from(new Set(SYSTEM_MODULES.map(m => m.category || 'Outros')))].map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setActiveCategoryTab(cat)}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                                                    activeCategoryTab === cat
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                )}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-3 bg-secondary/10 border border-border rounded-lg mb-4">
                                        <p className="text-xs text-muted-foreground">
                                            Configure os módulos. Itens "Obrigatórios" não podem ser removidos. Módulos "Extra" podem ser faturados à parte.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {SYSTEM_MODULES
                                            .filter(mod => activeCategoryTab === 'Todos' || (mod.category || 'Outros') === activeCategoryTab)
                                            .map(mod => {
                                                const status = moduleConfig[mod.id] || (draftModules.includes(mod.id) ? 'included' : 'locked');
                                                const isMandatory = mod.mandatory || mod.id === 'mod_tasks'; // Fallback for legacy id check

                                                return (
                                                    <div
                                                        key={mod.id}
                                                        className={cn(
                                                            "flex flex-col p-4 rounded-xl border-2 transition-all select-none gap-4",
                                                            status !== 'locked' ? "bg-[#1E293B] border-primary/50" : "bg-card border-border opacity-80"
                                                        )}
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={cn(
                                                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors border shadow-inner",
                                                                    status === 'included' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500" :
                                                                        status === 'extra' ? "bg-amber-500/20 border-amber-500/50 text-amber-500" :
                                                                            "bg-secondary border-border text-muted-foreground"
                                                                )}>
                                                                    {status === 'included' && <CheckCircle2 size={20} />}
                                                                    {status === 'extra' && <AlertTriangle size={20} />}
                                                                    {status === 'locked' && <Lock size={18} />}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className={cn("font-bold text-base", status !== 'locked' ? "text-white" : "text-muted-foreground")}>{mod.name}</p>
                                                                        {isMandatory && <Badge variant="neutral" className="text-[10px] h-5 px-1.5 bg-slate-700 text-slate-300 border-none">Obrigatório</Badge>}
                                                                    </div>
                                                                    <p className="text-xs text-slate-400">{mod.category}</p>
                                                                </div>
                                                            </div>

                                                            {/* Explicit Segmented Control */}
                                                            {!isMandatory && (
                                                                <div className="flex p-0.5 bg-background rounded-lg border border-border shrink-0 self-start sm:self-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setModuleConfig(prev => ({ ...prev, [mod.id]: 'locked' }));
                                                                            // Sync legacy draft array
                                                                            setDraftModules(prev => prev.filter(m => m !== mod.id));
                                                                        }}
                                                                        className={cn(
                                                                            "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                                            status === 'locked' ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                                        )}
                                                                    >
                                                                        Bloqueado
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setModuleConfig(prev => ({ ...prev, [mod.id]: 'included' }));
                                                                            // Sync legacy draft array
                                                                            setDraftModules(prev => [...prev.filter(m => m !== mod.id), mod.id]);
                                                                        }}
                                                                        className={cn(
                                                                            "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                                            status === 'included' ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-emerald-500"
                                                                        )}
                                                                    >
                                                                        Incluso
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setModuleConfig(prev => ({ ...prev, [mod.id]: 'extra' }));
                                                                            // Sync legacy draft array (extra is also allowed access)
                                                                            setDraftModules(prev => [...prev.filter(m => m !== mod.id), mod.id]);
                                                                        }}
                                                                        className={cn(
                                                                            "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                                            status === 'extra' ? "bg-amber-500 text-black shadow-sm" : "text-muted-foreground hover:text-amber-500"
                                                                        )}
                                                                    >
                                                                        Extra
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {isMandatory && (
                                                                <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-500 font-bold flex items-center gap-1 shrink-0">
                                                                    <CheckCircle2 size={12} /> Sempre Incluso
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Feature List (Visual Only) */}
                                                        {mod.features && mod.features.length > 0 && (
                                                            <div className={cn(
                                                                "mt-2 pl-[56px] grid grid-cols-2 gap-2",
                                                                status === 'locked' ? "opacity-50 grayscale pointer-events-none" : "opacity-100"
                                                            )}>
                                                                {mod.features.map(feat => {
                                                                    const featId = typeof feat === 'string' ? feat : feat.id;
                                                                    const featName = typeof feat === 'string' ? feat : feat.name;
                                                                    const isSelected = selectedFeatures.has(featId);

                                                                    return (
                                                                        <div
                                                                            key={featId}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (status === 'locked') return;
                                                                                const newSet = new Set(selectedFeatures);
                                                                                if (newSet.has(featId)) newSet.delete(featId);
                                                                                else newSet.add(featId);
                                                                                setSelectedFeatures(newSet);
                                                                            }}
                                                                            className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-white transition-colors group select-none"
                                                                        >
                                                                            <div className={cn(
                                                                                "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                                                                isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-600 group-hover:border-slate-500"
                                                                            )}>
                                                                                {isSelected && <Check size={10} className="text-white" />}
                                                                            </div>
                                                                            {featName}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <Button type="button" variant="ghost" onClick={closeAndReset}>Cancelar</Button>
                                {createTab === 'data' ? (
                                    <Button key="btn-next-plan" type="submit" disabled={!newTenant.name || !newTenant.document}>
                                        Próximo: Planos
                                    </Button>
                                ) : createTab === 'plans' ? (
                                    <Button key="btn-next-mod" type="submit" disabled={!newTenant.planId}>
                                        Próximo: Módulos
                                    </Button>
                                ) : (
                                    <Button key="btn-submit" type="submit" disabled={creating}>
                                        {creating ? 'Salvando...' : 'Salvar Alterações'}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </>
                )}
            </Modal>
        </div >
    );
};
