
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
import { SharedAccessPanel } from '../components/Permissions/SharedAccessPanel';
import { checkUserLimit, UserLimitStatus } from '../services/limits';

export const SettingsPage: React.FC = () => {
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
    const [activeTab, setActiveTab] = useState<'delegation' | 'users' | 'finance' | 'calendar' | 'audit'>('delegation');
    const [pendingMode, setPendingMode] = useState<'competence' | 'cash'>('competence');

    // Modals State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDelegationOpen, setIsDelegationOpen] = useState(false);
    const [editingDelegations, setEditingDelegations] = useState<Delegation[]>([]); // Changed to Array
    const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);

    useEffect(() => {
        if (authUser) loadData();
    }, [authUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, delegationsData, settingsData, limitsData] = await Promise.all([
                api.getUsers(authUser?.tenantId),
                api.getMyDelegations(),
                api.getTenantSettings(),
                authUser?.tenantId ? checkUserLimit(authUser.tenantId) : Promise.resolve(null)
            ]);
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
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2 bg-background text-foreground">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Configurações & Acesso</h1>
                    <p className="text-muted-foreground text-sm">Gerencie equipe, acessos e regras do sistema</p>
                </div>
            </div>

            {/* TABS HEADER ... (keeping same) */}
            <div className="flex items-center gap-6 border-b border-border pb-1">
                <button
                    onClick={() => setActiveTab('delegation')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'delegation' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                >
                    Acessos Compartilhados
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'users' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                    >
                        Usuários do Sistema
                    </button>
                )}
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'finance' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                    >
                        Financeiro
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'calendar' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                >
                    Calendário
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'audit' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                    >
                        Auditoria
                    </button>
                )}
            </div>

            {/* TAB: DELEGATION (SHARED ACCESS) */}
            {activeTab === 'delegation' && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {/* New SharedAccessPanel Component */}
                    <SharedAccessPanel />
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && isAdmin && (
                <Card className="p-6" variant="solid">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <ShieldCheck size={20} className="text-emerald-500" />
                                Diretório de Usuários
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">Visão geral de todos os usuários do sistema.</p>
                        </div>
                        {isAdmin && (
                            <div className="flex gap-4">
                                <div className="relative w-48 hidden sm:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
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
                </Card>
            )}

            {/* TAB: FINANCE */}
            {activeTab === 'finance' && isAdmin && (
                <Card className="p-6 max-w-2xl" variant="solid">
                    <div className="mb-6">
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
                onClose={() => { setIsDelegationOpen(false); setEditingDelegations([]); }}
                onSuccess={loadData}
                users={usersAvailableToDelegate}
                initialDelegations={editingDelegations}
            />
        </div>
    );
};
