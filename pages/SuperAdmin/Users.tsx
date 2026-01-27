import React, { useState, useEffect, useRef } from 'react';
import { Loader, Button, Input, Modal, Select, Badge, Avatar, cn } from '../../components/Shared';
import {
    Search, Plus, User as UserIcon, Building2, AlertTriangle, Key,
    CheckCircle2, MoreVertical, Shield, Lock, Power, LogOut, Trash2,
    Filter, Mail, Clock, ShieldAlert, UserCog
} from 'lucide-react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant, User } from '../../types';
import { useTenant } from '../../context/TenantContext';
import { useNavigate } from 'react-router-dom';

export const SuperAdminUsers: React.FC = () => {
    const { availableTenants, switchTenant } = useTenant();
    const navigate = useNavigate();

    // Filters State
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | 'super_admin' | 'admin' | 'user'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'blocked'>('all');
    const [filterTenant, setFilterTenant] = useState<string>('all');

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Action Modals State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [actionModal, setActionModal] = useState<'tenant' | 'role' | 'password' | 'edit' | 'none'>('none');
    const [actionValue, setActionValue] = useState(''); // For password reset or other inputs

    // Create User State
    const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', tenantId: '', role: 'user', password: '' });
    const [tempPassword, setTempPassword] = useState('');

    // Users Data
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    // Click outside to close menu
    React.useEffect(() => {
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
        if (!newUser.tenantId) return alert("Selecione a empresa para vincular o usuário.");
        if (!newUser.password || newUser.password.length < 6) return alert("Senha deve ter no mínimo 6 caracteres.");

        try {
            await api.createUser({
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                password: newUser.password,
                role: newUser.role as any
            }, newUser.tenantId);

            setTempPassword(newUser.password);
            setCreateStep(2);
            loadData();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao criar usuário: " + getErrorMessage(error));
        }
    }

    const closeAndReset = () => {
        setIsModalOpen(false);
        setCreateStep(1);
        setNewUser({ name: '', email: '', phone: '', tenantId: '', role: 'user', password: '' });
        setTempPassword('');
        setSelectedUser(null);
        setActionModal('none');
    };

    const handleAccessTenant = (tenantId: string) => {
        switchTenant(tenantId);
        navigate('/dashboard');
    };

    const handleForceLogout = async (user: User) => {
        if (!confirm(`Tem certeza que deseja forçar o logout de ${user.name}?`)) return;
        try {
            await api.adminForceLogout(user.id);
            alert("Logout forçado com sucesso. O usuário será desconectado na próxima ação.");
        } catch (error) {
            alert("Erro ao forçar logout: " + getErrorMessage(error));
        }
    };

    const handleToggleSuspend = async (user: User) => {
        const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
        if (!confirm(`Deseja realmente ${newStatus === 'active' ? 'reativar' : 'suspender'} o usuário ${user.name}?`)) return;

        try {
            await api.adminUpdateUserStatus(user.id, newStatus);
            setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
        } catch (error) {
            alert("Erro ao alterar status: " + getErrorMessage(error));
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`ATENÇÃO: Deseja realmente excluir permanentemente o usuário ${user.name}? Esta ação não pode ser desfeita.`)) return;

        try {
            await api.deleteUser(user.id);
            setUsers(users.filter(u => u.id !== user.id));
        } catch (error) {
            alert("Erro ao excluir usuário: " + getErrorMessage(error));
        }
    };


    // Filter Logic
    const filteredUsers = users.filter((u) => {
        const matchesSearch =
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            (u.companyName && u.companyName.toLowerCase().includes(search.toLowerCase()));

        const matchesRole = filterRole === 'all' || u.role === filterRole;
        const matchesStatus = filterStatus === 'all' || (u.status || 'active') === filterStatus;
        const matchesTenant = filterTenant === 'all' || u.tenantId === filterTenant;

        return matchesSearch && matchesRole && matchesStatus && matchesTenant;
    });

    const getUserStatusColor = (status?: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'suspended': return 'warning';
            case 'blocked': return 'error';
            default: return 'neutral';
        }
    };

    const getLastAccessBadge = (lastActiveAt?: string) => {
        if (!lastActiveAt) return <Badge variant="neutral" className="h-5 px-1.5 text-[10px] text-muted-foreground">Nunca acessou</Badge>;

        const date = new Date(lastActiveAt);
        const now = new Date();
        const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffHours < 0.5) return <Badge variant="success" className="h-5 px-1.5 text-[10px] bg-primary/20 text-primary border-primary/30 animate-pulse">Online agora</Badge>;
        if (diffHours < 24) return <Badge variant="neutral" className="h-5 px-1.5 text-[10px] text-primary bg-primary/10 border-primary/20">Ativo hoje</Badge>;
        if (diffHours < 24 * 7) return <Badge variant="neutral" className="h-5 px-1.5 text-[10px] text-muted-foreground">Ativo 7d</Badge>;
        return <Badge variant="neutral" className="h-5 px-1.5 text-[10px] text-muted-foreground">Inativo 30d+</Badge>;
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
                    <p className="text-muted-foreground text-sm">Base global de usuários de todas as empresas.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Plus size={18} /> Novo Usuário
                </Button>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 bg-card/50 p-4 rounded-xl border border-border">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input placeholder="Buscar usuário, email ou empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 py-2 text-sm bg-card border-input" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <div className="min-w-[140px]">
                        <select value={filterRole} onChange={e => setFilterRole(e.target.value as any)} className="w-full bg-card border border-input text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:border-primary pointer-cursor">
                            <option value="all">Função: Todas</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="user">Usuário</option>
                        </select>
                    </div>
                    <div className="min-w-[140px]">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="w-full bg-card border border-input text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:border-primary pointer-cursor">
                            <option value="all">Status: Todos</option>
                            <option value="active">Ativo</option>
                            <option value="suspended">Suspenso</option>
                            <option value="blocked">Bloqueado</option>
                        </select>
                    </div>
                    <div className="min-w-[160px]">
                        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)} className="w-full bg-card border border-input text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:border-primary pointer-cursor">
                            <option value="all">Empresa: Todas</option>
                            {availableTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-visible min-h-[400px]">
                <table className="w-full text-left text-sm text-muted-foreground">
                    <thead className="bg-muted/50 text-foreground uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Empresa (Tenant)</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">Nenhum usuário encontrado.</td></tr>
                        ) : filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-muted/10 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar name={user.name} />
                                        <div>
                                            <div className="font-medium text-foreground">{user.name}</div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                            <div className="mt-1">{getLastAccessBadge(user.lastAccessStatus)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => { setSelectedUser(user); setActionModal('tenant'); }}
                                        className="flex items-center gap-2 hover:bg-secondary px-2 py-1 rounded transition-colors group/btn text-left"
                                    >
                                        <Building2 size={14} className="text-primary" />
                                        <span className="group-hover/btn:text-foreground transition-colors decoration-primary/50 underline-offset-4 group-hover/btn:underline">{user.companyName || 'N/A'}</span>
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => { setSelectedUser(user); setActionModal('role'); }}
                                        className="hover:opacity-80 transition-opacity"
                                    >
                                        <Badge variant={user.role === 'super_admin' ? 'warning' : user.role === 'admin' ? 'success' : 'neutral'}>
                                            {user.role}
                                        </Badge>
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleToggleSuspend(user)}
                                        title="Clique para alterar status"
                                    >
                                        <Badge variant={getUserStatusColor(user.status)}>
                                            {user.status === 'active' ? 'Ativo' : user.status === 'suspended' ? 'Suspenso' : 'Bloqueado'}
                                        </Badge>
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right relative">
                                    <div className="relative inline-block">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === user.id ? null : user.id); }}
                                            className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <MoreVertical size={18} />
                                        </button>

                                        {activeMenuId === user.id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-premium z-50 py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                                <button onClick={() => { setSelectedUser(user); setActionModal('tenant'); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground text-left w-full transition-colors">
                                                    <Building2 size={16} /> Detalhes Empresa
                                                </button>
                                                <button onClick={() => { setSelectedUser(user); setActionModal('role'); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground text-left w-full transition-colors">
                                                    <Shield size={16} /> Gerenciar Papel
                                                </button>
                                                <button onClick={() => { setSelectedUser(user); setActionModal('edit'); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground text-left w-full transition-colors">
                                                    <UserCog size={16} /> Editar Dados
                                                </button>
                                                <button onClick={() => { setSelectedUser(user); setActionModal('password'); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground text-left w-full transition-colors">
                                                    <Key size={16} /> Resetar Senha
                                                </button>
                                                <div className="h-px bg-border my-1" />
                                                <button onClick={() => handleForceLogout(user)} className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left w-full transition-colors">
                                                    <LogOut size={16} /> Forçar Logout
                                                </button>
                                                <button onClick={() => handleToggleSuspend(user)} className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left w-full transition-colors">
                                                    <ShieldAlert size={16} /> {user.status === 'suspended' ? 'Reativar' : 'Suspender'}
                                                </button>
                                                <button onClick={() => handleDeleteUser(user)} className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left w-full transition-colors">
                                                    <Trash2 size={16} /> Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Create User */}
            <Modal isOpen={isModalOpen} onClose={closeAndReset} title={createStep === 1 ? "Novo Usuário" : "Usuário Criado"}>
                {createStep === 1 ? (
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-start gap-3">
                            <Building2 className="text-primary shrink-0" size={18} />
                            <p className="text-xs text-primary">
                                <strong>Vínculo Obrigatório:</strong> Todo usuário deve pertencer a uma empresa (Tenant).
                                Ele só verá dados desta empresa.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Nome Completo" placeholder="Ex: Ana Clara" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                            <Input label="Telefone" placeholder="(00) 00000-0000" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
                        </div>
                        <Input label="Email Corporativo" type="email" placeholder="ana@empresa.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 ml-1">Empresa Vinculada</label>
                                <Select value={newUser.tenantId} onChange={e => setNewUser({ ...newUser, tenantId: e.target.value })} required>
                                    <option value="">Selecione...</option>
                                    {availableTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 ml-1">Nível de Acesso</label>
                                <Select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                    <option value="user">Usuário Padrão</option>
                                    <option value="admin">Administrador da Empresa</option>
                                </Select>
                            </div>
                        </div>
                        <Input label="Senha Inicial" type="password" placeholder="Mínimo 6 caracteres" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                        <div className="flex justify-end pt-4 gap-2 border-t border-slate-800">
                            <Button type="button" variant="ghost" onClick={closeAndReset}>Cancelar</Button>
                            <Button type="submit">Criar Usuário</Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6 text-center py-4">
                        <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4"><UserIcon size={32} /></div>
                        <h3 className="text-xl font-bold text-foreground">Usuário Criado com Sucesso!</h3>
                        <div className="bg-secondary border border-border p-4 rounded-lg text-left space-y-3">
                            <div>
                                <span className="text-xs text-muted-foreground uppercase block mb-1">Acesso</span>
                                <div className="text-foreground font-mono bg-card p-2 rounded border border-border">{newUser.email}</div>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground uppercase block mb-1">Senha Provisória</span>
                                <div className="flex items-center gap-2">
                                    <div className="text-primary font-mono text-lg font-bold bg-card p-2 rounded border border-primary/30 flex-1 text-center tracking-wider">{tempPassword}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2 text-left">
                            <Key className="text-destructive shrink-0" size={16} />
                            <p className="text-xs text-destructive"><strong>Importante:</strong> Esta senha deve ser trocada no primeiro acesso.</p>
                        </div>
                        <Button onClick={closeAndReset} className="w-full">Concluir</Button>
                    </div>
                )}
            </Modal>

            {/* Modal Company Info */}
            <Modal isOpen={actionModal === 'tenant' && !!selectedUser} onClose={() => setActionModal('none')} title="Detalhes da Empresa">
                {selectedUser && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                                {selectedUser.companyName?.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{selectedUser.companyName}</h3>
                                <div className="flex gap-2 mt-1">
                                    <Badge variant="success">Cliente</Badge>
                                    <Badge variant="default">Plano Padrão</Badge>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2 text-sm text-slate-300">
                            <p><strong>Usuário Vinculado:</strong> {selectedUser.name}</p>
                            <p><strong>Email:</strong> {selectedUser.email}</p>
                        </div>
                        <Button onClick={() => { if (selectedUser.tenantId) handleAccessTenant(selectedUser.tenantId); }} className="w-full gap-2">
                            <UserCog size={16} /> Acessar Painel desta Empresa
                        </Button>
                    </div>
                )}
            </Modal>



            {/* Modal Role Manager */}
            <Modal isOpen={actionModal === 'role' && !!selectedUser} onClose={() => setActionModal('none')} title="Gerenciar Papel (Role)">
                {selectedUser && (
                    <div className="space-y-6 text-center">
                        <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-2"><Shield size={32} /></div>
                        <p className="text-muted-foreground text-sm">
                            Alterar o nível de acesso de <strong>{selectedUser.name}</strong>.
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                            {['user', 'admin', 'super_admin'].map(r => (
                                <button
                                    key={r}
                                    onClick={async () => {
                                        try {
                                            await api.adminUpdateUserRole(selectedUser.id, r);
                                            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: r as any } : u));
                                            setActionModal('none');
                                            // alert(`Papel alterado para: ${r}`);
                                        } catch (e) {
                                            alert("Erro ao alterar papel: " + getErrorMessage(e));
                                        }
                                    }}
                                    className={cn("p-3 rounded-lg border text-left flex items-center justify-between hover:bg-secondary transition-colors", selectedUser.role === r ? 'bg-primary/10 border-primary/50' : 'bg-transparent border-input')}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-4 h-4 rounded-full border", selectedUser.role === r ? 'bg-primary border-primary' : 'border-muted-foreground')} />
                                        <span className={cn("font-medium", selectedUser.role === r ? 'text-foreground' : 'text-muted-foreground')}>{r.toUpperCase().replace('_', ' ')}</span>
                                    </div>
                                    {r === 'super_admin' && <AlertTriangle size={14} className="text-destructive" />}
                                </button>
                            ))}
                        </div>

                        {selectedUser.role === 'super_admin' && (
                            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2 text-left">
                                <AlertTriangle className="text-destructive shrink-0" size={16} />
                                <p className="text-xs text-destructive">
                                    <strong>Cuidado:</strong> Super Admins têm acesso irrestrito a todas as empresas do sistema.
                                </p>
                            </div>
                        )}

                        <Button onClick={() => setActionModal('none')} variant="secondary" className="w-full">Cancelar</Button>
                    </div>
                )}
            </Modal>

            {/* Modal Password Reset */}
            <Modal isOpen={actionModal === 'password' && !!selectedUser} onClose={() => { setActionModal('none'); setActionValue(''); }} title="Resetar Senha">
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">Digite a nova senha para <strong>{selectedUser?.name}</strong>.</p>
                    <Input
                        placeholder="Nova senha (mín 6 caracteres)"
                        type="password"
                        value={actionValue}
                        onChange={(e) => setActionValue(e.target.value)}
                    />
                    <Button
                        disabled={!actionValue || actionValue.length < 6}
                        onClick={async () => {
                            if (!selectedUser) return;
                            try {
                                await api.adminResetPassword(selectedUser.id, actionValue);
                                alert("Senha resetada com sucesso!");
                                setActionModal('none');
                                setActionValue('');
                            } catch (e) {
                                alert("Erro ao resetar senha: " + getErrorMessage(e));
                            }
                        }}
                        className="w-full"
                    >
                        Confirmar Nova Senha
                    </Button>
                </div>
            </Modal>

            {/* Modal Edit User */}
            <Modal isOpen={actionModal === 'edit' && !!selectedUser} onClose={() => { setActionModal('none'); }} title="Editar Dados">
                {selectedUser && (
                    <UserEditForm user={selectedUser} onSave={async (data) => {
                        try {
                            // Currently updateProfile updates name and phone
                            // api.updateProfile(user.id, data)
                            // But usually specialized admin update might be better if we change email etc.
                            // For now reuse basic updateProfile or create adminUpdateProfile in api if needed.
                            // Let's use api.updateProfile for now as it exists.
                            await api.updateProfile(selectedUser.id, { name: data.name, phone: data.phone });
                            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...data } : u));
                            setActionModal('none');
                        } catch (e) {
                            alert("Erro ao atualizar: " + getErrorMessage(e));
                        }
                    }} onCancel={() => setActionModal('none')} />
                )}
            </Modal>

        </div >
    );
};

const UserEditForm: React.FC<{ user: User, onSave: (data: { name: string, phone: string }) => void, onCancel: () => void }> = ({ user, onSave, onCancel }) => {
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.phone || '');

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ name, phone }); }} className="space-y-4">
            <Input label="Nome" value={name} onChange={e => setName(e.target.value)} required />
            <Input label="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Salvar Alterações</Button>
            </div>
        </form>
    );
};
