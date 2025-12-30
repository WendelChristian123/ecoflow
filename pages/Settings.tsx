
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Delegation } from '../types';
import { Loader, Button, Avatar, Badge, Card, Input } from '../components/Shared';
import { useRBAC } from '../context/RBACContext';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { Plus, Search, Shield, ShieldCheck, Trash2, UserPlus, Users as UsersIcon, XCircle, CheckCircle } from 'lucide-react';
import { CreateUserModal, EditPermissionsModal, DelegationModal } from '../components/UserModals';

export const SettingsPage: React.FC = () => {
    const { user: authUser } = useAuth(); // Get current logged user
    const { isAdmin, canDelete } = useRBAC();
    const [users, setUsers] = useState<User[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    // Modals State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDelegationOpen, setIsDelegationOpen] = useState(false);
    const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, delegationsData] = await Promise.all([
                api.getUsers(),
                api.getMyDelegations()
            ]);
            setUsers(usersData);
            setDelegations(delegationsData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!canDelete()) return;
        if (window.confirm("Tem certeza que deseja excluir este usuário?")) {
            await api.deleteUser(id);
            loadData();
        }
    };

    const handleDeleteDelegation = async (id: string) => {
        if (window.confirm("Revogar este acesso?")) {
            await api.deleteDelegation(id);
            loadData();
        }
    };

    if (loading) return <Loader />;

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(search.toLowerCase()) || 
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    // Filter out the current user correctly for the delegation modal
    const usersAvailableToDelegate = users.filter(u => u.email !== authUser?.email);

    const translateModule = (m: string) => {
        if (m === 'tasks') return 'Tarefas';
        if (m === 'agenda') return 'Agenda';
        if (m === 'finance') return 'Financeiro';
        return m;
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Configurações & Acesso</h1>
                    <p className="text-slate-400 text-sm">Gerencie equipe e compartilhamento de dados</p>
                </div>
            </div>

            {/* DELEGATION SECTION (Available to ALL users) */}
            <Card className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <UsersIcon size={20} className="text-indigo-500" />
                            Meus Acessos Compartilhados
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Usuários listados aqui podem visualizar ou editar seus dados conforme permissão.
                        </p>
                    </div>
                    <Button variant="secondary" className="gap-2" onClick={() => setIsDelegationOpen(true)}>
                        <UserPlus size={16} /> Conceder Acesso
                    </Button>
                </div>

                {delegations.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">
                        Você não compartilhou acesso com ninguém ainda.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {delegations.map(del => (
                            <div key={del.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-3 relative group hover:border-indigo-500/50 transition-colors">
                                <button 
                                    onClick={() => handleDeleteDelegation(del.id)} 
                                    className="absolute top-2 right-2 text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Revogar Acesso"
                                >
                                    <XCircle size={18} />
                                </button>
                                
                                <div className="flex items-center gap-3">
                                    <Avatar src={del.delegate?.avatarUrl} name={del.delegate?.name || 'Desconhecido'} />
                                    <div className="overflow-hidden">
                                        <div className="font-medium text-white truncate">{del.delegate?.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{del.delegate?.email}</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                                    <Badge variant="default">{translateModule(del.module)}</Badge>
                                    <div className="flex gap-1">
                                        {del.permissions.view && <span title="Ver" className="text-emerald-400 bg-emerald-500/10 p-1 rounded"><CheckCircle size={12}/></span>}
                                        {del.permissions.create && <span title="Criar" className="text-blue-400 bg-blue-500/10 p-1 rounded"><Plus size={12}/></span>}
                                        {del.permissions.edit && <span title="Editar" className="text-amber-400 bg-amber-500/10 p-1 rounded"><Shield size={12}/></span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* ADMIN SECTION (User List) */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <ShieldCheck size={20} className="text-emerald-500" />
                            Diretório de Usuários
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Visão geral de todos os usuários do sistema.</p>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-4">
                            <div className="relative w-48 hidden sm:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <Input 
                                    placeholder="Buscar..." 
                                    value={search} 
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9 py-1.5 text-sm"
                                />
                            </div>
                            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                                <Plus size={18} /> Criar
                            </Button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-3">Usuário</th>
                                <th className="px-4 py-3">Contato</th>
                                <th className="px-4 py-3">Função</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar src={user.avatarUrl} name={user.name} />
                                            <div>
                                                <div className="font-medium text-white">{user.name}</div>
                                                <div className="text-xs text-slate-500">ID: {user.id.substring(0, 8)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{user.email}</div>
                                        <div className="text-xs text-slate-500">{user.phone}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={user.role === 'admin' ? 'success' : 'neutral'}>
                                            {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isAdmin && user.role !== 'admin' && (
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setEditingPermissionsUser(user)}
                                                    className="p-1.5 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 rounded transition-colors"
                                                    title="Editar Permissões"
                                                >
                                                    <Shield size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded transition-colors"
                                                    title="Excluir Usuário"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {(!isAdmin || user.role === 'admin') && (
                                            <span className="text-xs text-slate-600 italic">Sem ações</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <CreateUserModal 
                isOpen={isCreateOpen} 
                onClose={() => setIsCreateOpen(false)} 
                onSuccess={loadData} 
            />

            <EditPermissionsModal 
                isOpen={!!editingPermissionsUser} 
                onClose={() => setEditingPermissionsUser(null)} 
                onSuccess={loadData} 
                user={editingPermissionsUser} 
            />

            <DelegationModal
                isOpen={isDelegationOpen}
                onClose={() => setIsDelegationOpen(false)}
                onSuccess={loadData}
                users={usersAvailableToDelegate}
            />
        </div>
    );
};
