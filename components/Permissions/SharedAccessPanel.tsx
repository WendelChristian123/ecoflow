import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge, Loader } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { Share2, Trash2, Calendar, Clock, Lock, Plus, UserPlus } from 'lucide-react';
import { api, getErrorMessage } from '../../services/api';
import { supabase } from '../../services/supabase'; // logic fix
import { AppFeature, User } from '../../types';
import { useAuth } from '../../context/AuthContext';

import { SharedAccess } from '../../types';

// Extended type for UI display
type SharedAccessWithDetails = SharedAccess & {
    user_email?: string;
    user_name?: string;
    owner_email?: string;
    owner_name?: string;
    feature_name?: string;
};

interface SharedAccessPanelProps {
    preloadedUsers?: User[];
}

export const SharedAccessPanel: React.FC<SharedAccessPanelProps> = ({ preloadedUsers }) => {
    const { user } = useAuth();
    const [accessList, setAccessList] = useState<SharedAccessWithDetails[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    // New Share State
    const [isSharing, setIsSharing] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedFeature, setSelectedFeature] = useState('');
    const [validity, setValidity] = useState('permanent'); // 24h, 7d, permanent

    // Catalogs (Only Tasks and Agenda as requested)
    const [features, setFeatures] = useState<AppFeature[]>([
        { id: 'routines.tasks', module_id: 'routines', name: 'Tarefas' },
        { id: 'routines.agenda', module_id: 'routines', name: 'Agenda' }
    ]);

    const fetchShares = async () => {
        setLoading(true);
        try {
            const data = await api.getSharedAccess();
            setAccessList(data);

            if (preloadedUsers && preloadedUsers.length > 0) {
                // Use provided users if available
                const others = preloadedUsers.filter(u => u.id !== user?.id);
                setUsersList(others);
            } else if (user) {
                console.log('Current tenant:', user.tenantId);
                const users = await api.getUsers(user.tenantId);
                console.log('Fetched users:', users);
                // Filter out self
                const others = users.filter(u => u.id !== user.id);
                setUsersList(others);
            }
        } catch (error: any) {
            console.error(error);
            // Only alert if we tried to fetch and failed (not if we just used preloadedUsers)
            if (!preloadedUsers) {
                alert(`Erro ao carregar usuários: ${error.message || JSON.stringify(error)}`);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchShares();
    }, [user, preloadedUsers]); // Re-run if preloadedUsers changes

    const handleManualDebug = async () => {
        try {
            console.log('--- MANUAL DEBUG START ---');
            console.log('User Context:', user);
            const rpcProfile = await supabase.rpc('get_my_profile');
            console.log('RPC get_my_profile:', rpcProfile);

            if (user?.tenantId) {
                const usersValues = await api.getUsers(user.tenantId);
                console.log('API getUsers:', usersValues);
                alert(`Debug concluído. RPC Tenant: ${rpcProfile.data?.tenant_id}. Users found: ${usersValues.length}`);
            } else {
                alert(`Debug concluído. RPC Tenant: ${rpcProfile.data?.tenant_id}. Context Tenant: UNDEFINED`);
            }
        } catch (e: any) {
            alert('Debug error: ' + e.message);
        }
    };

    const handleShare = async () => {
        if (!selectedFeature || !selectedUserId) return;

        setLoading(true);
        try {
            // "all" = share all available features
            if (selectedFeature === 'all') {
                for (const feature of features) {
                    await api.grantSharedAccess({
                        targetUserId: selectedUserId,
                        featureId: feature.id,
                        currentUserId: user?.id,
                        duration: validity,
                        permissions: { view: true, create: true, edit: true, delete: true }
                    });
                }
            } else {
                await api.grantSharedAccess({
                    targetUserId: selectedUserId,
                    featureId: selectedFeature,
                    currentUserId: user?.id,
                    duration: validity,
                    permissions: { view: true, create: true, edit: true, delete: true }
                });
            }

            await fetchShares();
            setSelectedUserId('');
            setSelectedFeature('');
            setValidity('permanent');
            alert('Acesso concedido com sucesso!');
        } catch (error: any) {
            console.error(error);
            alert('Erro ao conceder acesso.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Tem certeza que deseja revogar este acesso?')) return;
        try {
            await api.revokeSharedAccess(id);
            alert('Acesso revogado com sucesso!');
            fetchShares();
        } catch (error: any) {
            alert('Erro ao revogar: ' + getErrorMessage(error));
        }
    };

    // Grouping Logic
    const myShares = accessList.filter(a => a.owner_id === user?.id);
    const sharedWithMe = accessList.filter(a => a.target_id === user?.id);

    interface GroupedShare {
        user: { name?: string; email?: string; id: string };
        items: SharedAccessWithDetails[];
    }

    interface GroupedReceivedShare {
        owner: { name?: string; email?: string; id: string };
        items: SharedAccessWithDetails[];
    }

    const groupedMyShares: GroupedShare[] = Object.values(myShares.reduce((acc, curr) => {
        const key = curr.target_id;
        if (!acc[key]) {
            acc[key] = {
                user: { name: curr.user_name || curr.user_email, email: curr.user_email, id: curr.target_id },
                items: []
            };
        }
        acc[key].items.push(curr);
        return acc;
    }, {} as Record<string, GroupedShare>));

    const groupedSharedWithMe: GroupedReceivedShare[] = Object.values(sharedWithMe.reduce((acc, curr) => {
        const key = curr.owner_id;
        if (!acc[key]) {
            acc[key] = {
                owner: { name: curr.owner_name || curr.owner_email, email: curr.owner_email, id: curr.owner_id },
                items: []
            };
        }
        acc[key].items.push(curr);
        return acc;
    }, {} as Record<string, GroupedReceivedShare>));

    return (
        <div className="space-y-8">
            <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <Share2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Acessos Compartilhados</h2>
                            <p className="text-sm text-muted-foreground">Gerencie quem tem acesso aos seus recursos.</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsSharing(!isSharing)} className="gap-2">
                        {isSharing ? 'Cancelar' : <><UserPlus size={16} /> Novo Compartilhamento</>}
                    </Button>
                </div>

                {isSharing && (
                    <div className="bg-muted/30 p-4 rounded-xl border border-border animate-in fade-in slide-in-from-top-4 space-y-4">
                        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Conceder Acesso</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-end gap-2">
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">
                                        Usuário ({usersList.length}) - T: {user?.tenantId ? user.tenantId.substring(0, 4) : 'N/A'}
                                    </label>
                                    <FilterSelect
                                        value={selectedUserId}
                                        onChange={(val) => setSelectedUserId(val)}
                                        options={usersList.map(u => ({ value: u.id, label: u.name || u.email }))}
                                        placeholder="Selecione um usuário..."
                                        searchable
                                        className="w-full"
                                    />
                                </div>
                                <button onClick={fetchShares} className="h-10 px-3 bg-secondary rounded border border-input hover:bg-secondary/80" title="Recarregar Lista">
                                    ↻
                                </button>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase">Recurso</label>
                                <FilterSelect
                                    value={selectedFeature}
                                    onChange={(val) => setSelectedFeature(val)}
                                    options={[
                                        { value: 'all', label: '✨ Todos os Recursos' },
                                        ...features.map(f => ({ value: f.id, label: f.name }))
                                    ]}
                                    placeholder="Selecione..."
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase">Validade</label>
                                <FilterSelect
                                    value={validity}
                                    onChange={(val) => setValidity(val)}
                                    options={[
                                        { value: '24h', label: '24 Horas' },
                                        { value: '7d', label: '7 Dias' },
                                        { value: '30d', label: '30 Dias' },
                                        { value: 'permanent', label: 'Permanente' }
                                    ]}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleShare} className="bg-emerald-500 text-white hover:bg-emerald-600">
                                Confirmar Compartilhamento
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-4">Acessos que você concedeu</h3>
                    {groupedMyShares.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted">
                            <Lock className="mx-auto h-8 w-8 mb-2 opacity-50" />
                            <p>Você ainda não compartilhou acessos com ninguém.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {groupedMyShares.map(group => (
                                <div key={group.user.id} className="p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                                                {group.user.email?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-base">{group.user.name || group.user.email}</p>
                                                <p className="text-xs text-muted-foreground mb-3">{group.user.email}</p>

                                                <div className="flex flex-wrap gap-2">
                                                    {group.items.map(access => (
                                                        <div key={access.id} className="group relative flex items-center gap-2 bg-muted/40 px-2 py-1 rounded-md border border-border/50 text-xs">
                                                            <Badge variant="secondary" className="text-[10px] font-normal bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{access.feature_name || access.feature_id}</Badge>
                                                            {access.expires_at && (
                                                                <span className="flex items-center gap-1 text-emerald-500/70" title={`Expira em: ${new Date(access.expires_at).toLocaleDateString()}`}>
                                                                    <Clock size={10} />
                                                                </span>
                                                            )}
                                                            <button
                                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                                onClick={() => handleRevoke(access.id)}
                                                                title="Revogar acesso"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {groupedSharedWithMe.length > 0 && (
                <Card className="p-6 space-y-6 border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-600">
                            <UserPlus size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Acessos Recebidos</h2>
                            <p className="text-sm text-muted-foreground">Recursos que outras pessoas compartilharam com você.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {groupedSharedWithMe.map(group => (
                            <div key={group.owner.id} className="p-4 bg-card border border-border rounded-lg hover:bg-accent/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                                        {group.owner.email?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Compartilhado por</p>
                                        <p className="font-semibold">{group.owner.name || group.owner.email}</p>
                                        <p className="text-xs text-muted-foreground mb-3">{group.owner.email}</p>

                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {group.items.map(access => (
                                                <Badge key={access.id} variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                    {access.feature_name || access.feature_id}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};
