import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useRBAC } from '../context/RBACContext';
import { Card, Button, Badge } from './Shared';
import { Bell, ShieldCheck } from 'lucide-react';

export const NotificationSettingsTab: React.FC<{ companySettings: any, onSaveCompanySettings: (s: any) => void }> = ({ companySettings, onSaveCompanySettings }) => {
    const { isAdmin, can } = useRBAC();
    const [preferences, setPreferences] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Admin config state
    const [requireRoutinesAck, setRequireRoutinesAck] = useState(companySettings?.require_routines_acknowledgment || false);

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const data = await api.getUserNotificationPreferences();
            setPreferences(data || []);
        } catch (error) {
            console.error("Failed to load preferences", error);
        }
    };

    const handlePrefChange = async (moduleId: string, eventType: string, minutes: number) => {
        try {
            await api.updateUserNotificationPreference({
                module_id: moduleId,
                event_type: eventType,
                notify_before_minutes: minutes
            });
            await loadPreferences();
        } catch (error) {
            console.error("Failed to save preference", error);
            alert("Erro ao salvar preferência.");
        }
    };

    const handleSaveAdminSettings = async () => {
        setLoading(true);
        try {
            await onSaveCompanySettings({
                ...companySettings,
                require_routines_acknowledgment: requireRoutinesAck
            });
            alert("Configurações gerais salvas com sucesso!");
        } catch (error) {
            alert("Erro ao salvar configurações gerais.");
        } finally {
            setLoading(false);
        }
    };

    const getPrefValue = (moduleId: string, eventType: string) => {
        const p = preferences.find(x => x.module_id === moduleId && x.event_type === eventType);
        return p ? p.notify_before_minutes : 0; // Default 0 (No momento exato)
    };

    const renderSelect = (moduleId: string, eventType: string, label: string) => (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-border/50 last:border-0 gap-2">
            <span className="text-sm text-foreground">{label}</span>
            <select 
                className="bg-secondary/50 border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary/50 outline-none w-full sm:w-48"
                value={getPrefValue(moduleId, eventType)}
                onChange={(e) => handlePrefChange(moduleId, eventType, parseInt(e.target.value))}
            >
                <option value={-1}>Não me avise</option>
                <option value={0}>No momento exato</option>
                <option value={5}>5 minutos antes</option>
                <option value={15}>15 minutos antes</option>
                <option value={60}>1 hora antes</option>
                <option value={1440}>1 dia antes</option>
            </select>
        </div>
    );

    return (
        <div className="space-y-6 max-w-3xl">
            {/* ADMIN SECTION */}
            {isAdmin && (
                <Card className="p-5 border-rose-500/30" variant="solid">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-foreground">Modo Operante (Administrador)</h2>
                            <p className="text-xs text-muted-foreground">Regras globais de notificação para todos os funcionários.</p>
                        </div>
                    </div>

                    <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="mt-1 accent-rose-500 w-4 h-4 cursor-pointer"
                                checked={requireRoutinesAck}
                                onChange={(e) => setRequireRoutinesAck(e.target.checked)}
                            />
                            <div>
                                <span className="text-sm font-semibold text-foreground block">Exigir Aceite em Novas Atribuições (Tarefas e Agenda)</span>
                                <span className="text-xs text-muted-foreground mt-1 block">
                                    Se ativado, quando um funcionário receber uma tarefa ou convite, a tela dele ficará **bloqueada** até que ele clique em "Estou Ciente". Isso gera histórico à prova de fraudes de que ele visualizou a atribuição.
                                </span>
                            </div>
                        </label>

                        <div className="mt-4 flex justify-end">
                            <Button variant="primary" onClick={handleSaveAdminSettings} disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white">
                                {loading ? 'Salvando...' : 'Salvar Regra Global'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* USER PREFERENCES */}
            <Card className="p-5" variant="solid">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-foreground">Minhas Preferências de Aviso</h2>
                        <p className="text-xs text-muted-foreground">Configure com que antecedência você quer ser lembrado dos seus compromissos.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* ROTINAS */}
                    {can('routines', 'view') && (
                        <div className="border border-border rounded-xl overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-semibold text-sm text-foreground flex items-center gap-2">
                                <Badge variant="neutral">Rotinas & Execução</Badge>
                            </div>
                            <div className="p-4 bg-card">
                                {renderSelect('routines', 'task_deadline', 'Vencimento de Tarefa')}
                                {renderSelect('routines', 'event_start', 'Início de Compromisso na Agenda')}
                                <div className="mt-3 text-[10px] text-muted-foreground italic">
                                    Nota: Atribuições de novas tarefas notificam instantaneamente.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FINANCEIRO */}
                    {can('finance', 'view') && (
                        <div className="border border-border rounded-xl overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-semibold text-sm text-foreground flex items-center gap-2">
                                <Badge variant="neutral">Financeiro</Badge>
                            </div>
                            <div className="p-4 bg-card">
                                {renderSelect('finance', 'payable_due', 'Vencimento de Conta a Pagar')}
                                {renderSelect('finance', 'receivable_due', 'Vencimento de Conta a Receber')}
                            </div>
                        </div>
                    )}

                    {/* COMERCIAL */}
                    {can('commercial', 'view') && (
                        <div className="border border-border rounded-xl overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-semibold text-sm text-foreground flex items-center gap-2">
                                <Badge variant="neutral">Comercial</Badge>
                            </div>
                            <div className="p-4 bg-card">
                                {renderSelect('commercial', 'quote_expiration', 'Vencimento de Orçamento')}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
