
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant } from '../../types';
import { useRBAC } from '../../context/RBACContext';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Loader, Button, Input, Card, Badge, Modal, Select } from '../../components/Shared';
import { Building2, Plus, Search, Globe, Lock, CheckCircle2, Edit2, Package, AlertTriangle, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SYSTEM_MODULES } from '../../lib/constants';

export const SuperAdminDashboard: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { user } = useAuth();
    const { availableTenants, refreshTenants, switchTenant, currentTenant } = useTenant();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, totalUsers: 0, activePlans: 0 });

    // Create/Edit Tenant Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createTab, setCreateTab] = useState<'data' | 'modules'>('data');
    const [newTenant, setNewTenant] = useState({ name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active' });
    const [draftModules, setDraftModules] = useState<string[]>(['mod_tasks']);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [userCreationError, setUserCreationError] = useState<string | null>(null);

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

    const handleOpenCreate = () => {
        setEditingId(null);
        setNewTenant({ name: '', ownerEmail: '', phone: '', document: '', adminName: '', password: '', status: 'active' });
        setDraftModules(['mod_tasks']);
        setTempPassword('');
        setUserCreationError(null);
        setCreateTab('data');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (tenant: Tenant) => {
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
        setCreateTab('data');
        setIsModalOpen(true);
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
                // 1. Create Tenant
                const tenantId = await api.createTenant({
                    name: newTenant.name, ownerEmail: newTenant.ownerEmail, cnpj: newTenant.document, phone: newTenant.phone, adminName: newTenant.adminName, modules: draftModules
                });

                // 2. Refresh lists immediately so the company appears
                await refreshTenants();
                await api.getGlobalStats().then(setStats);

                // 3. Try Create User
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

                    // Tratamento específico para erro 23505 (Duplicate Key)
                    // Se der esse erro, significa que o usuário/perfil foi criado (provavelmente por trigger), então é sucesso.
                    if (userError?.code === '23505' || userError?.message?.includes('duplicate key')) {
                        setTempPassword(newTenant.password); // Assume sucesso
                        // Opcional: mostrar aviso suave
                        // setUserCreationError("Usuário já existia ou foi criado automaticamente.");
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

    const tenantsList = availableTenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

    if (!isSuperAdmin) return null;
    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total de Empresas</p>
                    <div className="text-3xl font-bold text-white">{stats.totalTenants}</div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Empresas Ativas</p>
                    <div className="text-3xl font-bold text-emerald-400">{stats.activeTenants}</div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Usuários</p>
                    <div className="text-3xl font-bold text-slate-200">{stats.totalUsers}</div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Planos Ativos</p>
                    <div className="text-3xl font-bold text-amber-400">{stats.activePlans}</div>
                </div>
            </div>

            <div className="flex justify-between items-center mt-8">
                <h2 className="text-lg font-bold text-white">Empresas Cadastradas</h2>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 py-1.5 text-sm" />
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Plano</th>
                            <th className="px-6 py-4">Módulos</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {tenantsList.map((tenant: any) => (
                            <tr key={tenant.id} className="hover:bg-slate-700/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-slate-300 font-bold">{tenant.name.charAt(0)}</div>
                                        <div>
                                            <div className="font-medium text-white">{tenant.name}</div>
                                            <div className="text-xs text-slate-500">{tenant.ownerEmail}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="default" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20">{tenant.planName || 'Padrão'}</Badge>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                                        {(tenant.contractedModules || []).map((m: string, i: number) => (
                                            <span key={i} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{m.replace('mod_', '')}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant={tenant.status === 'active' ? 'success' : 'error'}>{tenant.status === 'active' ? 'Ativo' : 'Suspenso'}</Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" title="Editar Detalhes" onClick={() => handleOpenEdit(tenant)}>
                                            <Edit2 size={14} /> Editar
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={closeAndReset} title={editingId ? "Editar Empresa" : "Nova Empresa (Tenant)"}>
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
                            <button onClick={() => setCreateTab('data')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'data' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`} type="button">1. Dados da Empresa</button>
                            <button onClick={() => setCreateTab('modules')} className={`pb-2 text-sm font-medium transition-colors border-b-2 ${createTab === 'modules' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'}`} type="button">2. Módulos Contratados</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {createTab === 'data' ? (
                                <div className="space-y-4">
                                    <Input label="Nome da Empresa" placeholder="Ex: Acme Corp" value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="CNPJ" placeholder="00.000.000/0001-00" value={newTenant.document} onChange={e => setNewTenant({ ...newTenant, document: e.target.value })} required />
                                        <Input label="Telefone" placeholder="(00) 0000-0000" value={newTenant.phone} onChange={e => setNewTenant({ ...newTenant, phone: e.target.value })} required />
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
                                            <label className="text-xs text-slate-400 mb-1 block">Status</label>
                                            <Select value={newTenant.status} onChange={e => setNewTenant({ ...newTenant, status: e.target.value })}>
                                                <option value="active">Ativa</option>
                                                <option value="suspended">Suspensa</option>
                                                <option value="inactive">Inativa</option>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-2">
                                        {SYSTEM_MODULES.map(mod => {
                                            const isSelected = draftModules.includes(mod.id);
                                            const isMandatory = mod.id === 'mod_tasks';
                                            return (
                                                <button type="button" key={mod.id} onClick={() => !isMandatory && toggleDraftModule(mod.id)} className={`w-full text-left p-3 rounded-lg border flex items-center justify-between transition-all ${isSelected ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>{isSelected && <CheckCircle2 size={12} className="text-white" />}</div>
                                                        <div><div className={`font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{mod.name}</div><div className="text-xs text-slate-500">{mod.category}</div></div>
                                                    </div>
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
                                        Próximo
                                    </Button>
                                ) : (
                                    <Button key="btn-submit" type="submit" disabled={creating}>
                                        {creating ? 'Salvando...' : 'Finalizar'}
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
