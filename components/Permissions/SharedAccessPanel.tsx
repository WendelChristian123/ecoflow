import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge, Loader } from '../Shared';
import { Share2, Trash2, Calendar, Clock, Lock, Plus, UserPlus } from 'lucide-react';
import { api, getErrorMessage } from '../../services/api';
import { AppFeature } from '../../types';
import { useRBAC } from '../../context/RBACContext';

// We need a type for SharedAccess record if not exported yet
interface SharedAccess {
    id: string;
    owner_id: string;
    user_id: string;
    feature_id: string;
    actions: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    valid_until?: string;
    user_email?: string; // Joined
    feature_name?: string; // Joined or Computed
}

export const SharedAccessPanel: React.FC = () => {
    const { user } = useRBAC();
    const [accessList, setAccessList] = useState<SharedAccess[]>([]);
    const [loading, setLoading] = useState(false);

    // New Share State
    const [isSharing, setIsSharing] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedFeature, setSelectedFeature] = useState('');
    const [selectedDuration, setSelectedDuration] = useState('forever'); // 24h, 7d, forever

    // Catalogs (Should come from Context or API)
    const [features, setFeatures] = useState<AppFeature[]>([
        { id: 'routines.tasks', module_id: 'routines', name: 'Tarefas' },
        { id: 'routines.agenda', module_id: 'routines', name: 'Agenda' },
        { id: 'finance.payables', module_id: 'finance', name: 'Contas a Pagar' },
        { id: 'finance.receivables', module_id: 'finance', name: 'Contas a Receber' },
        { id: 'commercial.deals', module_id: 'commercial', name: 'Oportunidades (Deals)' }
    ]);

    const fetchShares = async () => {
        setLoading(true);
        try {
            // Mocking API call until api.ts is updated
            // const data = await api.getSharedAccess(); 
            // setAccessList(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShares();
    }, []);

    const handleShare = async () => {
        if (!selectedFeature || !inviteEmail) return;

        try {
            await api.grantSharedAccess({
                email: inviteEmail,
                featureId: selectedFeature,
                currentUserId: user?.id,
                duration: selectedDuration
            });
            alert('Acesso compartilhado com sucesso!');
            setIsSharing(false);
            fetchShares();
        } catch (error: any) {
            alert('Erro ao compartilhar: ' + getErrorMessage(error));
        }
    };

    return (
        <Card className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <Share2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Acessos Compartilhados</h2>
                        <p className="text-sm text-muted-foreground">Delegue acesso a recursos específicos para outros usuários.</p>
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
                        <Input
                            label="Email do Usuário"
                            placeholder="ex: colega@empresa.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Recurso</label>
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={selectedFeature}
                                onChange={e => setSelectedFeature(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {features.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({f.module_id})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Validade</label>
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={selectedDuration}
                                onChange={e => setSelectedDuration(e.target.value)}
                            >
                                <option value="24h">24 Horas</option>
                                <option value="7d">7 Dias</option>
                                <option value="30d">30 Dias</option>
                                <option value="forever">Permanente</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleShare} className="bg-success text-white hover:bg-success/90">
                            Confirmar Compartilhamento
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {accessList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Lock className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>Você ainda não compartilhou acessos com ninguém.</p>
                    </div>
                ) : (
                    accessList.map(access => (
                        <div key={access.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-accent/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    {access.user_email?.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold">{access.user_email}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="outline" className="text-[10px]">{access.feature_name || access.feature_id}</Badge>
                                        {access.expires_at && (
                                            <span className="flex items-center gap-1 text-amber-600">
                                                <Clock size={12} /> Expira em: {new Date(access.expires_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" className="text-destructive hover:bg-destructive/10" title="Revogar">
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};
