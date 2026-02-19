import React, { useState, useEffect, useRef } from 'react';
import { Loader, Button, Input, Modal, Select, Badge, Avatar, cn, Card } from '../../components/Shared';
import {
    Search, Plus, User as UserIcon, Building2, AlertTriangle, Key,
    CheckCircle2, MoreVertical, Shield, Lock, Power, LogOut, Trash2,
    Filter, Mail, Clock, ShieldAlert, UserCog
} from 'lucide-react';
import { api, getErrorMessage } from '../../services/api';
import { Company, User } from '../../types';
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

    // Action Modals State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [actionModal, setActionModal] = useState<'company' | 'role' | 'password' | 'edit' | 'none'>('none');
    const [actionValue, setActionValue] = useState(''); // For password reset or other inputs

    // Create User State
    const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', companyId: '', role: 'user', password: '' });
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
        if (!newUser.companyId) return alert("Selecione a empresa para vincular o usuário.");
        if (!newUser.password || newUser.password.length < 6) return alert("Senha deve ter no mínimo 6 caracteres.");

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
            console.error(error);
            alert("Erro ao criar usuário: " + getErrorMessage(error));
        }
    }

    const closeAndReset = () => {
        setIsModalOpen(false);
        setCreateStep(1);
        setNewUser({ name: '', email: '', phone: '', companyId: '', role: 'user', password: '' });
        setTempPassword('');
        setSelectedUser(null);
        setActionModal('none');
    };

    const handleAccessCompany = (companyId: string) => {
        switchCompany(companyId);
        navigate('/dashboard');
    };

    const handleAction = async () => {
        if (!selectedUser) return;
        try {
            if (actionModal === 'password') {
                if (actionValue.length < 6) return alert("Senha muito curta");
                await api.adminResetPassword(selectedUser.id, actionValue);
                alert("Senha resetada com sucesso!");
            }
            if (actionModal === 'role') {
                await api.adminUpdateUserRole(selectedUser.id, actionValue);
                loadData();
            }
            // Add other actions (Suspend/Block) logic here if needed, utilizing api.adminUpdateUserStatus

            setActionModal('none');
            setActionValue('');
            setSelectedUser(null);
        } catch (error: any) {
            alert(getErrorMessage(error));
        }
    }

    // Filter Logic
    const filteredUsers = users.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = filterRole === 'all' ? true : u.role === filterRole;
        const matchStatus = filterStatus === 'all' ? true : u.status === filterStatus;
        const matchCompany = filterCompany === 'all' ? true : u.companyId === filterCompany;
        return matchSearch && matchRole && matchStatus && matchCompany;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Usuários Globais</h1>
                    <p className="text-gray-500 mt-1">Gerencie todos os usuários de todas as empresas</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Novo Usuário
                </Button>
            </div>

            <Card className="border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Buscar usuário..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 bg-white"
                        />
                    </div>

                    <Select
                        value={filterCompany}
                        onChange={e => setFilterCompany(e.target.value)}
                        className="w-48 bg-white"
                        options={[
                            { value: 'all', label: 'Todas Empresas' },
                            ...availableCompanies.map(c => ({ value: c.id, label: c.name }))
                        ]}
                    />

                    <Select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value as any)}
                        className="w-36 bg-white"
                        options={[
                            { value: 'all', label: 'Todos Perfis' },
                            { value: 'super_admin', label: 'Super Admin' },
                            { value: 'admin', label: 'Admin' },
                            { value: 'user', label: 'Usuário' }
                        ]}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Usuário</th>
                                <th className="px-6 py-3">Empresa</th>
                                <th className="px-6 py-3">Perfil</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Carregando usuários...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50/50 group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{user.name}</div>
                                                    <div className="text-gray-500 text-xs">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(user as any).companyName || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className="capitalize">
                                                {user.role.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className={
                                                user.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    user.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                            }>
                                                {user.status || 'unknown'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <Button variant="ghost" size="icon" onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}>
                                                <MoreVertical className="w-4 h-4 text-gray-400" />
                                            </Button>

                                            {activeMenuId === user.id && (
                                                <div className="absolute right-8 top-8 z-50 bg-white border border-gray-200 shadow-xl rounded-lg w-48 py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                                                    <button onClick={() => {
                                                        if (user.companyId) handleAccessCompany(user.companyId);
                                                    }} className="w-full px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2">
                                                        <LogOut className="w-4 h-4" /> Acessar Empresa
                                                    </button>
                                                    <button onClick={() => {
                                                        setSelectedUser(user);
                                                        setActionModal('password');
                                                        setActiveMenuId(null);
                                                    }} className="w-full px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2">
                                                        <Key className="w-4 h-4" /> Resetar Senha
                                                    </button>
                                                    <button onClick={() => {
                                                        setSelectedUser(user);
                                                        setActionModal('role');
                                                        setActiveMenuId(null);
                                                    }} className="w-full px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2">
                                                        <Shield className="w-4 h-4" /> Alterar Perfil
                                                    </button>
                                                    {/* Add Delete/Suspend options here */}
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

            {/* Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeAndReset}
                title="Novo Usuário"
                width="max-w-xl"
            >
                {createStep === 1 ? (
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input label="Nome Completo" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                        <Input label="Email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                        <Input label="Telefone (WhatsApp)" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa Vinculada</label>
                            <Select
                                value={newUser.companyId}
                                onChange={e => setNewUser({ ...newUser, companyId: e.target.value })}
                                options={[
                                    { value: '', label: 'Selecione uma empresa...' },
                                    ...availableCompanies.map(c => ({ value: c.id, label: c.name }))
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Perfil de Acesso"
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                options={[
                                    { value: 'user', label: 'Usuário Padrão' },
                                    { value: 'admin', label: 'Administrador' }
                                ]}
                            />
                            <Input label="Senha Inicial" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required minLength={6} />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={closeAndReset}>Cancelar</Button>
                            <Button type="submit">Criar Usuário</Button>
                        </div>
                    </form>
                ) : (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Usuário Criado!</h3>
                        <p className="text-gray-500">
                            Acesso liberado para <strong>{newUser.email}</strong>.
                        </p>
                        <div className="bg-gray-100 p-4 rounded-lg text-left mx-auto max-w-sm">
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Senha Temporária</p>
                            <div className="flex justify-between items-center">
                                <code className="text-lg font-mono font-bold text-gray-800">{tempPassword}</code>
                            </div>
                        </div>
                        <Button onClick={closeAndReset} className="w-full">Concluir</Button>
                    </div>
                )}
            </Modal>

            {/* Action Modal (Password/Role) */}
            <Modal
                isOpen={actionModal !== 'none'}
                onClose={() => setActionModal('none')}
                title={actionModal === 'password' ? 'Resetar Senha' : 'Alterar Perfil'}
                width="max-w-md"
            >
                <div className="space-y-4">
                    {actionModal === 'password' && (
                        <Input
                            label="Nova Senha"
                            type="password"
                            value={actionValue}
                            onChange={e => setActionValue(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                        />
                    )}

                    {actionModal === 'role' && (
                        <Select
                            label="Novo Perfil"
                            value={actionValue}
                            onChange={e => setActionValue(e.target.value)}
                            options={[
                                { value: 'user', label: 'Usuário Padrão' },
                                { value: 'admin', label: 'Administrador' }
                            ]}
                        />
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setActionModal('none')}>Cancelar</Button>
                        <Button onClick={handleAction}>Confirmar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
