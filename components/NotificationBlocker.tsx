import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './Shared';

export const NotificationBlocker: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        // Fetch unacknowledged notifications
        const fetchNotifications = async () => {
            try {
                const data = await api.getUnacknowledgedNotifications();
                setNotifications(data || []);
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            }
        };

        fetchNotifications();

        // Check periodically (every 15s) for new ones to ensure it catches even if websocket fails
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const handleAcknowledge = async (id: string, refId?: string, refType?: string, title?: string) => {
        setLoading(true);
        try {
            await api.acknowledgeNotification(id, refId, refType, title);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error("Failed to acknowledge:", error);
            alert("Erro ao confirmar notificação. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (notifications.length === 0) return null;

    // Grab the first one to display
    const currentNotification = notifications[0];

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-rose-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-rose-500/5">
                    <AlertCircle size={32} />
                </div>
                
                <h2 className="text-2xl font-bold text-foreground mb-2">Ação Obrigatória</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Você possui uma atribuição ou notificação crítica que exige sua ciência antes de continuar utilizando o sistema.
                </p>

                <div className="w-full bg-secondary/50 border border-border rounded-xl p-4 mb-6 text-left">
                    <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                        {currentNotification.reference_type === 'task' ? 'Nova Tarefa' : 
                         currentNotification.reference_type === 'event' ? 'Novo Evento' : 'Notificação'}
                    </div>
                    <div className="text-base font-medium text-foreground">
                        {currentNotification.title}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {currentNotification.message}
                    </div>
                </div>

                <Button 
                    variant="primary" 
                    className="w-full py-6 text-base gap-3"
                    disabled={loading}
                    onClick={() => handleAcknowledge(currentNotification.id, currentNotification.reference_id, currentNotification.reference_type, currentNotification.title)}
                >
                    <CheckCircle2 size={20} />
                    {loading ? 'Registrando...' : 'Estou Ciente e Aceito'}
                </Button>
                <div className="text-[10px] text-muted-foreground mt-4 italic opacity-70">
                    Ao confirmar, esta ação será registrada na auditoria e no histórico da tarefa.
                </div>
            </div>
        </div>
    );
};
