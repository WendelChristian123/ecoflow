import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Calendar, Clock, DollarSign, Briefcase, Filter } from 'lucide-react';
import { useNotifications, NotificationItem, NotificationType } from '../hooks/useNotifications';
import { usePaymentConfirmation } from './PaymentConfirmation';
import { cn } from './Shared';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export const NotificationPopover: React.FC = () => {
    const { notifications, isLoading, completeItem, refetch, removeNotification } = useNotifications();
    const { confirmPayment, ConfirmationModalComponent } = usePaymentConfirmation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | NotificationType>('all');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Also close if user presses Escape
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, []);

    const handleComplete = (e: React.MouseEvent, item: NotificationItem) => {
        e.stopPropagation();

        if (item.type === 'finance') {
            const fakeTx = { id: item.id, date: item.date, isPaid: false } as any;
            confirmPayment(fakeTx, (id, status) => {
                // If confirmed, remove locally (Optimistic update via helper)
                removeNotification(id);
            });
        } else {
            completeItem(item.id, item.type);
        }
    };

    const handleCardClick = (item: NotificationItem) => {
        setIsOpen(false);
        if (item.type === 'task') navigate('/tasks', { state: { taskId: item.id } });
        else if (item.type === 'finance') navigate('/finance/transactions', { state: { transactionId: item.id } });
        else if (item.type === 'agenda') navigate('/agenda', { state: { eventId: item.id } });
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'task': return <Briefcase size={14} />;
            case 'finance': return <DollarSign size={14} />;
            case 'agenda': return <Calendar size={14} />;
            default: return <Bell size={14} />;
        }
    };

    const getTypeLabel = (type: NotificationType) => {
        switch (type) {
            case 'task': return 'Tarefa';
            case 'finance': return 'Financeiro';
            case 'agenda': return 'Compromisso';
            default: return 'Notificação';
        }
    };

    const getStatusColor = (status: 'overdue' | 'today' | 'future') => {
        switch (status) {
            case 'overdue': return 'bg-red-500';
            case 'today': return 'bg-yellow-500';
            case 'future': return 'bg-emerald-500';
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (activeFilter === 'all') return true;
        return n.type === activeFilter;
    });

    const FilterTab = ({ label, type }: { label: string, type: 'all' | NotificationType }) => (
        <button
            onClick={() => setActiveFilter(type)}
            className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap",
                activeFilter === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
        >
            {label}
        </button>
    );

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) refetch(); }}
                className="relative p-2 rounded-full hover:bg-secondary/50 transition-colors group"
                title="Notificações"
            >
                <Bell size={20} className={cn(
                    "transition-colors",
                    isOpen ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white border-2 border-background shadow-sm translate-x-[-2px] translate-y-[2px]">
                        {notifications.length > 99 ? '99+' : notifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-popover border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                    <div className="p-3 border-b border-border bg-secondary/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">Notificações</h4>
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                {notifications.length} pendentes
                            </span>
                        </div>

                        {/* Filters */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            <FilterTab label="Todos" type="all" />
                            <FilterTab label="Tarefas" type="task" />
                            <FilterTab label="Financeiro" type="finance" />
                            <FilterTab label="Compromissos" type="agenda" />
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {isLoading ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                                Carregando...
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
                                <Bell size={32} className="opacity-20" />
                                <p className="text-sm">
                                    {notifications.length === 0
                                        ? "Tudo limpo por aqui!"
                                        : "Nenhum item neste filtro."}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map(item => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => handleCardClick(item)}
                                    className="relative flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all group cursor-pointer"
                                >
                                    {/* Color Strip */}
                                    <div className={cn(
                                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
                                        getStatusColor(item.status)
                                    )} />

                                    {/* Icon */}
                                    <div className="mt-0.5 p-1.5 rounded-md bg-secondary text-foreground shrink-0">
                                        {getIcon(item.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {getTypeLabel(item.type)}
                                            </span>
                                            <span className={cn(
                                                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                                item.status === 'overdue' ? "bg-red-500/10 text-red-500" :
                                                    item.status === 'today' ? "bg-yellow-500/10 text-yellow-500" : "text-emerald-500"
                                            )}>
                                                {item.parsedDate ? format(item.parsedDate, "dd/MM", { locale: ptBR }) : 'S/ Data'}
                                            </span>
                                        </div>
                                        <h5 className="text-sm font-medium text-foreground leading-tight mb-1 truncate">
                                            {item.title}
                                        </h5>
                                    </div>

                                    {/* Action */}
                                    <button
                                        onClick={(e) => handleComplete(e, item)}
                                        className="mt-1 p-1.5 rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Concluir"
                                    >
                                        <Check size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {ConfirmationModalComponent}
        </div>
    );
};
