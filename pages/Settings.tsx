
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Delegation, Task } from '../types';
import { Loader, Button, Avatar, Badge, Card, Input, Modal } from '../components/Shared';
import { FilterSelect } from '../components/FilterSelect';
import { useRBAC } from '../context/RBACContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Shield, ShieldCheck, Trash2, UserPlus, Users as UsersIcon, XCircle, CheckCircle, CreditCard as CreditCardIcon, Pencil, Calendar, FileText, Share2, Bell } from 'lucide-react';
import { CreateUserModal, EditUserModal, DelegationModal } from '../components/UserModals';
import { CalendarSettingsTab } from '../components/CalendarSettingsTab';
import { AuditLogsTab } from '../components/AuditLogsTab';
import { SharedAccessPanel } from '../components/Permissions/SharedAccessPanel';
import { NotificationSettingsTab } from '../components/NotificationSettingsTab';
import { MyPlanTab } from '../components/MyPlanTab';
import { checkUserLimit, UserLimitStatus } from '../services/limits';
import { useAppEnvironment } from '../context/AppEnvironmentContext';

export const SettingsPage: React.FC = () => {
    const { isApp } = useAppEnvironment();
    const { user: authUser } = useAuth();
    const { isAdmin, canDelete } = useRBAC();

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [financeSettings, setFinanceSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [userLimits, setUserLimits] = useState<UserLimitStatus | null>(null);

    // UI State
    const [activeTab, setActiveTab] = useState<'delegation' | 'users' | 'finance' | 'calendar' | 'notifications' | 'audit' | 'plan'>('delegation');
    const [pendingMode, setPendingMode] = useState<'competence' | 'cash'>('competence');

    // Modals State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDelegationOpen, setIsDelegationOpen] = useState(false);
    const [editingDelegations, setEditingDelegations] = useState<Delegation[]>([]); // Changed to Array
    const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);

    // Deletion / Transfer State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [tasksToTransfer, setTasksToTransfer] = useState<Task[]>([]);
    const [transferTargetId, setTransferTargetId] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (authUser) loadData();
    }, [authUser]);

    // ... (imports remain mostly the same, ensuring api has correct methods)

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, delegationsData, settingsData, limitsData] = await Promise.all([
                api.getUsers(authUser?.companyId),
                api.getMyDelegations(),
                api.getCompanySettings(),
                authUser?.companyId ? checkUserLimit(authUser.companyId) : Promise.resolve(null)
            ]);
            // ... (rest of the function)
            setUsers(usersData);
            setDelegations(delegationsData);
            setFinanceSettings(settingsData || {});
            setPendingMode(settingsData?.credit_card_expense_mode || 'competence');
            if (limitsData) setUserLimits(limitsData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFinanceSettings = async () => {
        try {
            const newSettings = { ...financeSettings, credit_card_expense_mode: pendingMode };
            await api.updateCompanySettings(newSettings);
            setFinanceSettings(newSettings);
            alert('Configuração salva com sucesso! O impacto nos relatórios será imediato.');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configuração.');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!canDelete()) return;
        const userObj = users.find(u => u.id === id);
        if (!userObj) return;

        try {
            // Check for pending tasks
            const allTasks = await api.getTasks(authUser?.companyId);
            const pendingTasks = allTasks.filter(t => t.assigneeId === id && t.status !== 'done');

            if (pendingTasks.length > 0) {
                setUserToDelete(userObj);
                setTasksToTransfer(pendingTasks);
                setTransferTargetId('');
                setIsTransferModalOpen(true);
            } else {
                if (window.confirm(`Tem certeza que deseja excluir o usuário ${userObj.name}?`)) {
                    await api.deleteUser(id);
                    loadData();
                }
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao verificar tarefas pendentes.");
        }
    };

    const confirmTransferAndDelete = async () => {
        if (!userToDelete || !transferTargetId) return;
        setIsDeleting(true);
        try {
            const targetUser = users.find(u => u.id === transferTargetId);
            
            // 1. Transfer all pending tasks
            for (const task of tasksToTransfer) {
                await api.updateTask({ ...task, assigneeId: transferTargetId });
                // Add activity log
                await api.addActivityLog({
                    entityId: task.id,
                    entityType: 'task',
                    action: 'transfer',
                    details: `Transferiu para ${targetUser?.name} devido à exclusão da conta de ${userToDelete.name}`,
                    metadata: {
                        from: userToDelete.id,
                        to: transferTargetId,
                        reason: 'user_deletion'
                    }
                });
            }

            // 2. Delete user
            await api.deleteUser(userToDelete.id);
            setIsTransferModalOpen(false);
            loadData();
            alert(`Usuário excluído e ${tasksToTransfer.length} tarefas transferidas com sucesso.`);
        } catch (e) {
            console.error(e);
            alert("Erro ao transferir tarefas e excluir usuário.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteAccess = async (delegations: Delegation[]) => {
        if (window.confirm(`Revogar TODO o acesso para este usuário? (${delegations.length} permissões)`)) {
            try {
                await Promise.all(delegations.map(d => api.deleteDelegation(d.id)));
                loadData();
            } catch (e) {
                console.error(e);
                alert('Erro ao revogar acesso.');
            }
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

    // Group Delegations Logic
    const groupedDelegations = delegations.reduce((acc, del) => {
        const isOwner = del.ownerId === authUser?.id;
        // Identify the "Other Person"
        const otherId = isOwner ? del.delegateId : del.ownerId;

        if (!acc[otherId]) {
            acc[otherId] = {
                user: isOwner ? del.delegate : del.owner,
                delegations: [],
                isOwner // If current user is owner of these delegations (granted BY me)
            };
        }
        acc[otherId].delegations.push(del);
        return acc;
    }, {} as Record<string, { user: User, delegations: Delegation[], isOwner: boolean }>);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-8 pr-2 bg-background text-foreground">
            {/* Header Area */}
            <div className="flex flex-col gap-2">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Configurações & Acesso</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie equipe, acessos e regras do sistema.</p>
                </div>
            </div>
            {isApp ? (
                <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                    <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">Acessos</h2>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <button
                            onClick={() => setActiveTab('delegation')}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'delegation' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                        >
                            <Share2 size={20} />
                            <span className="text-[10px] font-bold text-center leading-tight">Compartilhar</span>
                        </button>
                        
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'users' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                            >
                                <UsersIcon size={20} />
                                <span className="text-[10px] font-bold text-center leading-tight">Usuários</span>
                            </button>
                        )}
                        
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('finance')}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'finance' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                            >
                                <CreditCardIcon size={20} />
                                <span className="text-[10px] font-bold text-center leading-tight">Financeiro</span>
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'calendar' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                        >
                            <Calendar size={20} />
                            <span className="text-[10px] font-bold text-center leading-tight">Calendário</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'notifications' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                        >
                            <Bell size={20} />
                            <span className="text-[10px] font-bold text-center leading-tight">Notificações</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('audit')}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'audit' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                            >
                                <ShieldCheck size={20} />
                                <span className="text-[10px] font-bold text-center leading-tight">Auditoria</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('plan')}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${activeTab === 'plan' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary/50'}`}
                            >
                                <FileText size={20} />
                                <span className="text-[10px] font-bold text-center leading-tight">Meu Plano</span>
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-6 border-b border-border mb-6 overflow-x-auto custom-scrollbar no-scrollbar">
                    <button
                        onClick={() => setActiveTab('delegation')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'delegation' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                    >
                        Acessos Compartilhados
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                        >
                            Usuários do Sistema
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('finance')}
                            className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'finance' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                        >
                            Financeiro
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'calendar' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                    >
                        Calendário
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'notifications' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                    >
                        Notificações
                    </button>

                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'audit' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                        >
                            Auditoria
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('plan')}
                            className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'plan' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                        >
                            Meu Plano
                        </button>
                    )}
                </div>
            )}

            {/* TAB: DELEGATION (SHARED ACCESS) */}
            {activeTab === 'delegation' && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {/* New SharedAccessPanel Component with Preloaded Users */}
                    <SharedAccessPanel preloadedUsers={users} />
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && isAdmin && (
                <Card className="p-4" variant="solid">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <ShieldCheck size={20} className="text-emerald-500" />
                                Diretório de Usuários
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">Visão geral de todos os usuários do sistema.</p>
                        </div>
                        {isAdmin && (
                            <div className="flex gap-4 w-full sm:w-auto">
                                <div className="relative w-full sm:w-48">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <Input
                                        placeholder="Buscar..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="pl-9 py-1.5 text-sm w-full"
                                    />
                                </div>
                                <Button className="gap-2 shrink-0" onClick={() => setIsCreateOpen(true)}>
                                    <Plus size={18} /> <span className={isApp ? 'hidden' : ''}>Criar Usuário</span><span className={!isApp ? 'hidden' : ''}>Novo</span>
                                </Button>
                            </div>
                        )}
                    </div>

                    {userLimits && (
                        <div className="mb-6 bg-secondary/10 p-4 rounded-lg border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="w-full sm:w-1/2">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Uso de Usuários do Plano</span>
                                    <span className={!userLimits.allowed ? 'text-rose-500 font-bold' : ''}>
                                        {userLimits.used} / {userLimits.max} utilizados
                                    </span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${!userLimits.allowed ? 'bg-rose-500' : 'bg-primary'}`}
                                        style={{ width: `${Math.min((userLimits.used / userLimits.max) * 100, 100)}%` }}
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Base: {userLimits.planLimit} | Extras: {userLimits.addonLimit}
                                </div>
                            </div>
                            {!userLimits.allowed && (
                                <Button size="sm" variant="primary" onClick={() => alert('Funcionalidade de Upgrade em breve!')}>
                                    Fazer Upgrade
                                </Button>
                            )}
                        </div>
                    )}

                    {!isApp ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-muted-foreground">
                                <thead className="bg-secondary/50 text-foreground uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Usuário</th>
                                        <th className="px-4 py-3">Contato</th>
                                        <th className="px-4 py-3">Função</th>
                                        <th className="px-4 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar src={user.avatarUrl} name={user.name} />
                                                    <div>
                                                        <div className="font-medium text-foreground">{user.name}</div>
                                                        <div className="text-xs text-muted-foreground">ID: {user.id.substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{user.email}</div>
                                                <div className="text-xs text-muted-foreground">{user.phone}</div>
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
                                                            className="p-1.5 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                                                            title="Editar Permissões"
                                                        >
                                                            <Shield size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                                            title="Excluir Usuário"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                                {(!isAdmin || user.role === 'admin') && (
                                                    <span className="text-xs text-muted-foreground italic">Sem ações</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredUsers.length === 0 && <p className="text-center py-6 text-muted-foreground italic">Nenhum usuário encontrado.</p>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredUsers.map(user => (
                                <div key={user.id} className="p-4 bg-card border border-border rounded-xl shadow-sm flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar src={user.avatarUrl} name={user.name} />
                                            <div>
                                                <div className="font-bold text-foreground text-sm">{user.name}</div>
                                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                            </div>
                                        </div>
                                        <Badge variant={user.role === 'admin' ? 'success' : 'neutral'} className="text-[10px]">
                                            {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                                        <div className="text-[10px] text-muted-foreground font-mono bg-secondary/50 px-2 py-1 rounded">ID: {user.id.substring(0,8)}</div>
                                        {isAdmin && user.role !== 'admin' && (
                                            <div className="flex justify-end items-center gap-3">
                                                <button
                                                    onClick={() => setEditingPermissionsUser(user)}
                                                    className="p-2 text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                                >
                                                    <Shield size={14} /> Permissões
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-2 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                                >
                                                    <Trash2 size={14} /> Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && <p className="text-center py-6 text-muted-foreground italic text-sm">Nenhum usuário encontrado.</p>}
                        </div>
                    )}
                </Card>
            )}

            {/* TAB: FINANCE */}
            {activeTab === 'finance' && isAdmin && (
                <Card className="p-4 max-w-2xl" variant="solid">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <CreditCardIcon size={20} className="text-emerald-500" />
                            Regra de Cartão de Crédito
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Defina como as despesas de cartão são reconhecidas no sistema.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 bg-secondary/20 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-semibold text-foreground">Regime de Apuração</label>
                                <Badge variant="outline">{pendingMode === 'cash' ? 'Caixa' : 'Competência (Padrão)'}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Esta configuração altera como os relatórios e a visão geral processam os gastos no cartão.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div
                                    className={`cursor-pointer p-4 rounded-lg border transition-all ${pendingMode !== 'cash' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500' : 'bg-card border-border hover:border-primary/50 opacity-60'}`}
                                    onClick={() => setPendingMode('competence')}
                                >
                                    <div className="flex items-center gap-2 font-medium text-emerald-500 mb-2">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${pendingMode !== 'cash' ? 'border-emerald-500' : 'border-muted-foreground'}`}>
                                            {pendingMode !== 'cash' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                        </div>
                                        Competência (Compra)
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        A despesa é contabilizada na <strong>data da compra</strong> via cartão. O pagamento da fatura é apenas baixa de passivo.
                                        <br /><span className="text-muted-foreground italic">Ideal para DRE Contábil.</span>
                                    </p>
                                </div>

                                <div
                                    className={`cursor-pointer p-4 rounded-lg border transition-all ${pendingMode === 'cash' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500' : 'bg-card border-border hover:border-primary/50 opacity-60'}`}
                                    onClick={() => setPendingMode('cash')}
                                >
                                    <div className="flex items-center gap-2 font-medium text-emerald-500 mb-2">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${pendingMode === 'cash' ? 'border-emerald-500' : 'border-muted-foreground'}`}>
                                            {pendingMode === 'cash' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                        </div>
                                        Caixa (Pagamento da Fatura)
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        A despesa é contabilizada apenas no <strong>pagamento da fatura</strong>. As compras individuais ficam ocultas até o pagamento.
                                        <br /><span className="text-muted-foreground italic">Ideal para Fluxo de Caixa Simples.</span>
                                    </p>
                                </div>
                            </div>

                            <hr className="border-border mb-4" />

                            <div className="flex justify-end">
                                <Button onClick={handleSaveFinanceSettings} className="px-6 w-full sm:w-auto">
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

            {/* TAB: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
                <NotificationSettingsTab 
                    companySettings={financeSettings}
                    onSaveCompanySettings={async (newSettings) => {
                        await api.updateCompanySettings(newSettings);
                        setFinanceSettings(newSettings);
                    }}
                />
            )}

            {/* TAB: AUDIT */}
            {activeTab === 'audit' && isAdmin && (
                <Card className="p-6">
                    <AuditLogsTab />
                </Card>
            )}

            {/* TAB: MEU PLANO */}
            {activeTab === 'plan' && isAdmin && (
                <MyPlanTab />
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
                user={editingPermissionsUser || undefined}
            />

            <Modal isOpen={isTransferModalOpen} onClose={() => !isDeleting && setIsTransferModalOpen(false)} title="Transferência de Tarefas">
                <div className="space-y-4">
                    <div className="bg-warning/10 text-warning p-4 rounded-lg text-sm border border-warning/20">
                        O usuário <strong>{userToDelete?.name}</strong> possui <strong>{tasksToTransfer.length}</strong> tarefa(s) pendente(s). 
                        Para prosseguir com a exclusão, você deve transferir essas tarefas para outro responsável.
                    </div>
                    
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Transferir tarefas para:</label>
                        <FilterSelect
                            label=""
                            value={transferTargetId}
                            onChange={setTransferTargetId}
                            options={users
                                .filter(u => u.id !== userToDelete?.id)
                                .map(u => ({ value: u.id, label: u.name, avatarUrl: u.avatarUrl }))}
                            className="w-full"
                            placeholder="Selecione um usuário"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="ghost" onClick={() => setIsTransferModalOpen(false)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button 
                            variant="primary" 
                            className="bg-rose-600 hover:bg-rose-700 text-white" 
                            disabled={!transferTargetId || isDeleting}
                            onClick={confirmTransferAndDelete}
                        >
                            {isDeleting ? 'Transferindo e Excluindo...' : 'Transferir e Excluir Usuário'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <DelegationModal
                isOpen={isDelegationOpen}
                onClose={() => { setIsDelegationOpen(false); setEditingDelegations([]); }}
                onSuccess={loadData}
                users={usersAvailableToDelegate}
                initialDelegations={editingDelegations}
            />
        </div>
    );
};
