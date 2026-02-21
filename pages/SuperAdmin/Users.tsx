import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, Badge, Card } from '../../components/Shared';
import {
    Search, Plus, Key, CheckCircle2, MoreVertical, Shield,
    Power, LogOut, RefreshCw, Users as UsersIcon, Trash2
} from 'lucide-react';
import { api, getErrorMessage } from '../../services/api';
import { User } from '../../types';
import { useCompany } from '../../context/CompanyContext';
import { useNavigate } from 'react-router-dom';

export const SuperAdminUsers: React.FC = () => {
    const { availableCompanies, switchCompany } = useCompany();
    const navigate = useNavigate();

    // Filters State
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | 'super_admin' | 'admin' | 'user'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'blocked'>('all');
    const [filterCompany, setFilterCompany] = useState<string>('all');

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Action Modals State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [actionModal, setActionModal] = useState<'status' | 'role' | 'password' | 'delete' | 'none'>('none');
    const [actionValue, setActionValue] = useState('');

    // Create User State
    const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', companyId: '', role: 'user', password: '' });
    const [tempPassword, setTempPassword] = useState('');

    // Users Data
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => { loadData(); }, []);

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getGlobalUsers();
            setUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.companyId) return alert('Selecione a empresa para vincular o usuário.');
        if (!newUser.password || newUser.password.length < 6) return alert('Senha deve ter no mínimo 6 caracteres.');

        try {
            await api.createUser({
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                password: newUser.password,
                role: newUser.role as any
            }, newUser.companyId);

            setTempPassword(newUser.password);
            setCreateStep(2);
            loadData();
        } catch (error: any) {
            alert('Erro ao criar usuário: ' + getErrorMessage(error));
        }
    };

    const closeAndReset = () => {
        setIsModalOpen(false);
        setCreateStep(1);
        setNewUser({ name: '', email: '', phone: '', companyId: '', role: 'user', password: '' });
        setTempPassword('');
        setSelectedUser(null);
        setActionModal('none');
        setActionValue('');
    };

    const handleAccessCompany = (companyId: string) => {
        switchCompany(companyId);
        navigate('/dashboard');
    };

    const handleAction = async () => {
        if (!selectedUser || actionLoading) return;
        setActionLoading(true);
        try {
            if (actionModal === 'password') {
                if (!actionValue || actionValue.length < 6) {
                    alert('Senha deve ter no mínimo 6 caracteres');
                    return;
                }
                await api.adminResetPassword(selectedUser.id, actionValue);
                alert('Senha resetada com sucesso!');
                loadData();
            }
            if (actionModal === 'role') {
                if (!actionValue) return;
                await api.adminUpdateUserRole(selectedUser.id, actionValue);
                loadData();
            }
            if (actionModal === 'status') {
                await api.adminUpdateUserStatus(selectedUser.id as any, actionValue as any);
                loadData();
            }
            if (actionModal === 'delete') {
                await api.adminDeleteUser(selectedUser.id);
                loadData();
            }
            setActionModal('none');
            setActionValue('');
            setSelectedUser(null);
        } catch (error: any) {
            alert(getErrorMessage(error));
        } finally {
            setActionLoading(false);
        }
    };

    // Filter Logic
    const filteredUsers = users.filter(u => {
        const term = search.toLowerCase();
        const matchSearch = u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
        const matchRole = filterRole === 'all' || u.role === filterRole;
        const userStatus = u.status || 'active';
        const matchStatus = filterStatus === 'all' || userStatus === filterStatus;
        const matchCompany = filterCompany === 'all' || u.companyId === filterCompany;
        return matchSearch && matchRole && matchStatus && matchCompany;
    });

    const getStatusLabel = (status?: string | null) => {
        if (!status || status === 'active') return 'Ativo';
        if (status === 'suspended') return 'Suspenso';
        if (status === 'blocked') return 'Bloqueado';
        return status;
    };

    const getStatusClass = (status?: string | null) => {
        if (!status || status === 'active') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (status === 'suspended') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        if (status === 'blocked') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        return 'bg-gray-100 text-gray-600';
    };

    const getRoleLabel = (role: string) => {
        if (role === 'super_admin') return 'Super Admin';
        if (role === 'admin') return 'Admin';
        return 'Usuário';
    };

    const selectClass = "w-full bg-card border border-input text-foreground rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer appearance-none";

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <UsersIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Usuários Globais</h1>
                        <p className="text-sm text-muted-foreground">
                            {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrados
                        </p>
                    </div>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Novo Usuário
                </Button>
            </div>

            {/* Filters Card */}
            <Card noPadding>
                <div className="p-4 border-b border-border">
                    <div className="flex flex-col md:flex-row gap-3 items-center">
                        {/* Search */}
                        <div className="relative flex-1 w-full">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`${selectClass} pl-9`}
                            />
                        </div>

                        {/* Company Filter */}
                        <div className="relative w-full md:w-44">
                            <select
                                value={filterCompany}
                                onChange={e => setFilterCompany(e.target.value)}
                                className={selectClass}
                            >
                                <option value="all">Todas Empresas</option>
                                {availableCompanies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Role Filter */}
                        <div className="relative w-full md:w-40">
                            <select
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value as any)}
                                className={selectClass}
                            >
                                <option value="all">Todos Perfis</option>
                                <option value="super_admin">Super Admin</option>
                                <option value="admin">Admin</option>
                                <option value="user">Usuário</option>
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="relative w-full md:w-40">
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value as any)}
                                className={selectClass}
                            >
                                <option value="all">Todos Status</option>
                                <option value="active">Ativo</option>
                                <option value="suspended">Suspenso</option>
                                <option value="blocked">Bloqueado</option>
                            </select>
                        </div>

                        {/* Refresh Button */}
                        <Button variant="outline" size="sm" onClick={loadData} className="shrink-0 w-full md:w-auto">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar
                        </Button>
                    </div>

                    {/* Active filters indicator */}
                    {(filterRole !== 'all' || filterStatus !== 'all' || filterCompany !== 'all' || search) && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Filtrando:</span>
                            <span className="font-medium text-foreground">{filteredUsers.length} de {users.length} usuários</span>
                            <button
                                onClick={() => { setSearch(''); setFilterRole('all'); setFilterStatus('all'); setFilterCompany('all'); }}
                                className="text-primary hover:underline ml-auto"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                            <tr>
                                <th className="px-6 py-3">Usuário</th>
                                <th className="px-6 py-3">Empresa</th>
                                <th className="px-6 py-3">Perfil</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                            <span className="text-sm">Carregando usuários...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                        <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">Nenhum usuário encontrado</p>
                                        <p className="text-xs mt-1">Tente ajustar os filtros</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                                    {user.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground">{user.name}</div>
                                                    <div className="text-muted-foreground text-xs">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-sm">
                                            {(user as any).companyName || <span className="italic opacity-50">Sem empresa</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                                                <Shield className="w-3 h-3" />
                                                {getRoleLabel(user.role)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusClass(user.status)}`}>
                                                {getStatusLabel(user.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === user.id ? null : user.id); }}
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {activeMenuId === user.id && (
                                                <div className="absolute right-12 top-2 z-50 bg-popover border border-border shadow-xl rounded-xl w-52 py-1 text-left">
                                                    {user.companyId && (
                                                        <button
                                                            onClick={() => handleAccessCompany(user.companyId!)}
                                                            className="w-full px-4 py-2.5 hover:bg-muted text-sm text-foreground flex items-center gap-2.5 transition-colors"
                                                        >
                                                            <LogOut className="w-4 h-4 text-muted-foreground" />
                                                            Acessar como Admin
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setActionValue('');
                                                            setActionModal('password');
                                                            setActiveMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2.5 hover:bg-muted text-sm text-foreground flex items-center gap-2.5 transition-colors"
                                                    >
                                                        <Key className="w-4 h-4 text-muted-foreground" />
                                                        Resetar Senha
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setActionValue(user.role || 'user');
                                                            setActionModal('role');
                                                            setActiveMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2.5 hover:bg-muted text-sm text-foreground flex items-center gap-2.5 transition-colors"
                                                    >
                                                        <Shield className="w-4 h-4 text-muted-foreground" />
                                                        Alterar Perfil
                                                    </button>
                                                    <div className="h-px bg-border my-1" />
                                                    {(user.status || 'active') === 'active' ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setActionValue('suspended');
                                                                setActionModal('status');
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full px-4 py-2.5 hover:bg-muted text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2.5 transition-colors"
                                                        >
                                                            <Power className="w-4 h-4" />
                                                            Suspender Usuário
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setActionValue('active');
                                                                setActionModal('status');
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full px-4 py-2.5 hover:bg-muted text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5 transition-colors"
                                                        >
                                                            <Power className="w-4 h-4" />
                                                            Reativar Usuário
                                                        </button>
                                                    )}
                                                    <div className="h-px bg-border my-1" />
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setActionModal('delete');
                                                            setActiveMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2.5 hover:bg-destructive/10 text-sm text-destructive flex items-center gap-2.5 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Excluir Usuário
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Footer */}
                    {!loading && filteredUsers.length > 0 && (
                        <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                            Exibindo {filteredUsers.length} de {users.length} usuários
                        </div>
                    )}
                </div>
            </Card>

            {/* Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeAndReset}
                title="Criar Novo Usuário"
            >
                {createStep === 1 ? (
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input label="Nome Completo" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                        <Input label="Email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                        <Input label="Telefone (WhatsApp)" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />

                        <div>
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">Empresa Vinculada</label>
                            <select
                                value={newUser.companyId}
                                onChange={e => setNewUser({ ...newUser, companyId: e.target.value })}
                                className="w-full bg-card border border-input text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer"
                                required
                            >
                                <option value="">Selecione uma empresa...</option>
                                {availableCompanies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">Perfil de Acesso</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full bg-card border border-input text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer"
                                >
                                    <option value="user">Usuário Padrão</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <Input label="Senha Inicial" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required minLength={6} />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={closeAndReset}>Cancelar</Button>
                            <Button type="submit">Criar Usuário</Button>
                        </div>
                    </form>
                ) : (
                    <div className="text-center py-4 space-y-4">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Usuário Criado!</h3>
                        <p className="text-muted-foreground">Acesso liberado para <strong>{newUser.email}</strong>.</p>
                        <div className="bg-muted p-4 rounded-lg text-left mx-auto max-w-sm">
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Senha Temporária</p>
                            <code className="text-lg font-mono font-bold text-foreground">{tempPassword}</code>
                        </div>
                        <Button onClick={closeAndReset} className="w-full">Concluir</Button>
                    </div>
                )}
            </Modal>

            {/* Action Modal */}
            <Modal
                isOpen={actionModal !== 'none'}
                onClose={() => { setActionModal('none'); setActionValue(''); }}
                title={
                    actionModal === 'password' ? `Resetar Senha — ${selectedUser?.name}` :
                        actionModal === 'role' ? `Alterar Perfil — ${selectedUser?.name}` :
                            actionModal === 'status' ? `Alterar Status — ${selectedUser?.name}` :
                                actionModal === 'delete' ? `Excluir Usuário — ${selectedUser?.name}` : ''
                }
            >
                <div className="space-y-4">
                    {actionModal === 'password' && (
                        <>
                            <p className="text-sm text-muted-foreground">Defina uma nova senha. Mínimo de 6 caracteres.</p>
                            <Input
                                label="Nova Senha"
                                type="password"
                                value={actionValue}
                                onChange={e => setActionValue(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                autoFocus
                            />
                        </>
                    )}

                    {actionModal === 'role' && (
                        <>
                            <p className="text-sm text-muted-foreground">Selecione o novo perfil de acesso.</p>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1 uppercase tracking-wider">Perfil</label>
                                <select
                                    value={actionValue}
                                    onChange={e => setActionValue(e.target.value)}
                                    className="w-full bg-card border border-input text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-ring focus:border-primary outline-none cursor-pointer"
                                >
                                    <option value="user">Usuário Padrão</option>
                                    <option value="admin">Administrador</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                        </>
                    )}

                    {actionModal === 'status' && (
                        <div className={`p-4 rounded-xl border ${actionValue === 'suspended' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'}`}>
                            <p className="text-sm font-medium">
                                {actionValue === 'suspended'
                                    ? `⚠️ Suspender ${selectedUser?.name}? O usuário perderá o acesso ao sistema.`
                                    : `✓ Reativar ${selectedUser?.name}? O usuário voltará a ter acesso.`
                                }
                            </p>
                        </div>
                    )}

                    {actionModal === 'delete' && (
                        <div className="p-4 rounded-xl border bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800">
                            <p className="text-sm font-medium text-red-800 dark:text-red-400">
                                ⚠️ Tem certeza que deseja excluir permanentemente {selectedUser?.name}? Esta ação não pode ser desfeita.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => { setActionModal('none'); setActionValue(''); }}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleAction}
                            disabled={actionLoading}
                            className={(actionModal === 'status' && actionValue === 'suspended') || actionModal === 'delete' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}
                        >
                            {actionLoading ? 'Salvando...' : 'Confirmar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
