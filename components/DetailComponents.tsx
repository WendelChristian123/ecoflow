import React, { useState } from 'react';
import { User, LogEntry } from '../types';
import { Modal, Avatar, Button, Input, Textarea, cn } from './Shared';
import { User as UserIcon, MessageSquare, Link as LinkIcon, ArrowRight, History, Clock, FileEdit, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Types ---
interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (userId: string, comment?: string, link?: string) => Promise<void>;
    users: User[];
    currentAssigneeId?: string;
    title?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, onConfirm, users, currentAssigneeId, title = "Próximo Responsável" }) => {
    const [selectedUserId, setSelectedUserId] = useState('');
    const [comment, setComment] = useState('');
    const [link, setLink] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) return alert("Selecione um responsável.");

        setLoading(true);
        try {
            await onConfirm(selectedUserId, comment, link);
            onClose();
            // Reset form
            setSelectedUserId('');
            setComment('');
            setLink('');
        } catch (error) {
            console.error(error);
            alert("Erro ao transferir responsável.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Selecionar Responsável</label>
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {users.map(u => (
                            <div
                                key={u.id}
                                onClick={() => setSelectedUserId(u.id)}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all",
                                    selectedUserId === u.id
                                        ? "bg-primary/10 border-primary shadow-sm"
                                        : "bg-card border-border hover:bg-secondary/50"
                                )}
                            >
                                <Avatar src={u.avatarUrl} name={u.name} size="sm" />
                                <div className="flex-1">
                                    <span className={cn("block text-sm font-medium", selectedUserId === u.id ? "text-primary" : "text-foreground")}>{u.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{u.role}</span>
                                </div>
                                {selectedUserId === u.id && <CheckCircle2 size={16} className="text-primary" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                            <MessageSquare size={12} /> Comentário (Opcional)
                        </label>
                        <Textarea
                            placeholder="Adicione um contexto sobre a transferência..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="text-sm min-h-[80px]"
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                            <LinkIcon size={12} /> Link de Referência (Opcional)
                        </label>
                        <Input
                            placeholder="https://"
                            value={link}
                            onChange={e => setLink(e.target.value)}
                            className="text-sm"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading || !selectedUserId} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                        <ArrowRight size={16} className="mr-2" /> Transferir
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// --- History Timeline ---

interface HistoryTimelineProps {
    logs: LogEntry[];
    users: User[];
}

const getActionIcon = (action: string) => {
    switch (action) {
        case 'create': return <Clock size={14} className="text-blue-400" />;
        case 'transfer': return <ArrowRight size={14} className="text-emerald-400" />;
        case 'status_change': return <CheckCircle2 size={14} className="text-amber-400" />;
        case 'update': return <FileEdit size={14} className="text-slate-400" />;
        case 'completion': return <CheckCircle2 size={14} className="text-green-500" />;
        default: return <Clock size={14} className="text-slate-400" />;
    }
};

const getActionLabel = (action: string) => {
    switch (action) {
        case 'create': return "Criou este item";
        case 'transfer': return "Transferiu a responsabilidade";
        case 'status_change': return "Alterou o status";
        case 'update': return "Atualizou detalhes";
        case 'completion': return "Concluiu o item";
        default: return "Realizou uma ação";
    }
};

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ logs, users }) => {
    // Sort logs by date (newest first)
    const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (sortedLogs.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground text-xs italic">
                Nenhum histórico registrado.
            </div>
        );
    }

    return (
        <div className="relative space-y-6 pl-2 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-border/50">
            {sortedLogs.map((log) => {
                const user = users.find(u => u.id === log.userId);
                return (
                    <div key={log.id} className="relative flex gap-4 group">
                        {/* Timeline Dot */}
                        <div className="z-10 h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 shadow-sm group-hover:border-primary/50 transition-colors">
                            {getActionIcon(log.action)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-secondary/20 p-3 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors">
                            <div className="flex justify-between items-start gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground">{user?.name || 'Usuário Desconhecido'}</span>
                                    <span className="text-[10px] text-muted-foreground/80">• {getActionLabel(log.action)}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap" title={format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}>
                                    {format(new Date(log.timestamp), "dd MMM, HH:mm", { locale: ptBR })}
                                </span>
                            </div>

                            {log.details && (
                                <p className="text-xs text-muted-foreground mb-1.5">{log.details}</p>
                            )}

                            {log.comment && (
                                <div className="flex gap-2 bg-card p-2 rounded border border-border/50 mt-1">
                                    <MessageSquare size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground italic">"{log.comment}"</p>
                                </div>
                            )}

                            {log.link && (
                                <a
                                    href={log.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 text-xs text-emerald-500 hover:underline mt-1.5 w-fit"
                                >
                                    <LinkIcon size={12} /> Link Anexado
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
