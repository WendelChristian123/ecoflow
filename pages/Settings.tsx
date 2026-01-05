
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Delegation } from '../types';
import { Loader, Button, Avatar, Badge, Card, Input } from '../components/Shared';
import { useRBAC } from '../context/RBACContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Shield, ShieldCheck, Trash2, UserPlus, Users as UsersIcon, XCircle, CheckCircle, CreditCard as CreditCardIcon, Pencil } from 'lucide-react';
import { CreateUserModal, EditUserModal, DelegationModal } from '../components/UserModals';
import { CalendarSettingsTab } from '../components/CalendarSettingsTab';
import { AuditLogsTab } from '../components/AuditLogsTab';

export const SettingsPage: React.FC = () => {
    const { user: authUser } = useAuth();
    const { isAdmin, canDelete } = useRBAC();

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [financeSettings, setFinanceSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // UI State
    const [activeTab, setActiveTab] = useState<'delegation' | 'users' | 'finance' | 'calendar' | 'audit'>('delegation');
    const [pendingMode, setPendingMode] = useState<'competence' | 'cash'>('competence');

    // Modals State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDelegationOpen, setIsDelegationOpen] = useState(false);
    const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);
    const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);

    useEffect(() => {
        if (authUser) loadData();
    }, [authUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, delegationsData, settingsData] = await Promise.all([
                api.getUsers(authUser?.tenantId),
                api.getMyDelegations(),
                api.getTenantSettings()
            ]);
            setUsers(usersData);
            setDelegations(delegationsData);
            setFinanceSettings(settingsData || {});
            setPendingMode(settingsData?.credit_card_expense_mode || 'competence');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFinanceSettings = async () => {
        try {
            const newSettings = { ...financeSettings, credit_card_expense_mode: pendingMode };
            await api.updateTenantSettings(newSettings);
            setFinanceSettings(newSettings);
            alert('Configuração salva com sucesso! O impacto nos relatórios será imediato.');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configuração.');
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
                    <p className="text-slate-400 text-sm">Gerencie equipe, acessos e regras do sistema</p>
                </div>
            </div>

            {/* TABS HEADER */}
            <div className="flex items-center gap-6 border-b border-slate-800 pb-1">
                <button
                    onClick={() => setActiveTab('delegation')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'delegation' ? 'text-emerald-500 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    Acessos Compartilhados
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'users' ? 'text-emerald-500 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                    >
                        Usuários do Sistema
                    </button>
                )}
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'finance' ? 'text-emerald-500 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                    >
                        Financeiro
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'calendar' ? 'text-emerald-500 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    Calendário
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'audit' ? 'text-emerald-500 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                    >
                        Auditoria
                    </button>
                )}
            </div>

            {/* TAB: DELEGATION */}
            {activeTab === 'delegation' && (
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
                            {delegations.map(del => {
                                const isOwner = del.ownerId === authUser?.id;
                                const otherPerson = isOwner ? del.delegate : del.owner;
                                const avatarSrc = otherPerson?.avatarUrl;
                                const canManage = isOwner || isAdmin;

                                return (
                                    <div key={del.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-3 relative group hover:border-indigo-500/50 transition-colors">
                                        {canManage && (
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingDelegation(del); setIsDelegationOpen(true); }}
                                                    className="p-1 text-slate-500 hover:text-indigo-500 transition-colors"
                                                    title="Editar Permissões"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDelegation(del.id)}
                                                    className="p-1 text-slate-500 hover:text-rose-500 transition-colors"
                                                    title="Revogar Acesso"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3">
                                            <Avatar src={avatarSrc} name={otherPerson?.name || 'Usuário'} />
                                            <div className="overflow-hidden">
                                                <div className="text-xs text-slate-500 mb-0.5">{isOwner ? 'Compartilhado com:' : 'Compartilhado por:'}</div>
                                                <div className="font-medium text-white truncate">{otherPerson?.name || 'Desconhecido'}</div>
                                                <div className="text-xs text-slate-500 truncate">{otherPerson?.email}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                                            <Badge variant="default">{translateModule(del.module)}</Badge>
                                            <div className="flex gap-1">
                                                {del.permissions.view && <span title="Ver" className="text-emerald-400 bg-emerald-500/10 p-1 rounded"><CheckCircle size={12} /></span>}
                                                {del.permissions.create && <span title="Criar" className="text-blue-400 bg-blue-500/10 p-1 rounded"><Plus size={12} /></span>}
                                                {del.permissions.edit && <span title="Editar" className="text-amber-400 bg-amber-500/10 p-1 rounded"><Shield size={12} /></span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && isAdmin && (
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
                                                <div className="flex justify-end items-center gap-2">
                                                    <button
                                                        onClick={() => { setEditingPermissionsUser(user); }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                                                        title="Editar Permissões"
                                                    >
                                                        <Shield size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
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
                        {filteredUsers.length === 0 && <p className="text-center py-6 text-slate-500 italic">Nenhum usuário encontrado.</p>}
                    </div>
                </Card>
            )}

            {/* TAB: FINANCE */}
            {activeTab === 'finance' && isAdmin && (
                <Card className="p-6 max-w-2xl">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <CreditCardIcon size={20} className="text-emerald-500" />
                            Regra de Cartão de Crédito
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Defina como as despesas de cartão são reconhecidas no sistema.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-semibold text-white">Regime de Apuração</label>
                                <Badge variant="outline">{pendingMode === 'cash' ? 'Caixa' : 'Competência (Padrão)'}</Badge>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">
                                Esta configuração altera como os relatórios e a visão geral processam os gastos no cartão.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div
                                    className={`cursor-pointer p-4 rounded-lg border transition-all ${pendingMode !== 'cash' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600 opacity-60'}`}
                                    onClick={() => setPendingMode('competence')}
                                >
                                    <div className="flex items-center gap-2 font-medium text-emerald-400 mb-2">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${pendingMode !== 'cash' ? 'border-emerald-500' : 'border-slate-500'}`}>
                                            {pendingMode !== 'cash' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                        </div>
                                        Competência (Compra)
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        A despesa é contabilizada na <strong>data da compra</strong> via cartão. O pagamento da fatura é apenas baixa de passivo.
                                        <br /><span className="text-slate-500 italic">Ideal para DRE Contábil.</span>
                                    </p>
                                </div>

                                <div
                                    className={`cursor-pointer p-4 rounded-lg border transition-all ${pendingMode === 'cash' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600 opacity-60'}`}
                                    onClick={() => setPendingMode('cash')}
                                >
                                    <div className="flex items-center gap-2 font-medium text-emerald-400 mb-2">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${pendingMode === 'cash' ? 'border-emerald-500' : 'border-slate-500'}`}>
                                            {pendingMode === 'cash' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                        </div>
                                        Caixa (Pagamento da Fatura)
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        A despesa é contabilizada apenas no <strong>pagamento da fatura</strong>. As compras individuais ficam ocultas até o pagamento.
                                        <br /><span className="text-slate-500 italic">Ideal para Fluxo de Caixa Simples.</span>
                                    </p>
                                </div>
                            </div>

                            <hr className="border-slate-700/50 mb-4" />

                            <div className="flex justify-end">
                                <Button onClick={handleSaveFinanceSettings} className="px-6">
                                    Salvar Alterações
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* TAB: CALENDAR */}
            {activeTab === 'calendar' && (
                <CalendarSettingsTab
                    initialSettings={financeSettings?.calendar}
                    onSave={(newSettings) => setFinanceSettings({ ...financeSettings, calendar: newSettings })}
                />
            )}

            {/* TAB: AUDIT */}
            {activeTab === 'audit' && isAdmin && (
                <Card className="p-6">
                    <AuditLogsTab />
                </Card>
            )}


            <CreateUserModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={loadData}
            />

            <EditUserModal
                isOpen={!!editingPermissionsUser}
                onClose={() => setEditingPermissionsUser(null)}
                onSuccess={loadData}
                user={editingPermissionsUser}
            />

            <DelegationModal
                isOpen={isDelegationOpen}
                onClose={() => { setIsDelegationOpen(false); setEditingDelegation(null); }}
                onSuccess={loadData}
                users={usersAvailableToDelegate}
                initialData={editingDelegation}
            />
        </div>
    );
};
