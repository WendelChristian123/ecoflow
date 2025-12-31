import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant } from '../../types';
import { maskCNPJ, maskPhone } from '../../utils/masks';
import { useRBAC } from '../../context/RBACContext';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Loader, Button, Input, Card, Badge, Modal, Select } from '../../components/Shared';
import {
    Building2, Plus, Search, Globe, Lock, CheckCircle2, Edit2, Package,
    AlertTriangle, Terminal, MoreVertical, CreditCard, PauseCircle,
    Trash2, PlayCircle, Shield, Calendar, Filter, UserCog
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
    const [createTab, setCreateTab] = useState<'data' | 'modules'>('data');
    const [newTenant, setNewTenant] = useState({ name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active' });
    const [draftModules, setDraftModules] = useState<string[]>(['mod_tasks']);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [userCreationError, setUserCreationError] = useState<string | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
            status: tenant.status
        });

        let modules: string[] = ['mod_tasks'];
        if (Array.isArray(tenant.contractedModules)) modules = [...tenant.contractedModules];
        if (!modules.includes('mod_tasks')) modules.push('mod_tasks');
        setDraftModules(modules);
        setCreateTab(mode);
        setIsModalOpen(true);
    };

    const handleImpersonate = (tenantId: string) => {
        switchTenant(tenantId);
        navigate('/dashboard'); // Go to dashboard as that tenant
    };

    const handleDelete = async (tenantId: string) => {
        if (confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita (Soft Delete).')) {
            // Mock delete for now as API might not support it fully yet or requires update
            alert('Funcionalidade de exclusão enviada.');
            // await api.deleteTenant(tenantId);
            loadData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (createTab === 'data') {
            setCreateTab('modules');
            return;
        }

        setCreating(true);
        setUserCreationError(null);

        try {
            if (editingId) {
                await api.updateTenant(editingId, {
                    name: newTenant.name, phone: newTenant.phone, cnpj: newTenant.document, adminName: newTenant.adminName,
                    status: newTenant.status as any, modules: draftModules
                });
                alert('Empresa atualizada com sucesso!');
                setIsModalOpen(false);
            } else {
                const tenantId = await api.createTenant({
                    name: newTenant.name, ownerEmail: newTenant.ownerEmail, cnpj: newTenant.document, phone: newTenant.phone, adminName: newTenant.adminName, modules: draftModules
                });

                await refreshTenants();
                await api.getGlobalStats().then(setStats);

                try {
                    await api.createUser({
                        name: newTenant.adminName,
                        email: newTenant.ownerEmail,
                        password: newTenant.password,
                        phone: newTenant.phone,
                        role: 'admin'
                    }, tenantId);
                    setTempPassword(newTenant.password);
                } catch (userError: any) {
                    console.error("User creation failed:", userError);
                    if (userError?.code === '23505' || userError?.message?.includes('duplicate key')) {
                        setTempPassword(newTenant.password);
                    } else {
                        setUserCreationError("Empresa criada, mas falha ao criar usuário automático. Verifique o banco de dados.");
                    }
                }
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
                            <button onClick={() => setCreateTab('data')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'data' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`} type="button">1. Dados & Licença</button>
                            <button onClick={() => setCreateTab('modules')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'modules' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`} type="button">2. Gestão de Módulos</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {createTab === 'data' ? (
                                <div className="space-y-4">
                                    <Input label="Nome da Empresa" placeholder="Ex: Acme Corp" value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="CNPJ" placeholder="00.000.000/0001-00" value={newTenant.document} onChange={e => setNewTenant({ ...newTenant, document: maskCNPJ(e.target.value) })} required />
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
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-400 bg-slate-800 p-3 rounded border border-slate-700 mb-4">
                                        Habilite os módulos que esta empresa pode acessar. Módulos marcados como "Extra" serão cobrados à parte na fatura.
                                    </p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {SYSTEM_MODULES.map(mod => {
                                            const isSelected = draftModules.includes(mod.id);
                                            const isMandatory = mod.id === 'mod_tasks';
                                            return (
                                                <button type="button" key={mod.id} onClick={() => !isMandatory && toggleDraftModule(mod.id)} className={`w-full text-left p-3 rounded-lg border flex items-center justify-between transition-all ${isSelected ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>{isSelected && <CheckCircle2 size={12} className="text-white" />}</div>
                                                        <div>
                                                            <div className={`font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{mod.name}</div>
                                                            <div className="text-xs text-slate-500">{mod.category}</div>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">Incluído</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <Button type="button" variant="ghost" onClick={closeAndReset}>Cancelar</Button>
                                {createTab === 'data' ? (
                                    <Button key="btn-next" type="submit" disabled={!newTenant.name || !newTenant.document}>
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
        </div>
    );
};
