import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Company, SaasPlan } from '../../types';
import { maskCNPJ, maskPhone, maskCPF } from '../../utils/masks';
import { useRBAC } from '../../context/RBACContext';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { Loader, Button, Input, Card, Badge, Modal, Select, cn } from '../../components/Shared';
import {
    Building2, Plus, Search, Globe, Lock, CheckCircle2, Edit2, Package,
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
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Super Admin</h1>
                    <p className="text-gray-500 mt-1">Gerenciamento global de empresas e sistema</p>
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
                <Card className="p-6 bg-white shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total de Empresas</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCompanies}</h3>
                        </div>
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Building2 className="w-6 h-6 text-indigo-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Empresas Ativas</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.activeCompanies}</h3>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Usuários</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.totalUsers}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <UserCog className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Planos Ativos</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.activePlans}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <CreditCard className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content Area */}
            <Card className="border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Building2 className="w-5 h-5" />
                        <h2 className="font-semibold">Empresas Cadastradas</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Buscar empresa..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-9 w-64 text-sm"
                            />
                        </div>
                        <Select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            options={[
                                { value: 'all', label: 'Todos Status' },
                                { value: 'active', label: 'Ativos' },
                                { value: 'suspended', label: 'Suspensos' },
                                { value: 'trial', label: 'Trial' }
                            ]}
                            className="h-9 text-sm w-36"
                        />
                        <Button variant="ghost" size="sm" onClick={loadData}>
                            Atualizar
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">Empresa</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Plano</th>
                                <th className="px-6 py-3">Módulos</th>
                                <th className="px-6 py-3">Criado em</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCompanies.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <p>Nenhuma empresa encontrada com os filtros atuais.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCompanies.map((company) => (
                                    <tr key={company.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900">{company.name}</span>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span>{company.cnpj || 'Sem Documento'}</span>
                                                    <span>•</span>
                                                    <span>{company.ownerEmail}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className={getStatusColor(company.status)}>
                                                {company.status === 'active' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                                {company.status === 'suspended' && <PauseCircle className="w-3 h-3 mr-1" />}
                                                {company.status === 'trial' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                {company.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 font-medium">{(company as any).planName || 'Custom'}</span>
                                                {company.subscriptionEnd && (
                                                    <span className="text-xs text-gray-400">Expira: {new Date(company.subscriptionEnd).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {company.contractedModules?.slice(0, 3).map(m => (
                                                    <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 border-gray-200">
                                                        {SYSTEM_MODULES.find(sm => sm.id === m)?.name || m}
                                                    </Badge>
                                                ))}
                                                {(company.contractedModules?.length || 0) > 3 && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                                        +{(company.contractedModules?.length || 0) - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(company.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <Button variant="ghost" size="icon" onClick={() => setActiveMenuId(activeMenuId === company.id ? null : company.id)}>
                                                <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                            </Button>

                                            {activeMenuId === company.id && (
                                                <div className="absolute right-8 top-8 z-50 bg-white border border-gray-200 shadow-xl rounded-lg w-48 py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                                                    <button onClick={() => handleLoginAs(company.id)} className="w-full px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2">
                                                        <Globe className="w-4 h-4" /> Acessar Painel
                                                    </button>
                                                    <button onClick={() => handleEdit(company)} className="w-full px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2">
                                                        <Edit2 className="w-4 h-4" /> Editar Dados
                                                    </button>
                                                    {/* Plan Manager Link or Modal trigger could go here */}
                                                    <div className="h-px bg-gray-100 my-1"></div>
                                                    <button onClick={() => handleDelete(company.id, company.name)} className="w-full px-4 py-2 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2">
                                                        <Trash2 className="w-4 h-4" /> Excluir Empresa
                                                    </button>
                                                </div>
                                            )}
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
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo Doc</label>
                                <Select value={docType} onChange={e => setDocType(e.target.value as any)} options={[{ value: 'CNPJ', label: 'CNPJ' }, { value: 'CPF', label: 'CPF' }]} />
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

                    <div className="border-t border-gray-100 pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Módulos Liberados</label>
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
                                            ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                            : "bg-white border-gray-200 hover:border-gray-300"
                                    )}>
                                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center",
                                        draftModules.includes(module.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                                    )}>
                                        {draftModules.includes(module.id) && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{module.name}</span>
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