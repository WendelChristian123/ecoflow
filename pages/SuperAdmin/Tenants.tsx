
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant } from '../../types';
import { useRBAC } from '../../context/RBACContext';
import { useTenant } from '../../context/TenantContext';
import { Loader, Button, Input, Card, Badge } from '../../components/Shared';
import { Modal } from '../../components/Shared';
import { Building2, Plus, Search, LogIn, Calendar, Users, Globe, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SuperAdminTenants: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { availableTenants, refreshTenants, switchTenant, currentTenant } = useTenant();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantOwner, setNewTenantOwner] = useState('');
    const [newTenantCnpj, setNewTenantCnpj] = useState('');
    const [newTenantPhone, setNewTenantPhone] = useState('');
    const [newTenantAdminName, setNewTenantAdminName] = useState('');
    const [newTenantPassword, setNewTenantPassword] = useState('');
    const [selectedModules, setSelectedModules] = useState<string[]>(['mod_tasks', 'mod_finance', 'mod_commercial']);

    // Status State for Edit
    const [tenantStatus, setTenantStatus] = useState<'active' | 'inactive'>('active');

    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/');
        }
    }, [isSuperAdmin]);

    const openCreateModal = () => {
        setEditingId(null);
        setNewTenantName('');
        setNewTenantOwner('');
        setNewTenantCnpj('');
        setNewTenantPhone('');
        setNewTenantAdminName('');
        setNewTenantPassword('');
        setTenantStatus('active');
        setSelectedModules(['mod_tasks', 'mod_finance', 'mod_commercial']);
        setIsModalOpen(true);
    };

    const openEditModal = (tenant: Tenant) => {
        setEditingId(tenant.id);
        setNewTenantName(tenant.name);
        setNewTenantOwner(tenant.ownerEmail || '');
        setNewTenantCnpj(tenant.cnpj || '');
        setNewTenantPhone(tenant.phone || '');
        setNewTenantAdminName(tenant.adminName || '');
        setNewTenantPassword(''); // Don't enforce password on edit unless changing
        setTenantStatus(tenant.status === 'active' ? 'active' : 'inactive'); // Ensure strict typing

        // Load modules
        if (tenant.contractedModules && Array.isArray(tenant.contractedModules)) {
            setSelectedModules(tenant.contractedModules);
        } else {
            // Legacy/Default Fallback
            setSelectedModules(['mod_tasks', 'mod_finance', 'mod_commercial']);
        }

        setIsModalOpen(true);
    };

    const toggleModule = (mod: string) => {
        setSelectedModules(prev =>
            prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            if (editingId) {
                // UPDATE
                await api.updateTenant(editingId, {
                    name: newTenantName,
                    ownerEmail: newTenantOwner,
                    adminName: newTenantAdminName,
                    cnpj: newTenantCnpj,
                    phone: newTenantPhone,
                    status: tenantStatus,
                    modules: selectedModules,
                    // Pass password only if provided (though standard updateTenant might not handle auth update, usually handled separately)
                    // For now, updating Tenant fields.
                });
                alert('Empresa atualizada com sucesso!');
            } else {
                // CREATE
                await api.createTenant({
                    name: newTenantName,
                    ownerEmail: newTenantOwner,
                    cnpj: newTenantCnpj,
                    phone: newTenantPhone,
                    adminName: newTenantAdminName,
                    password: newTenantPassword,
                    modules: selectedModules
                });
                alert('Empresa criada com sucesso!');
            }

            await refreshTenants();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Erro detalhado:", error);
            alert('Erro ao salvar empresa: ' + getErrorMessage(error));
        } finally {
            setCreating(false);
        }
    };

    const handleAccess = (id: string) => {
        switchTenant(id);
        navigate('/');
    };

    const filtered = availableTenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.ownerEmail?.toLowerCase().includes(search.toLowerCase())
    );

    if (!isSuperAdmin) return null;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-indigo-900/50 to-slate-900 border border-indigo-500/20 p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Globe className="text-indigo-400" /> Área Super Admin
                    </h1>
                    <p className="text-indigo-200/60 text-sm mt-1">Gestão global de empresas e acessos.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-400 uppercase font-bold">Empresa Atual</p>
                        <p className="text-white font-medium">{currentTenant?.name || 'Selecione...'}</p>
                    </div>
                    <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 gap-2">
                        <Plus size={18} /> Nova Empresa
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {/* TABLE VIEW */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-slate-200 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Admin / Email</th>
                            <th className="px-6 py-4">Módulos</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filtered.map(tenant => (
                            <tr key={tenant.id} className={currentTenant?.id === tenant.id ? 'bg-indigo-500/5' : 'hover:bg-slate-800/50'}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded bg-slate-800 flex items-center justify-center text-indigo-400">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{tenant.name}</p>
                                            <p className="text-xs text-slate-500">{tenant.cnpj || 'CNPJ não inf.'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-white">{tenant.adminName || 'Admin'}</p>
                                    <p className="text-xs">{tenant.ownerEmail}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                                        {tenant.contractedModules?.includes('mod_commercial') && (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">Co</span>
                                        )}
                                        {tenant.contractedModules?.includes('mod_finance') && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20">Fi</span>
                                        )}
                                        {tenant.contractedModules?.includes('mod_tasks') && (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20">Op</span>
                                        )}
                                        {(!tenant.contractedModules || tenant.contractedModules.length === 0) && '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant={tenant.status === 'active' ? 'success' : 'neutral'}>
                                        {tenant.status === 'active' ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {currentTenant?.id !== tenant.id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAccess(tenant.id)}
                                                className="text-indigo-400 hover:bg-indigo-500/10"
                                                title="Acessar"
                                            >
                                                <LogIn size={16} />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditModal(tenant)}
                                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                                            title="Editar"
                                        >
                                            <Edit size={16} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Empresa" : "Nova Empresa (Tenant)"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!editingId && (
                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200 mb-4">
                            <p>Ao criar uma empresa, o email informado será automaticamente configurado como o primeiro administrador.</p>
                        </div>
                    )}

                    <Input
                        label="Nome da Empresa"
                        placeholder="Ex: Acme Corp"
                        value={newTenantName}
                        onChange={e => setNewTenantName(e.target.value)}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="CNPJ"
                            placeholder="00.000.000/0001-00"
                            value={newTenantCnpj}
                            onChange={e => setNewTenantCnpj(e.target.value)}
                            required
                        />
                        <Input
                            label="Telefone"
                            placeholder="(00) 0000-0000"
                            value={newTenantPhone}
                            onChange={e => setNewTenantPhone(e.target.value)}
                            required
                        />
                    </div>

                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-3">
                        <p className="text-xs text-slate-400 font-bold uppercase">Módulos Contratados</p>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                    checked={selectedModules.includes('mod_commercial')}
                                    onChange={() => toggleModule('mod_commercial')}
                                />
                                <span className="text-sm text-slate-300">Gestão Comercial (CRM, Orçamentos)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                    checked={selectedModules.includes('mod_tasks')}
                                    onChange={() => toggleModule('mod_tasks')}
                                />
                                <span className="text-sm text-slate-300">Rotinas & Execução (Tarefas, Projetos)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                    checked={selectedModules.includes('mod_finance')}
                                    onChange={() => toggleModule('mod_finance')}
                                />
                                <span className="text-sm text-slate-300">Gestão Financeira</span>
                            </label>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-3">
                        <p className="text-xs text-slate-400 font-bold uppercase">Dados de Acesso</p>
                        <Input
                            label="Nome do Admin"
                            placeholder="Nome Completo"
                            value={newTenantAdminName}
                            onChange={e => setNewTenantAdminName(e.target.value)}
                            required
                        />
                        <Input
                            label="Email de Acesso"
                            type="email"
                            placeholder="admin@empresa.com"
                            value={newTenantOwner}
                            onChange={e => setNewTenantOwner(e.target.value)}
                            required
                        />
                        {!editingId ? (
                            <Input
                                label="Senha Inicial"
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                value={newTenantPassword}
                                onChange={e => setNewTenantPassword(e.target.value)}
                                required
                            />
                        ) : (
                            <div className="text-xs text-slate-500 italic">
                                * Edição de senha via email não suportada diretamente aqui
                            </div>
                        )}
                    </div>

                    {editingId && (
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-3">
                            <p className="text-xs text-slate-400 font-bold uppercase">Status</p>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="status" checked={tenantStatus === 'active'} onChange={() => setTenantStatus('active')} />
                                    <span className={tenantStatus === 'active' ? 'text-emerald-400' : 'text-slate-400'}>Ativo</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="status" checked={tenantStatus === 'inactive'} onChange={() => setTenantStatus('inactive')} />
                                    <span className={tenantStatus === 'inactive' ? 'text-rose-400' : 'text-slate-400'}>Inativo / Bloqueado</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={creating}>{creating ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Criar Empresa')}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
