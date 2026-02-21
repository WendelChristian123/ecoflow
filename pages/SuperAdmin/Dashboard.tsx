import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Company, SaasPlan } from '../../types';
import { maskCNPJ, maskPhone, maskCPF } from '../../utils/masks';
import { useRBAC } from '../../context/RBACContext';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { Loader, Button, Input, Card, Badge, Modal, Select, cn } from '../../components/Shared';
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
            planId: company.planId || '',
            billingCycle: company.billingCycle || 'monthly',
            subscriptionStart: '', // Only set if creating/renewing explicitly
            subscriptionEnd: ''
        });
        setDraftModules(company.contractedModules || []);
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

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setUserCreationError(null);

        // Validation
        if (!newCompany.name || (!editingId && !newCompany.ownerEmail)) {
            alert("Campos obrigatórios faltando.");
            setCreating(false);
            return;
        }

        try {
            if (editingId) {
                await api.updateCompany(editingId, {
                    name: newCompany.name,
                    ownerEmail: newCompany.ownerEmail,
                    phone: newCompany.phone,
                    cnpj: newCompany.document,
                    adminName: newCompany.adminName,
                    status: newCompany.status,
                    modules: draftModules
                });
            } else {
                const newId = await api.createCompany({
                    name: newCompany.name,
                    ownerEmail: newCompany.ownerEmail,
                    phone: newCompany.phone,
                    cnpj: newCompany.document,
                    adminName: newCompany.adminName,
                    password: newCompany.password,
                    status: newCompany.status,
                    modules: draftModules
                });
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
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
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

    // @ts-ignore
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-background min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Super Admin</h1>
                    <p className="text-muted-foreground mt-1">Gerenciamento global de empresas e sistema</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate('/super-admin/users')}>
                        <UserCog className="w-4 h-4 mr-2" />
                        Usuários Globais
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/super-admin/companies')}>
                        <Building2 className="w-4 h-4 mr-2" />
                        Gerenciar Detalhado
                    </Button>
                    <Button onClick={handleOpenCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Empresa
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6 bg-card shadow-sm border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total de Empresas</p>
                            <h3 className="text-3xl font-bold text-foreground mt-2">{stats.totalCompanies}</h3>
                        </div>
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Building2 className="w-6 h-6 text-indigo-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-card shadow-sm border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Empresas Ativas</p>
                            <h3 className="text-3xl font-bold text-foreground mt-2">{stats.activeCompanies}</h3>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-card shadow-sm border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Usuários</p>
                            <h3 className="text-3xl font-bold text-foreground mt-2">{stats.totalUsers}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <UserCog className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-card shadow-sm border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Planos Ativos</p>
                            <h3 className="text-3xl font-bold text-foreground mt-2">{stats.activePlans}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <CreditCard className="w-6 h-6 text-blue-600" />
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
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="w-full h-10 text-sm bg-card text-foreground border border-input rounded-lg px-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer appearance-none"
                            >
                                <option value="all">Todos Status</option>
                                <option value="active">Ativos</option>
                                <option value="suspended">Suspensos</option>
                                <option value="trial">Trial</option>
                            </select>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadData} className="h-10 bg-card hover:bg-muted text-foreground border-input">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                            <tr>
                                <th className="px-6 py-3 w-[280px]">Empresa</th>
                                <th className="px-6 py-3 w-[120px]">Status</th>
                                <th className="px-6 py-3 w-[120px]">Plano</th>
                                <th className="px-6 py-3">Módulos</th>
                                <th className="px-6 py-3 w-[130px]">Criado em</th>
                                <th className="px-6 py-3 text-right w-[80px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredCompanies.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <p>Nenhuma empresa encontrada com os filtros atuais.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCompanies.map((company) => (
                                    <tr key={company.id} className="hover:bg-muted/30 transition-colors group">
                                        {/* Empresa */}
                                        <td className="px-6 py-4 align-middle">
                                            <div className="min-w-0">
                                                <span className="font-semibold text-foreground block">{company.name}</span>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                                    {company.cnpj && <span className="shrink-0">{company.cnpj}</span>}
                                                    {company.cnpj && company.ownerEmail && <span>•</span>}
                                                    {company.ownerEmail && (
                                                        <span className="truncate max-w-[160px]">{company.ownerEmail}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {/* Status */}
                                        <td className="px-6 py-4 align-middle">
                                            <Badge className={getStatusColor(company.status)}>
                                                {company.status === 'active' && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                                                {company.status === 'suspended' && <PauseCircle className="w-3 h-3 mr-1 inline" />}
                                                {company.status === 'trial' && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                                                {company.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        {/* Plano */}
                                        <td className="px-6 py-4 align-middle">
                                            <span className="font-medium text-foreground">{(company as any).planName || 'Custom'}</span>
                                            {company.subscriptionEnd && (
                                                <div className="text-xs text-muted-foreground">
                                                    Exp: {new Date(company.subscriptionEnd).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                        </td>
                                        {/* Módulos */}
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex flex-wrap gap-1">
                                                {company.contractedModules?.slice(0, 4).map(m => {
                                                    const moduleMap: Record<string, string> = {
                                                        'FINANCE': 'Fin', 'COMMERCIAL': 'Com', 'ROUTINES': 'Rot', 'REPORTS': 'Rel', 'API': 'API',
                                                        'mod_finance': 'Fin', 'mod_commercial': 'Com', 'mod_tasks': 'Rot', 'mod_reports': 'Rel', 'mod_api': 'API'
                                                    };
                                                    const name = moduleMap[m] || m.replace('mod_', '').substring(0, 3).toUpperCase();
                                                    return (
                                                        <span key={m} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-secondary-foreground border border-border uppercase tracking-wide">
                                                            {name}
                                                        </span>
                                                    );
                                                })}
                                                {(company.contractedModules?.length || 0) > 4 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                                        +{(company.contractedModules?.length || 0) - 4}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Criado em */}
                                        <td className="px-6 py-4 align-middle text-muted-foreground text-sm">
                                            {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                                        </td>
                                        {/* Ações */}
                                        <td className="px-6 py-4 align-middle text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleLoginAs(company.id)} title="Acessar como Admin">
                                                    <Globe className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(company)} title="Editar Dados">
                                                    <Edit2 className="w-4 h-4 text-muted-foreground hover:text-blue-500" />
                                                </Button>
                                                <div className="w-px h-4 bg-border mx-1"></div>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id, company.name)} title="Excluir Empresa">
                                                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
                <form onSubmit={handleCreateOrUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Nome da Empresa" value={newCompany.name} onChange={e => setNewCompany({ ...newCompany, name: e.target.value })} required />
                        <Input label="Email do Proprietário" value={newCompany.ownerEmail} onChange={e => setNewCompany({ ...newCompany, ownerEmail: e.target.value })} required disabled={!!editingId} />
                        <div className="flex gap-2 items-end">
                            <div className="w-24">
                                <label className="text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider block">Tipo Doc</label>
                                <select value={docType} onChange={e => setDocType(e.target.value as any)} className="w-full bg-card border border-input text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer">
                                    <option value="CNPJ">CNPJ</option>
                                    <option value="CPF">CPF</option>
                                </select>
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

                        <Input label="Nome do Admin" value={newCompany.adminName} onChange={e => setNewCompany({ ...newCompany, adminName: e.target.value })} />
                        {!editingId && (
                            <Input label="Senha Inicial" type="password" value={newCompany.password} onChange={e => setNewCompany({ ...newCompany, password: e.target.value })} />
                        )}

                        <div>
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">Status</label>
                            <select
                                value={newCompany.status}
                                onChange={e => setNewCompany({ ...newCompany, status: e.target.value })}
                                className="w-full bg-card border border-input text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer"
                            >
                                <option value="active">Ativo</option>
                                <option value="suspended">Suspenso</option>
                                <option value="trial">Trial</option>
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-border pt-4">
                        <label className="block text-sm font-medium text-foreground mb-2">Módulos Liberados</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {SYSTEM_MODULES.map(module => (
                                <div key={module.id}
                                    onClick={() => {
                                        if (draftModules.includes(module.id)) {
                                            setDraftModules(draftModules.filter(m => m !== module.id));
                                        } else {
                                            setDraftModules([...draftModules, module.id]);
                                        }
                                    }}
                                    className={cn(
                                        "cursor-pointer border rounded-lg p-3 flex items-center gap-3 transition-all",
                                        draftModules.includes(module.id)
                                            ? "bg-indigo-50/10 border-indigo-500/50 ring-1 ring-indigo-500/20"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}>
                                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center",
                                        draftModules.includes(module.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                                    )}>
                                        {draftModules.includes(module.id) && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-foreground">{module.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {userCreationError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {userCreationError}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" loading={creating}>
                            {editingId ? 'Salvar Alterações' : 'Criar Empresa'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};