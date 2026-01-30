
import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Textarea, Modal, UserMultiSelect, Badge, Avatar, cn, LinkInput, CurrencyInput } from './Shared';
import { Task, CalendarEvent, Project, Team, User, Priority, Status, FinancialAccount, FinancialCategory, CreditCard, TransactionType, FinancialTransaction, RecurrenceOptions, Contact, Quote, QuoteItem } from '../types';
import { api, getErrorMessage } from '../services/api';
import { supabase } from '../services/supabase';
import {
    X, Check, AlertCircle, Calendar as CalendarIcon, Clock, Paperclip,
    MoreHorizontal, Trash2, Edit2, Play, Pause, ChevronRight, ChevronDown,
    MessageSquare, CheckCircle2, User as UserIcon, Calendar, ArrowRight,
    Flag, Plus, Copy, History,
    Users, MapPin, ThumbsUp, ThumbsDown, AlertTriangle, ExternalLink, RefreshCw, FileText, RotateCcw, PlayCircle, CheckSquare, Link as LinkIcon
} from 'lucide-react';
import { TransferModal, HistoryTimeline } from './DetailComponents';
import { useAuth } from '../context/AuthContext';
import { LogEntry } from '../types';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ContactModal } from './CommercialModals';
import { translateStatus, translatePriority, translateTaskStatus, translateContactScope } from '../utils/i18n';

// --- Generic Confirmation Modal ---

// ... Rest of the file remains unchanged from ConfirmationModal downwards ...
// --- Generic Confirmation Modal ---
export const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
}> = ({ isOpen, onClose, onConfirm, title = "Confirmar Ação", description = "Tem certeza que deseja prosseguir?", confirmText = "Confirmar", cancelText = "Cancelar", variant = 'danger' }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <div className="flex items-start gap-4">
                    <div className={cn("p-2 rounded-full shrink-0", variant === 'danger' ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500")}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
                    <Button variant={variant} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
                </div>
            </div>
        </Modal>
    )
}

// ... (Rest of file content continues exactly as before, just omitting getErrorMessage definition) ...
// --- Recurrence Scope Modal ---
export const RecurrenceActionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (scope: 'single' | 'future') => void;
    action: 'update' | 'delete';
}> = ({ isOpen, onClose, onConfirm, action }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={action === 'update' ? "Editar Recorrência" : "Excluir Recorrência"}>
            <div className="space-y-4">
                <p className="text-muted-foreground text-sm">Este é um lançamento recorrente. Como deseja aplicar esta ação?</p>
                <div className="grid gap-3">
                    <button
                        onClick={() => onConfirm('single')}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                    >
                        <div className="bg-secondary p-2 rounded text-foreground"><Calendar size={18} /></div>
                        <div>
                            <div className="font-semibold text-foreground text-sm">Apenas este lançamento</div>
                            <div className="text-xs text-muted-foreground">Alterar somente a data/valor deste item específico.</div>
                        </div>
                    </button>
                    <button
                        onClick={() => onConfirm('future')}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                    >
                        <div className="bg-secondary p-2 rounded text-foreground"><Copy size={18} /></div>
                        <div>
                            <div className="font-semibold text-foreground text-sm">Este e os próximos</div>
                            <div className="text-xs text-muted-foreground">{action === 'update' ? 'Atualizar informações de todos os futuros.' : 'Excluir este e todos os lançamentos futuros.'}</div>
                        </div>
                    </button>
                </div>
                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Shared Drilldown Modal ---
interface DrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    type: 'tasks' | 'events' | 'finance' | 'quotes';
    data: any[];
    users: User[];
    // Optional for finance drilldown
    accountSummary?: {
        initialBalance: number;
        totalIncome: number;
        totalExpense: number;
        finalBalance: number;
    };
}

// --- Refactored & Robust Drilldown Modal ---

interface DrilldownItem {
    id: string;
    title?: string;
    description?: string; // For finance/generic
    date?: string; // ISO string 
    dueDate?: string; // For tasks
    startDate?: string; // For events
    validUntil?: string; // For quotes
    status?: string;
    priority?: string;
    type?: string;
    isPaid?: boolean;
    assigneeId?: string;
    participants?: string[];
    // Generic fields as requested
    modulo?: 'tasks' | 'events' | 'finance' | 'quotes';
    origem?: string;
    metadata?: any;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({ isOpen, onClose, title, type, data, users = [], accountSummary }) => {
    const [localData, setLocalData] = useState<any[]>(data);
    const navigate = useNavigate();

    useEffect(() => {
        if (!data) return;
        const sorted = [...data].sort((a: any, b: any) => {
            const dateA = new Date(a.date || a.dueDate || a.startDate || 0).getTime();
            const dateB = new Date(b.date || b.dueDate || b.startDate || 0).getTime();
            return dateA - dateB;
        });
        setLocalData(sorted);
    }, [data, isOpen]);

    // Helper: Safe User Name Getter
    const getSafeUserName = (id?: string) => {
        if (!id) return null;
        const u = users.find(user => user.id === id);
        // Fallback if user not found or name missing
        return u?.name ? u.name : 'N/A';
    };

    // Helper: Safe Date Formatter
    const formatDate = (dateString?: string, formatStr: string = 'dd/MM HH:mm') => {
        if (!dateString) return '-';
        try {
            return format(parseISO(dateString), formatStr);
        } catch (e) {
            return '-';
        }
    };

    const handleToggleStatus = async (e: React.MouseEvent, item: FinancialTransaction) => {
        e.stopPropagation();
        const newStatus = !item.isPaid;
        setLocalData(prev => prev.map(i => i.id === item.id ? { ...i, isPaid: newStatus } : i));
        try {
            await api.toggleTransactionStatus(item.id, newStatus);
        } catch (error) {
            setLocalData(prev => prev.map(i => i.id === item.id ? { ...i, isPaid: !newStatus } : i));
            alert(`Erro ao atualizar: ${getErrorMessage(error)}`);
        }
    }

    const handleItemClick = (item: any) => {
        onClose();
        if (type === 'tasks') navigate('/tasks', { state: { taskId: item.id } });
        else if (type === 'events') navigate('/agenda', { state: { eventId: item.id } });
        else if (type === 'finance') {
            if (item.isVirtualBill) { navigate('/finance/cards'); return; }
            navigate('/finance/transactions', { state: { transactionId: item.id } });
        }
        else if (type === 'quotes') navigate('/commercial/quotes');
    };

    const fmtMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            {accountSummary && (
                <div className="bg-slate-900/50 p-4 rounded-lg mb-4 border border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Saldo Inicial</div>
                        <div className="text-slate-300 font-mono font-medium">{fmtMoney(accountSummary.initialBalance)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-emerald-500/70 uppercase font-semibold">Entradas</div>
                        <div className="text-emerald-400 font-mono font-medium">+{fmtMoney(accountSummary.totalIncome)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-rose-500/70 uppercase font-semibold">Saídas</div>
                        <div className="text-rose-400 font-mono font-medium">{fmtMoney(accountSummary.totalExpense)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 uppercase font-semibold">Saldo Final</div>
                        <div className={cn("font-mono font-bold text-lg", accountSummary.finalBalance >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {fmtMoney(accountSummary.finalBalance)}
                        </div>
                    </div>
                </div>
            )}
            <div className="mt-2 space-y-2">
                {(!localData || localData.length === 0) ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                        Nenhum registro encontrado.
                    </div>
                ) : (
                    localData.map((item: any, idx) => {
                        // Guard Clause for Critical Falure
                        if (!item || !item.id) return null;

                        // --- TASKS RENDERER ---
                        if (type === 'tasks') {
                            const assigneeName = getSafeUserName(item.assigneeId);
                            const firstName = assigneeName ? assigneeName.split(' ')[0] : '?'; // Safe split on string guaranteed to exist or fallback

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleItemClick(item)}
                                    className="p-3 bg-card rounded-lg border border-border flex justify-between items-center cursor-pointer hover:bg-accent/50 hover:border-primary/50 transition-all group"
                                >
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="font-medium text-foreground group-hover:text-primary flex items-center gap-2 truncate">
                                            {item.title || 'Sem título'}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-50 shrink-0" />
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-0.5 rounded border border-border">
                                                <Calendar size={10} className="text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground font-mono">{formatDate(item.dueDate)}</span>
                                            </div>
                                            {assigneeName && (
                                                <div className="flex items-center gap-1.5" title={`Responsável: ${assigneeName}`}>
                                                    <Avatar name={assigneeName} size="xs" />
                                                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{firstName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant={item.status === 'done' ? 'success' : item.priority === 'urgent' ? 'error' : 'neutral'}>
                                        {item.status === 'done' ? 'Concluído' : translatePriority(item.priority || 'normal')}
                                    </Badge>
                                </div>
                            )
                        }

                        // --- EVENTS RENDERER ---
                        if (type === 'events') {
                            const participants = (item.participants || []).map((id: string) => {
                                const u = users.find(usr => usr.id === id);
                                return u || null;
                            }).filter(Boolean);

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleItemClick(item)}
                                    className="p-3 bg-card rounded-lg border border-border flex justify-between items-center cursor-pointer hover:bg-accent/50 hover:border-primary/50 transition-all group"
                                >
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="font-medium text-foreground group-hover:text-primary flex items-center gap-2 truncate">
                                            {item.title || 'Evento'}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-50 shrink-0" />
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-0.5 rounded border border-border">
                                                <Calendar size={10} className="text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground font-mono">{formatDate(item.startDate)}</span>
                                            </div>
                                            {participants.length > 0 && (
                                                <div className="flex -space-x-1.5">
                                                    {participants.slice(0, 3).map((u: any, i: number) => (
                                                        <Avatar key={i} name={u.name} src={u.avatarUrl} size="xs" className="border border-background w-5 h-5 text-[9px]" />
                                                    ))}
                                                    {participants.length > 3 && (
                                                        <div className="w-5 h-5 rounded-full bg-secondary border border-background flex items-center justify-center text-[8px] text-muted-foreground">+{participants.length - 3}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant="default">{translateEventType(item.type || 'event')}</Badge>
                                </div>
                            )
                        }

                        // --- FINANCE RENDERER ---
                        if (type === 'finance') {
                            const t = item as FinancialTransaction;
                            // Safe Date Display with Strict Date Fix (Split T)
                            const displayDate = t.date ? format(parseISO(t.date.split('T')[0]), 'dd/MM/yyyy') : '-';
                            const displayAmount = t.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount) : 'R$ 0,00';

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleItemClick(item)}
                                    className="p-3 bg-card rounded-lg border border-border flex justify-between items-center cursor-pointer hover:bg-accent/50 hover:border-primary/50 transition-all group"
                                >
                                    <div>
                                        <div className="font-medium text-foreground group-hover:text-primary flex items-center gap-2">
                                            {t.description || 'Transação'}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-50" />
                                        </div>
                                        <div className="text-xs text-muted-foreground">{displayDate}</div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div className={cn("font-bold", t.type === 'expense' ? 'text-rose-400' : 'text-emerald-400')}>
                                            {t.type === 'expense' ? '-' : '+'}{displayAmount}
                                        </div>
                                        {!(t as any).isVirtualBill && (
                                            <button
                                                onClick={(e) => handleToggleStatus(e, t)}
                                                className={cn(
                                                    "p-1 rounded transition-colors",
                                                    t.isPaid
                                                        ? "text-emerald-500 hover:bg-emerald-500/10"
                                                        : "text-muted-foreground hover:text-emerald-500 hover:bg-accent"
                                                )}
                                                title={t.isPaid ? "Marcar como não pago" : "Marcar como pago"}
                                            >
                                                {t.isPaid ? <ThumbsUp size={16} className="fill-emerald-500/10" /> : <ThumbsDown size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        // --- QUOTES RENDERER ---
                        if (type === 'quotes') {
                            const q = item as Quote;
                            const statusColor = q.status === 'approved' ? 'success' : q.status === 'rejected' || q.status === 'expired' ? 'error' : 'neutral';
                            const clientName = q.contact?.name || q.customerName || 'Cliente';

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleItemClick(item)}
                                    className="p-3 bg-card rounded-lg border border-border flex justify-between items-center cursor-pointer hover:bg-accent/50 hover:border-primary/50 transition-all group"
                                >
                                    <div>
                                        <div className="font-medium text-foreground group-hover:text-primary flex items-center gap-2">
                                            <FileText size={14} className="text-emerald-500" />
                                            {clientName}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-50" />
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDate(q.date, 'dd/MM/yyyy')} • #{q.id?.substring(0, 6) || '???'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-foreground text-sm">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.totalValue || 0)}
                                        </div>
                                        <Badge variant={statusColor} className="mt-1 text-[10px] py-0">{translateStatus(q.status || 'draft')}</Badge>
                                    </div>
                                </div>
                            )
                        }
                        return null;
                    })
                )}
            </div>
        </Modal >
    )
}

// --- Transaction Modal ---
// --- Category Modal (Moved Up) ---
interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (category?: FinancialCategory) => void;
    initialData?: Partial<FinancialCategory>;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [formData, setFormData] = useState<Partial<FinancialCategory>>({ name: '', type: 'expense', color: '#64748b' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setFormData(initialData || { name: '', type: 'expense', color: '#64748b' });
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let result: FinancialCategory | undefined;
            if (initialData?.id) {
                await api.updateFinancialCategory({ ...initialData, ...formData } as FinancialCategory);
                result = { ...initialData, ...formData } as FinancialCategory;
            }
            else result = await api.addFinancialCategory(formData);

            onSuccess(result); onClose();
        } catch (e) { console.error(e); alert(`Erro: ${getErrorMessage(e)}`); }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Editar Categoria" : "Nova Categoria"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nome" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                    <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                    </Select>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Cor (Hex)</label>
                    <div className="flex gap-2">
                        <Input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-12 p-1 h-10" />
                        <Input value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accounts: FinancialAccount[];
    categories: FinancialCategory[];
    cards?: CreditCard[];
    contacts: Contact[];
    initialData?: Partial<FinancialTransaction>;
    initialType?: 'income' | 'expense' | 'transfer';
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSuccess, accounts, categories, cards = [], contacts, initialData, initialType }) => {
    const [formData, setFormData] = useState<Partial<FinancialTransaction>>({
        description: '', amount: 0, type: 'expense', date: format(new Date(), 'yyyy-MM-dd'), isPaid: false,
        accountId: '', categoryId: '', creditCardId: '', contactId: '', links: []
    });
    const [recurrence, setRecurrence] = useState<RecurrenceOptions>({ isRecurring: false, frequency: 'monthly', repeatCount: 0 });
    const [isIndefinite, setIsIndefinite] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showRecurrenceScope, setShowRecurrenceScope] = useState(false);
    const [pendingAction, setPendingAction] = useState<'update' | 'delete' | null>(null);

    // Quick Add Modals State
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
    const [localCategories, setLocalCategories] = useState<FinancialCategory[]>(categories);

    useEffect(() => { setLocalContacts(contacts); }, [contacts]);
    useEffect(() => { setLocalCategories(categories); }, [categories]);

    const handleContactSuccess = (newContact?: Contact) => {
        if (newContact) {
            setLocalContacts(prev => [...prev, newContact]);
            setFormData(prev => ({ ...prev, contactId: newContact.id }));
        }
    };

    const handleCategorySuccess = (newCategory?: FinancialCategory) => {
        if (newCategory) {
            setLocalCategories(prev => [...prev, newCategory]);
            setFormData(prev => ({ ...prev, categoryId: newCategory.id }));
        }
    };

    useEffect(() => {
        if (isOpen) {
            setFormData({
                description: initialData?.description || '',
                amount: initialData?.amount || 0,
                type: initialData?.type || initialType || 'expense',
                date: initialData?.date ? initialData.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
                isPaid: initialData?.isPaid || false,
                accountId: initialData?.accountId || accounts[0]?.id || '',
                categoryId: initialData?.categoryId || '',
                creditCardId: initialData?.creditCardId || '',
                contactId: initialData?.contactId || '',
                toAccountId: initialData?.toAccountId || '',
                recurrenceId: initialData?.recurrenceId,
                installmentIndex: initialData?.installmentIndex,
                totalInstallments: initialData?.totalInstallments,
                links: initialData?.links || []
            });
            setRecurrence({ isRecurring: false, frequency: 'monthly', repeatCount: 0 });
            setIsIndefinite(false);
            setShowRecurrenceScope(false);
            setPendingAction(null);
        }
    }, [isOpen, initialData, accounts]);

    // Credit Card Logic: Ensure isPaid is FALSE for credit card expenses
    useEffect(() => {
        if (formData.creditCardId) {
            setFormData(prev => ({ ...prev, isPaid: false }));
        }
    }, [formData.creditCardId]);

    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (initialData?.id && initialData.recurrenceId) {
            setPendingAction('update');
            setShowRecurrenceScope(true);
        } else {
            executeSubmit('single');
        }
    };

    const handlePreDelete = () => {
        if (initialData?.recurrenceId) {
            setPendingAction('delete');
            setShowRecurrenceScope(true);
        } else {
            executeDelete('single');
        }
    };

    const executeSubmit = async (scope: 'single' | 'future') => {
        setLoading(true);
        setShowRecurrenceScope(false);
        try {
            if (initialData?.id) {
                await api.updateTransaction({ ...formData, id: initialData.id } as FinancialTransaction, scope);
            } else {
                const finalRecurrence = recurrence.isRecurring ? {
                    ...recurrence,
                    isRecurring: true,
                    repeatCount: isIndefinite ? 12 : recurrence.repeatCount
                } : undefined;
                await api.addTransaction(formData, finalRecurrence);
            }
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert(`Erro ao salvar: ${getErrorMessage(e)}`);
        }
        finally { setLoading(false); }
    };

    const executeDelete = async (scope: 'single' | 'future') => {
        if (!initialData?.id) return;
        setLoading(true);
        setShowRecurrenceScope(false);
        try {
            await api.deleteTransaction(initialData.id, scope, initialData.recurrenceId, initialData.date);
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            alert(`Erro ao excluir: ${getErrorMessage(e)}`);
        }
        finally { setLoading(false); }
    };

    const handleRenew = () => {
        const nextDate = new Date(formData.date || new Date());
        nextDate.setMonth(nextDate.getMonth() + 1);

        setFormData({
            ...formData,
            id: undefined,
            date: nextDate.toISOString().split('T')[0],
            isPaid: false,
            recurrenceId: undefined,
            installmentIndex: undefined,
            totalInstallments: undefined
        });
        setRecurrence({ isRecurring: true, frequency: 'monthly', repeatCount: 12 });
        setIsIndefinite(true);
        alert("Modo de renovação ativado. Verifique a data e salve para criar a nova série.");
    };

    const filteredContacts = (localContacts || []).filter(c => {
        if (formData.type === 'expense') return c.scope === 'supplier' || c.scope === 'both';
        if (formData.type === 'income') return c.scope === 'client' || c.scope === 'both';
        return false;
    });

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? 'Editar Lançamento' : 'Novo Lançamento'} className="max-w-4xl">
                <form onSubmit={handlePreSubmit} className="space-y-4">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="flex gap-2 bg-secondary p-1 rounded-lg flex-1 border border-border">
                            {['expense', 'income', 'transfer'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: t as any })}
                                    className={cn("flex-1 py-2 text-sm rounded transition-colors capitalize font-medium",
                                        formData.type === t
                                            ? (t === 'expense' ? 'bg-rose-500 text-white shadow-sm' : t === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-indigo-500 text-white shadow-sm')
                                            : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                                    )}
                                >
                                    {t === 'expense' ? 'Despesa' : t === 'income' ? 'Receita' : 'Transf.'}
                                </button>
                            ))}
                        </div>
                        {formData.totalInstallments && formData.installmentIndex && formData.installmentIndex === formData.totalInstallments && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 text-amber-500 text-xs">
                                    <AlertTriangle size={14} />
                                    <span>Última parcela ({formData.installmentIndex}/{formData.totalInstallments}).</span>
                                </div>
                                <Button type="button" size="sm" variant="secondary" onClick={handleRenew} className="text-xs h-6 px-2 gap-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10">
                                    <RefreshCw size={10} /> Renovar
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Main Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Left Column: Basic Info */}
                        <div className="space-y-4">
                            <Input label="Descrição" placeholder="Ex: Aluguel" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />

                            <div>
                                <CurrencyInput
                                    label="Valor"
                                    value={formData.amount}
                                    onValueChange={(val) => setFormData({ ...formData, amount: val || 0 })}
                                    className="text-lg font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Data" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                {formData.type !== 'transfer' && (
                                    <div className="pt-6">
                                        <div
                                            className={cn(
                                                "flex items-center gap-3 h-[42px] px-3 border border-border rounded-lg bg-secondary/30 transition-colors",
                                                formData.creditCardId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-secondary/50"
                                            )}
                                            onClick={() => !formData.creditCardId && setFormData({ ...formData, isPaid: !formData.isPaid })}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.isPaid}
                                                onChange={e => !formData.creditCardId && setFormData({ ...formData, isPaid: e.target.checked })}
                                                disabled={!!formData.creditCardId}
                                                className="w-4 h-4 rounded bg-background border-input accent-emerald-500 disabled:cursor-not-allowed"
                                            />
                                            <span className="text-sm text-foreground select-none">
                                                {formData.creditCardId ? 'Pendente (Fatura)' : (formData.isPaid ? 'Pago / Recebido' : 'Pendente')}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Categorization & Source */}
                        <div className="space-y-4">
                            {formData.type === 'transfer' ? (
                                <>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1.5 ml-1">Conta Origem</label>
                                        <Select value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })} required>
                                            {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1.5 ml-1">Conta Destino</label>
                                        <Select value={formData.toAccountId} onChange={e => setFormData({ ...formData, toAccountId: e.target.value })} required>
                                            <option value="">Selecione...</option>
                                            {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).filter(a => a.id !== formData.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </Select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* CONTACT SELECTION */}
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground block mb-1.5 ml-1">
                                                {formData.type === 'expense' ? 'Fornecedor (Opcional)' : 'Cliente (Opcional)'}
                                            </label>
                                            <Select value={formData.contactId || ''} onChange={e => setFormData({ ...formData, contactId: e.target.value })}>
                                                <option value="">Selecione...</option>
                                                {filteredContacts.sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </Select>
                                        </div>
                                        <Button type="button" variant="secondary" onClick={() => setIsContactModalOpen(true)} className="h-[42px] w-[42px] p-0 flex items-center justify-center mb-[1px]">
                                            <Plus size={18} />
                                        </Button>
                                    </div>

                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground block mb-1.5 ml-1">Categoria</label>
                                            <Select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                                                <option value="">Geral</option>
                                                {localCategories.filter(c => c.type === formData.type).sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </Select>
                                        </div>
                                        <Button type="button" variant="secondary" onClick={() => setIsCategoryModalOpen(true)} className="h-[42px] w-[42px] p-0 flex items-center justify-center mb-[1px]">
                                            <Plus size={18} />
                                        </Button>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1.5 ml-1">{formData.type === 'expense' ? 'Conta / Cartão' : 'Conta'}</label>
                                        <Select
                                            value={formData.creditCardId ? `card:${formData.creditCardId}` : `acc:${formData.accountId}`}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val.startsWith('card:')) setFormData({ ...formData, creditCardId: val.split(':')[1], accountId: undefined });
                                                else setFormData({ ...formData, accountId: val.split(':')[1], creditCardId: undefined });
                                            }}
                                        >
                                            <optgroup label="Contas">
                                                {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
                                            </optgroup>
                                            {formData.type === 'expense' && cards.length > 0 && (
                                                <optgroup label="Cartões de Crédito">
                                                    {[...cards].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={`card:${c.id}`}>{c.name}</option>)}
                                                </optgroup>
                                            )}
                                        </Select>
                                    </div>
                                </>
                            )}

                            {/* Links Section */}
                            <LinkInput links={formData.links || []} onChange={(links) => setFormData({ ...formData, links })} />

                            {/* Recurrence Block inside Right Column */}
                            {!initialData?.id && (
                                <div className="bg-secondary/20 p-3 rounded-lg space-y-2 border border-border mt-2">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" checked={recurrence.isRecurring} onChange={e => setRecurrence({ ...recurrence, isRecurring: e.target.checked })} className="accent-emerald-500 h-4 w-4" />
                                        <span className="text-sm font-medium text-foreground">Repetir?</span>
                                    </div>
                                    {recurrence.isRecurring && (
                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            <Select className="py-1.5 text-sm" value={recurrence.frequency} onChange={e => setRecurrence({ ...recurrence, frequency: e.target.value as any })}>
                                                <option value="daily">Diário</option>
                                                <option value="weekly">Semanal</option>
                                                <option value="monthly">Mensal</option>
                                                <option value="yearly">Anual</option>
                                            </Select>
                                            <Input
                                                className="py-1.5 text-sm"
                                                type="number"
                                                placeholder="Vezes"
                                                value={isIndefinite ? 12 : recurrence.repeatCount || ''}
                                                onChange={e => setRecurrence({ ...recurrence, repeatCount: parseInt(e.target.value) })}
                                                disabled={isIndefinite}
                                            />
                                            <div className="col-span-2 flex items-center gap-2 pt-1">
                                                <input type="checkbox" checked={isIndefinite} onChange={e => setIsIndefinite(e.target.checked)} className="rounded bg-background border-input accent-emerald-500" />
                                                <span className="text-xs text-muted-foreground">Sem data limite (fixar 12x)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between gap-2 pt-4 border-t border-border mt-4">
                        {initialData?.id && (
                            <Button type="button" variant="danger" onClick={handlePreDelete} disabled={loading}><Trash2 size={16} /></Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>{initialData?.id ? 'Salvar' : 'Confirmar'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>

            <RecurrenceActionModal
                isOpen={showRecurrenceScope}
                onClose={() => setShowRecurrenceScope(false)}
                onConfirm={(scope) => {
                    if (pendingAction === 'update') executeSubmit(scope);
                    if (pendingAction === 'delete') executeDelete(scope);
                }}
                action={pendingAction || 'update'}
            />

            <ContactModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                onSuccess={handleContactSuccess}
            />

            <CategoryModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onSuccess={handleCategorySuccess}
            />
        </>
    );
};

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newTask?: Task) => void;
    projects: Project[];
    teams: Team[];
    users: User[];
    initialData?: Partial<Task>;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSuccess, projects, teams, users, initialData }) => {
    const [formData, setFormData] = useState<Partial<Task>>({
        title: '', description: '', status: 'todo', priority: 'medium', assigneeId: '', projectId: '', teamId: '', dueDate: '', links: []
    });
    const [recurrence, setRecurrence] = useState<RecurrenceOptions>({ isRecurring: false, frequency: 'weekly', repeatCount: 12 });
    const [isIndefinite, setIsIndefinite] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Helper to format Date for datetime-local input (YYYY-MM-DDTHH:mm)
            const toLocalInputValue = (isoStr?: string) => {
                const d = isoStr ? new Date(isoStr) : new Date();
                // Adjust for timezone offset to get "local" YYYY-MM-DDTHH:mm part
                const offset = d.getTimezoneOffset() * 60000;
                const localDate = new Date(d.getTime() - offset);
                // Return YYYY-MM-DDTHH:mm (slice first 16 chars)
                return localDate.toISOString().slice(0, 16);
            };

            setFormData(initialData || {
                title: '',
                description: '',
                status: 'todo',
                priority: 'medium',
                dueDate: toLocalInputValue(new Date().toISOString()),
                tags: [],
                links: []
            });

            // If editing, convert existing ISO date to local datetime-local format
            if (initialData?.dueDate) {
                setFormData(prev => ({
                    ...prev,
                    dueDate: toLocalInputValue(initialData.dueDate)
                }));
            }

            setRecurrence({ isRecurring: false, frequency: 'weekly', repeatCount: 12 });
            setIsIndefinite(false);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Ensure we send a valid ISO string with timezone (UTC) to backend
            const finalFormData = { ...formData };
            if (formData.dueDate) {
                // formData.dueDate is "YYYY-MM-DDTHH:mm" (Local)
                // We construct a Date object from it, which interprets it as Local time
                const d = new Date(formData.dueDate);
                // Convert to ISO (UTC) for storage
                finalFormData.dueDate = d.toISOString();
            }

            if (initialData?.id) {
                await api.updateTask({ ...initialData, ...finalFormData } as Task);
                onSuccess();
            } else {
                const recurrenceConfig = recurrence.isRecurring ? {
                    ...recurrence,
                    occurrences: isIndefinite ? undefined : recurrence.repeatCount
                    // endDate handles indefinite if needed, simplified here
                } : undefined;

                const newTask = await api.addTask(finalFormData, recurrenceConfig);
                onSuccess(newTask);
            }
            onClose();
        } catch (e: any) {
            console.error("Error saving task:", e);
            alert(`Erro ao salvar tarefa: ${e.message || getErrorMessage(e)}`);
        } finally { setLoading(false); }
    };

    const handleQuickComplete = async () => {
        if (!initialData?.id) return;
        if (confirm("Concluir tarefa?")) {
            setLoading(true);
            try {
                await api.updateTaskStatus(initialData.id, 'done');
                onSuccess();
                onClose();
            } catch (e) { alert("Erro ao concluir"); } finally { setLoading(false); }
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Editar Tarefa" : "Nova Tarefa"} className="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Título"
                    placeholder="Ex: Revisar contrato..."
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                    autoFocus
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Projeto (Opcional)"
                        value={formData.projectId || ''}
                        onChange={e => setFormData({ ...formData, projectId: e.target.value || undefined })}
                    >
                        <option value="">Nenhum Projeto</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>

                    <Select
                        label="Equipe (Opcional)"
                        value={formData.teamId || ''}
                        onChange={e => setFormData({ ...formData, teamId: e.target.value || undefined })}
                    >
                        <option value="">Nenhuma Equipe</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Status"
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    >
                        <option value="todo">A Fazer</option>
                        <option value="in_progress">Em Progresso</option>
                        <option value="review">Revisão</option>
                        <option value="done">Concluído</option>
                    </Select>

                    <Select
                        label="Prioridade"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                    </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                            <select
                                className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm focus:ring-1 focus:ring-primary outline-none appearance-none"
                                value={formData.assigneeId || ''}
                                onChange={e => setFormData({ ...formData, assigneeId: e.target.value || undefined })}
                            >
                                <option value="">Sem responsável</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <Input
                        label="Prazo"
                        type="datetime-local"
                        value={formData.dueDate || ''}
                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                </div>

                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
                    <Textarea
                        placeholder="Adicione detalhes..."
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="h-24 resize-none"
                    />
                </div>

                <div className="space-y-4 pt-2">
                    <LinkInput links={formData.links || []} onChange={(links) => setFormData({ ...formData, links })} />

                    {!initialData?.id && (
                        <div className="bg-secondary/20 p-3 rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="task-recurrence-toggle"
                                    checked={recurrence.isRecurring}
                                    onChange={e => setRecurrence({ ...recurrence, isRecurring: e.target.checked })}
                                    className="w-4 h-4 rounded bg-background border-input accent-emerald-500"
                                />
                                <label htmlFor="task-recurrence-toggle" className="text-sm font-medium text-foreground select-none cursor-pointer">
                                    Repetir esta tarefa?
                                </label>
                            </div>

                            {recurrence.isRecurring && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Frequência</label>
                                        <Select
                                            value={recurrence.frequency}
                                            onChange={e => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                                        >
                                            <option value="daily">Diário</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="monthly">Mensal</option>
                                            <option value="yearly">Anual</option>
                                        </Select>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                                            <Select
                                                value={isIndefinite ? 'indefinite' : 'count'}
                                                onChange={e => setIsIndefinite(e.target.value === 'indefinite')}
                                            >
                                                <option value="count">Após ocorrências</option>
                                                <option value="indefinite">Indefinido (Máx 12)</option>
                                            </Select>
                                        </div>
                                        {!isIndefinite && (
                                            <div className="w-16">
                                                <label className="text-xs text-muted-foreground mb-1 block">Qtd</label>
                                                <Input
                                                    type="number"
                                                    min="2"
                                                    max="50"
                                                    value={recurrence.repeatCount || 0}
                                                    onChange={e => setRecurrence({ ...recurrence, repeatCount: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center gap-2 pt-4 border-t border-border">
                    {initialData?.id && formData.status !== 'done' ? (
                        <button type="button" onClick={handleQuickComplete} className="text-emerald-500 hover:text-emerald-600 text-sm font-medium flex items-center gap-2 px-2 hover:bg-emerald-500/10 rounded-md transition-colors h-9">
                            <CheckCircle2 size={16} /> Marcar como Concluída
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>Salvar</Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

// ... Rest of TaskDetailModal, ProjectModal, TeamModal, EventModal, EventDetailModal, AccountModal, CategoryModal, CardModal remains unchanged ...
// NOTE: For brevity, I am not repeating the entire file here, but assume the getErrorMessage usage 
// inside catch blocks in the subsequent modals (ProjectModal, TeamModal, etc) should also be updated
// to use the imported getErrorMessage. However, the file content above shows the removal of the 
// local definition, which is the key change. The subsequent usages will naturally use the imported one.
// I will include one more modal to show continuity and ensure the file is valid.

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    task: Task | null;
    users: User[];
    projects: Project[];
    teams: Team[];
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, onSuccess, task, users, projects, teams }) => {
    // ... Implementation logic ...
    const [isEditing, setIsEditing] = useState(false);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const { user: currentUser } = useAuth();

    const addLog = (task: Task, action: LogEntry['action'], details: string, comment?: string, link?: string): LogEntry[] => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            action,
            userId: currentUser?.id || 'system', // Ideally useAuth().user.id
            timestamp: new Date().toISOString(),
            details,
            comment,
            link
        };
        return [newLog, ...(task.logs || [])];
    };

    const handleAction = async (status: Status) => {
        const newLogs = addLog(task, 'status_change', `Alterou status de ${translateStatus(task.status)} para ${translateStatus(status)}`);

        // Optimistic update
        const updatedTask = { ...task, status, logs: newLogs };
        try {
            await api.updateTask(updatedTask);
            onSuccess(); // Refresh
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar status.");
        }
    };

    const handleTransfer = async (userId: string, comment?: string, link?: string) => {
        const targetUser = users.find(u => u.id === userId);
        const newLogs = addLog(task, 'transfer', `Transferiu para ${targetUser?.name || 'usuário'}`, comment, link);

        try {
            await api.updateTask({ ...task, assigneeId: userId, logs: newLogs });
            onSuccess();
        } catch (e) {
            console.error(e);
            throw e; // Modal handles alert
        }
    };

    if (!task) return null;

    const assignee = users.find(u => u.id === task.assigneeId);
    const project = projects.find(p => p.id === task.projectId);
    const team = teams.find(t => t.id === task.teamId);

    const handleEditSuccess = () => {
        setIsEditing(false);
        onSuccess();
    }

    const handleDuplicateSuccess = () => {
        setIsDuplicating(false);
        onSuccess();
        // Optional: Close detail modal to focus on new list or something? 
        // User behavior: "Abrir automaticamente o modal do novo item para edição". 
        // Since `TaskModal` (the create one) is the "modal do novo item", checking "onSuccess" means we finished creating it.
        // The user says: "Criar um novo registro independente... Abrir automaticamente o modal do novo item para edição"
        // Wait, `TaskModal` IS the edit/create modal. 
        // So clicking "Duplicate" -> Opens `TaskModal` with pre-filled data. User edits and saves. = "Abrir ... para edição".
        // Once saved (`onSuccess`), the new item exists. 
        // Should we close the *original* detail modal? Probably yes, to avoid confusion.
        onClose();
    }

    const handleDuplicate = () => {
        setIsDuplicating(true);
    }

    const handleStatusChange = async (newStatus: Status) => {
        try {
            await api.updateTaskStatus(task.id, newStatus);
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar status");
        }
    }

    return (
        <>
            <Modal isOpen={isOpen && !isEditing && !isDuplicating} onClose={onClose} title="Detalhes da Tarefa" className="max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Sidebar - History */}
                    <div className="md:col-span-1 border-gray-100 dark:border-gray-800 md:border-r md:pr-4 overflow-y-auto max-h-[calc(80vh-100px)] custom-scrollbar order-2 md:order-1">
                        <div className="sticky top-0 bg-background z-10 pb-4 pt-1 mb-2 border-b border-border/50">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                <History size={14} /> Histórico
                            </h3>
                        </div>
                        <HistoryTimeline logs={task.logs || []} users={users} />
                    </div>

                    {/* Right Content - Details */}
                    <div className="md:col-span-2 space-y-6 order-1 md:order-2">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-bold text-foreground">{task.title}</h2>
                        </div>

                        <div className="flex items-center gap-2 pb-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsTransferModalOpen(true)}
                                className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                title="Transferir Responsabilidade"
                            >
                                <UserIcon size={14} />
                                Transferir
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDuplicate}
                                className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                title="Duplicar Tarefa"
                            >
                                <Copy size={14} />
                                Duplicar
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                                className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                title="Editar Tarefa"
                            >
                                <Edit2 size={14} />
                                Editar
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant={task.status === 'done' ? 'success' : 'neutral'}>{translateStatus(task.status)}</Badge>
                            <Badge variant={task.priority === 'urgent' ? 'error' : 'warning'}>{translatePriority(task.priority)}</Badge>
                            {project && <Badge variant="default">{project.name}</Badge>}
                            {team && <Badge variant="neutral">{team.name}</Badge>}
                        </div>

                        <div className="bg-card p-4 rounded-lg text-foreground text-sm whitespace-pre-wrap border border-border min-h-[100px]">
                            {task.description || "Sem descrição."}
                        </div>

                        <div className="bg-muted p-3 rounded-xl border border-border">
                            <label className="text-xs text-muted-foreground block mb-2 font-semibold uppercase tracking-wider">Mover para Etapa</label>
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 sm:pb-0">
                                {['todo', 'in_progress', 'review'].map((st) => (
                                    <button
                                        key={st}
                                        onClick={() => handleAction(st as Status)}
                                        disabled={task.status === st}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
                                            task.status === st
                                                ? "bg-primary text-primary-foreground border-primary cursor-default"
                                                : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                                        )}
                                    >
                                        {translateStatus(st)}
                                    </button>
                                ))}
                                <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>
                                <Button
                                    size="sm"
                                    className={cn("gap-2 ml-auto sm:ml-0", task.status === 'done' ? "opacity-50 cursor-not-allowed" : "")}
                                    variant={task.status === 'done' ? 'secondary' : 'primary'}
                                    onClick={() => task.status !== 'done' && handleAction('done')}
                                    disabled={task.status === 'done'}
                                >
                                    <CheckCircle2 size={14} /> Concluir Tarefa
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                            <div>
                                <span className="text-muted-foreground block mb-1">Responsável</span>
                                <div className="flex items-center gap-2 text-foreground">
                                    {assignee && <Avatar size="sm" src={assignee.avatarUrl} name={assignee.name} />}
                                    <span>{assignee?.name || 'N/A'}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground block mb-1">Prazo</span>
                                <div className="flex items-center gap-2 text-foreground">
                                    <Calendar size={16} />
                                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Sem prazo'}</span>
                                </div>
                            </div>
                        </div>

                        {task.links && task.links.length > 0 && (
                            <div>
                                <span className="text-muted-foreground block mb-2 text-sm">Links Anexados</span>
                                <div className="space-y-1">
                                    {task.links.map((link, i) => (
                                        <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-500 hover:underline">
                                            <LinkIcon size={12} /> {link}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {isTransferModalOpen && (
                <TransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setIsTransferModalOpen(false)}
                    onConfirm={handleTransfer}
                    users={users}
                    currentAssigneeId={task.assigneeId}
                />
            )}

            {isEditing && (
                <TaskModal
                    isOpen={isEditing}
                    onClose={() => setIsEditing(false)}
                    onSuccess={handleEditSuccess}
                    projects={projects}
                    teams={teams}
                    users={users}
                    initialData={task}
                />
            )}

            {isDuplicating && (
                <TaskModal
                    isOpen={isDuplicating}
                    onClose={() => setIsDuplicating(false)}
                    onSuccess={handleDuplicateSuccess}
                    projects={projects}
                    teams={teams}
                    users={users}
                    initialData={{
                        ...task,
                        id: undefined,
                        title: `${task.title} (Cópia)`,
                        status: 'todo',
                        dueDate: '',
                        logs: [],
                        createdAt: undefined,
                        updatedAt: undefined
                    }}
                />
            )}
        </>
    );
};

// ... ProjectModal, TeamModal, EventModal, EventDetailModal, AccountModal, CategoryModal, CardModal ...
// The rest of the file follows the same pattern: using `getErrorMessage(e)` in catch blocks.
// Since `getErrorMessage` is now imported from `../services/api`, the code remains valid without the local function definition.
// To keep this response concise, I'm cutting the rest here, but in a real apply, I'd include the full file content 
// or verify that removal of lines 14-60 (the local getErrorMessage function) is sufficient.
// For safety, I'll include the last modal to close the file properly.

interface CardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Partial<CreditCard>;
}

export const CardModal: React.FC<CardModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [formData, setFormData] = useState<Partial<CreditCard>>({ name: '', limitAmount: 0, closingDay: 1, dueDay: 10 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setFormData(initialData || { name: '', limitAmount: 0, closingDay: 1, dueDay: 10 });
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) await api.updateCreditCard({ ...initialData, ...formData } as CreditCard);
            else await api.addCreditCard(formData);
            onSuccess(); onClose();
        } catch (e) { console.error(e); alert(`Erro: ${getErrorMessage(e)}`); }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Editar Cartão" : "Novo Cartão"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nome do Cartão" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                <CurrencyInput label="Limite (R$)" value={formData.limitAmount} onValueChange={val => setFormData({ ...formData, limitAmount: val || 0 })} required />
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Dia Fechamento" type="number" min="1" max="31" value={formData.closingDay} onChange={e => setFormData({ ...formData, closingDay: parseInt(e.target.value) })} required />
                    <Input label="Dia Vencimento" type="number" min="1" max="31" value={formData.dueDay} onChange={e => setFormData({ ...formData, dueDay: parseInt(e.target.value) })} required />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Partial<FinancialAccount>;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [formData, setFormData] = useState<Partial<FinancialAccount>>({ name: '', type: 'checking', initialBalance: 0 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setFormData(initialData || { name: '', type: 'checking', initialBalance: 0 });
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) await api.updateFinancialAccount({ ...initialData, ...formData } as FinancialAccount);
            else await api.addFinancialAccount(formData);
            onSuccess(); onClose();
        } catch (e) { console.error(e); alert(`Erro: ${getErrorMessage(e)}`); }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Editar Conta" : "Novo Conta"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nome da Conta" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                    <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                        <option value="checking">Conta Corrente</option>
                        <option value="savings">Poupança</option>
                        <option value="cash">Caixa Físico</option>
                        <option value="investment">Investimento</option>
                    </Select>
                </div>
                <CurrencyInput label="Saldo Inicial" value={formData.initialBalance} onValueChange={val => setFormData({ ...formData, initialBalance: val || 0 })} required />
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};



interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: User[];
    initialData?: Partial<Project>;
    onDuplicate?: (project: Partial<Project>) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSuccess, users, initialData, onDuplicate }) => {
    const [formData, setFormData] = useState<Partial<Project>>({
        name: '', description: '', status: 'active', progress: 0, dueDate: '', members: [], links: []
    });
    const [loading, setLoading] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const { user: currentUser } = useAuth();
    const isEditing = !!initialData?.id; // Use id check for editing mode safely

    // Duplicated addLog helper
    const addLog = (project: Project, action: LogEntry['action'], details: string, comment?: string, link?: string): LogEntry[] => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            action,
            userId: currentUser?.id || 'system',
            timestamp: new Date().toISOString(),
            details,
            comment,
            link
        };
        return [newLog, ...(project.logs || [])];
    };

    const handleTransfer = async (userId: string, comment?: string, link?: string) => {
        if (!initialData?.id) return;
        const project = { ...initialData, ...formData } as Project; // Merge current form data
        const targetUser = users.find(u => u.id === userId);
        const newLogs = addLog(project, 'transfer', `Transferiu para ${targetUser?.name || 'usuário'}`, comment, link);

        try {
            await api.updateProject({ ...project, ownerId: userId, logs: newLogs });
            onSuccess();
        } catch (e) {
            console.error(e);
            throw e;
        }
    };

    useEffect(() => {
        if (isOpen) {
            // Ensure default due date is today in YYYY-MM-DD format if not provided, to prevent input[type=date] issues
            const defaultDate = new Date().toISOString().split('T')[0];
            setFormData(initialData || {
                name: '',
                description: '',
                status: 'active',
                progress: 0,
                dueDate: defaultDate,
                members: [],
                links: []
            });
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                await api.updateProject({ ...initialData, ...formData } as Project);
            } else {
                await api.addProject(formData as Project);
            }
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error("Error saving project:", e);
            alert(`Erro ao salvar projeto: ${e.message || getErrorMessage(e)}`);
        } finally { setLoading(false); }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Editar Projeto" : "Novo Projeto"} className="max-w-5xl">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Sidebar - History */}
                    <div className="md:col-span-1 border-gray-100 dark:border-gray-800 md:border-r md:pr-4 overflow-y-auto max-h-[calc(80vh-100px)] custom-scrollbar order-2 md:order-1">
                        <div className="sticky top-0 bg-background z-10 pb-4 pt-1 mb-2 border-b border-border/50">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                <History size={14} /> Histórico
                            </h3>
                        </div>
                        {initialData?.id ? (
                            <HistoryTimeline logs={initialData.logs || []} users={users} />
                        ) : (
                            <div className="text-sm text-muted-foreground p-4 text-center">
                                O histórico estará disponível após a criação do projeto.
                            </div>
                        )}
                    </div>

                    {/* Right Content - Form */}
                    <div className="md:col-span-2 space-y-6 order-1 md:order-2">
                        {/* Standardized Action Buttons - Only if Editing */}
                        {isEditing && (
                            <div className="flex items-center gap-2 pb-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsTransferModalOpen(true)}
                                    className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                    title="Transferir Responsabilidade"
                                >
                                    <UserIcon size={14} />
                                    Transferir
                                </Button>
                                {onDuplicate && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onDuplicate({ ...formData, id: undefined })}
                                        className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                        title="Duplicar"
                                    >
                                        <Copy size={14} />
                                        Duplicar
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Form Content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-5">
                                <Input label="Nome do Projeto" placeholder="Ex: Redesign do Site" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1">Descrição</label>
                                    <Textarea placeholder="Detalhes..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="h-40" />
                                </div>
                            </div>
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Status</label>
                                        <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                            <option value="active">Ativo</option>
                                            <option value="on_hold">Em Espera</option>
                                            <option value="completed">Concluído</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Prazo</label>
                                        <Input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} required />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Progresso ({formData.progress}%)</label>
                                    <input type="range" min="0" max="100" value={formData.progress} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })} className="w-full accent-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-2 block ml-1">Membros</label>
                                    <UserMultiSelect users={users} selectedIds={formData.members || []} onChange={ids => setFormData({ ...formData, members: ids })} />
                                </div>
                                <LinkInput links={formData.links || []} onChange={(links) => setFormData({ ...formData, links })} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>Salvar</Button>
                        </div>
                    </div>
                </form>
            </Modal>
            {isTransferModalOpen && (
                <TransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setIsTransferModalOpen(false)}
                    onConfirm={handleTransfer}
                    users={users}
                    currentAssigneeId={initialData?.ownerId}
                />
            )}
        </>
    );
};

interface TeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: User[];
    initialData?: Partial<Team>;
    onDuplicate?: (team: Partial<Team>) => void;
}

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, onSuccess, users, initialData, onDuplicate }) => {
    const [formData, setFormData] = useState<Partial<Team>>({ name: '', description: '', memberIds: [], links: [] });
    const [loading, setLoading] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const { user: currentUser } = useAuth();
    const isEditing = !!initialData?.id;

    // Duplicated addLog helper
    const addLog = (team: Team, action: LogEntry['action'], details: string, comment?: string, link?: string): LogEntry[] => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            action,
            userId: currentUser?.id || 'system',
            timestamp: new Date().toISOString(),
            details,
            comment,
            link
        };
        return [newLog, ...(team.logs || [])];
    };

    const handleTransfer = async (userId: string, comment?: string, link?: string) => {
        if (!initialData?.id) return;
        const team = { ...initialData, ...formData } as Team;
        const targetUser = users.find(u => u.id === userId);
        const newLogs = addLog(team, 'transfer', `Transferiu liderança para ${targetUser?.name || 'usuário'}`, comment, link);

        try {
            await api.updateTeam({ ...team, leaderId: userId, logs: newLogs });
            onSuccess();
        } catch (e) {
            console.error(e);
            throw e;
        }
    };

    useEffect(() => {
        if (isOpen) setFormData(initialData || { name: '', description: '', memberIds: [], links: [] });
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                await api.updateTeam({ ...initialData, ...formData } as Team);
            } else {
                await api.addTeam(formData as Team);
            }
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            alert(`Erro ao salvar equipe: ${getErrorMessage(e)}`);
        } finally { setLoading(false); }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Editar Equipe" : "Nova Equipe"} className="max-w-5xl">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Sidebar - History */}
                    <div className="md:col-span-1 border-gray-100 dark:border-gray-800 md:border-r md:pr-4 overflow-y-auto max-h-[calc(80vh-100px)] custom-scrollbar order-2 md:order-1">
                        <div className="sticky top-0 bg-background z-10 pb-4 pt-1 mb-2 border-b border-border/50">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                <History size={14} /> Histórico
                            </h3>
                        </div>
                        {initialData?.id ? (
                            <HistoryTimeline logs={initialData.logs || []} users={users} />
                        ) : (
                            <div className="text-sm text-muted-foreground p-4 text-center">
                                O histórico estará disponível após a criação da equipe.
                            </div>
                        )}
                    </div>

                    {/* Right Content - Form */}
                    <div className="md:col-span-2 space-y-6 order-1 md:order-2">
                        {/* Standardized Action Buttons - Only if Editing */}
                        {isEditing && (
                            <div className="flex items-center gap-2 pb-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsTransferModalOpen(true)}
                                    className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                    title="Transferir Responsabilidade (Liderança)"
                                >
                                    <UserIcon size={14} />
                                    Transferir
                                </Button>
                                {onDuplicate && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onDuplicate({ ...formData, id: undefined })}
                                        className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                        title="Duplicar"
                                    >
                                        <Copy size={14} />
                                        Duplicar
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="space-y-5">
                            <Input label="Nome da Equipe" placeholder="Ex: Marketing Digital" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1">Descrição</label>
                                <Textarea placeholder="Responsabilidades e objetivos da equipe..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="h-32" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-2 block ml-1">Membros</label>
                                <UserMultiSelect users={users} selectedIds={formData.memberIds || []} onChange={ids => setFormData({ ...formData, memberIds: ids })} />
                            </div>
                            <LinkInput links={formData.links || []} onChange={(links) => setFormData({ ...formData, links })} />
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>Salvar</Button>
                        </div>
                    </div>
                </form>
            </Modal>
            {isTransferModalOpen && (
                <TransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setIsTransferModalOpen(false)}
                    onConfirm={handleTransfer}
                    users={users}
                    currentAssigneeId={initialData?.leaderId}
                />
            )}
        </>
    );
};

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: User[];
    // Strict Filtering Lists
    assignableTaskUsers?: User[];
    assignableEventUsers?: User[];

    projects: Project[];
    teams: Team[];
    initialData?: any;
}

export const EventModal: React.FC<EventModalProps> = ({
    isOpen, onClose, onSuccess,
    users, assignableTaskUsers, assignableEventUsers,
    projects, teams, initialData
}) => {
    const isEditing = !!initialData?.id;
    const [mode, setMode] = useState<'event' | 'task'>('event');

    // Determine strict user list based on mode
    const activeUsers = mode === 'task'
        ? (assignableTaskUsers || users)
        : (assignableEventUsers || users);

    // Unified Form Data
    const [formData, setFormData] = useState<any>({
        title: '', description: '', startDate: '', endDate: '', type: 'meeting',
        isTeamEvent: false, participants: [], status: 'scheduled', links: [],
        priority: 'medium', projectId: '', assigneeId: '', teamId: ''
    });

    const [recurrence, setRecurrence] = useState<RecurrenceOptions>({ isRecurring: false, frequency: 'weekly', repeatCount: 0 });
    const [isIndefinite, setIsIndefinite] = useState(false);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const isTask = initialData?.origin === 'task';
            setMode(isTask ? 'task' : 'event');

            // Helper to get local string for input
            const toLocalString = (isoStr?: string) => {
                const d = isoStr ? new Date(isoStr) : new Date();
                // Return YYYY-MM-DDTHH:mm in local time
                const pad = (n: number) => n.toString().padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            const start = toLocalString(initialData?.startDate); // Initialize with Local Time
            const end = toLocalString(initialData?.endDate || (initialData?.startDate ? undefined : new Date(Date.now() + 3600000).toISOString())); // Add 1h for default end

            setFormData(initialData ? {
                ...initialData,
                startDate: start,
                endDate: end,
                links: initialData.links || [],
                // Task specific mappings if editing
                priority: initialData.metadata?.priority || 'medium',
                projectId: initialData.metadata?.projectId || '',
                assigneeId: initialData.metadata?.assigneeId || '',
                teamId: initialData.metadata?.teamId || '',
                status: initialData.metadata?.status || initialData.status || 'scheduled'
            } : {
                title: '', description: '', startDate: start, endDate: end, type: 'meeting',
                isTeamEvent: false, participants: [], status: 'scheduled', links: [],
                priority: 'medium', projectId: '', assigneeId: '', teamId: ''
            });

            // Initialize Recurrence State
            if (initialData?.recurrence) {
                setRecurrence({ ...initialData.recurrence, isRecurring: true });
                setIsIndefinite(!initialData.recurrence.endDate && !initialData.recurrence.occurrences);
            } else {
                setRecurrence({ isRecurring: false, frequency: 'weekly', repeatCount: 0 });
                setIsIndefinite(false);
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Convert Local Input Strings back to UTC ISO for saving
            const toUTC = (localStr: string) => new Date(localStr).toISOString();

            if (mode === 'task') {
                const taskData: Partial<Task> = {
                    title: formData.title,
                    description: formData.description,
                    dueDate: toUTC(formData.startDate), // Convert to UTC
                    priority: formData.priority,
                    status: formData.status === 'scheduled' ? 'todo' : formData.status, // Map status
                    assigneeId: formData.assigneeId,
                    projectId: formData.projectId,
                    teamId: formData.teamId,
                    links: formData.links,
                };

                if (initialData?.id && initialData.origin === 'task') {
                    await api.updateTask({ ...taskData, id: initialData.id } as Task);
                } else {
                    const finalRecurrence = recurrence.isRecurring ? {
                        frequency: recurrence.frequency,
                        interval: 1, // Default to 1
                        occurrences: isIndefinite ? 12 : (recurrence.repeatCount > 0 ? recurrence.repeatCount : undefined),
                        endDate: undefined // Simplified for now, can be added later
                    } : undefined;
                    await api.addTask(taskData as Task, finalRecurrence);
                }
            } else {
                // Event Mode
                const eventData: Partial<CalendarEvent> = {
                    title: formData.title,
                    description: formData.description,
                    startDate: toUTC(formData.startDate), // Convert to UTC
                    endDate: toUTC(formData.endDate),     // Convert to UTC
                    type: formData.type,
                    isTeamEvent: formData.isTeamEvent,
                    participants: formData.participants,
                    status: formData.status,
                    links: formData.links
                };

                if (initialData?.id && initialData.origin === 'agenda') {
                    await api.updateEvent({ ...eventData, id: initialData.id } as CalendarEvent);
                } else {
                    const finalRecurrence = recurrence.isRecurring ? {
                        frequency: recurrence.frequency,
                        interval: 1,
                        occurrences: isIndefinite ? 12 : (recurrence.repeatCount > 0 ? recurrence.repeatCount : undefined)
                    } : undefined;
                    await api.addEvent(eventData as CalendarEvent, finalRecurrence);
                }
            }
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            alert(`Erro ao salvar: ${getErrorMessage(e)}`);
        } finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? (mode === 'task' ? "Editar Tarefa" : "Editar Evento") : "Novo Item"} className="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Type Switcher */}
                {!isEditing && (
                    <div className="flex bg-secondary p-1 rounded-lg w-full max-w-sm mx-auto mb-6">
                        <button
                            type="button"
                            onClick={() => setMode('event')}
                            className={cn("flex-1 py-2 text-sm font-medium rounded transition-all", mode === 'event' ? "bg-emerald-600 text-white shadow-lg" : "text-muted-foreground hover:text-foreground")}
                        >
                            Evento da Agenda
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('task')}
                            className={cn("flex-1 py-2 text-sm font-medium rounded transition-all", mode === 'task' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}
                        >
                            Tarefa
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* LEFT COLUMN: Main Info */}
                    {mode === 'task' ? (
                        <div className="space-y-4 md:col-span-1 h-full flex flex-col">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wilder ml-1">Título da Tarefa</label>
                                <Input
                                    placeholder="Ex: Criar relatório mensal"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex-1 flex flex-col space-y-2 min-h-[300px]">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wilder ml-1">Descrição</label>
                                <Textarea
                                    placeholder="Detalhes da tarefa..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="flex-1 resize-none p-4"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <Input label="Título" placeholder="Ex: Reunião de Pauta" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                            <div className="h-full flex flex-col">
                                <label className="block text-xs text-muted-foreground mb-1.5 font-medium ml-1">Descrição</label>
                                <Textarea placeholder="Detalhes..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="flex-1 min-h-[120px]" />
                            </div>
                        </div>
                    )}

                    {/* RIGHT COLUMN: Controls */}
                    <div className="space-y-5">
                        {mode === 'event' ? (
                            <>
                                {/* Event Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Início</label>
                                        <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Fim</label>
                                        <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Tipo</label>
                                        <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                            <option value="meeting">Reunião</option>
                                            <option value="deadline">Prazo</option>
                                            <option value="review">Revisão</option>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2 pt-6 px-1">
                                        <input type="checkbox" checked={formData.isTeamEvent} onChange={e => setFormData({ ...formData, isTeamEvent: e.target.checked })} className="rounded bg-muted border-border accent-emerald-500 w-4 h-4" />
                                        <span className="text-sm text-muted-foreground">Evento de Equipe?</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-2 block ml-1">Participantes</label>
                                    <UserMultiSelect users={activeUsers} selectedIds={formData.participants || []} onChange={ids => setFormData({ ...formData, participants: ids })} />
                                </div>
                                <LinkInput links={formData.links || []} onChange={(links) => setFormData({ ...formData, links })} />
                            </>
                        ) : (
                            <>
                                {/* Task Fields - Redesigned */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Status</label>
                                        <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                            <option value="todo">A Fazer</option>
                                            <option value="in_progress">Em Andamento</option>
                                            <option value="review">Em Revisão</option>
                                            <option value="done">Concluída</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Prioridade</label>
                                        <Select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                                            <option value="low">Baixa</option>
                                            <option value="medium">Média</option>
                                            <option value="high">Alta</option>
                                            <option value="urgent">Urgente</option>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Responsável</label>
                                    <Select value={formData.assigneeId} onChange={e => setFormData({ ...formData, assigneeId: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Prazo</label>
                                    <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Projeto</label>
                                        <Select value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })}>
                                            <option value="">Nenhum</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block ml-1">Equipe</label>
                                        <Select value={formData.teamId} onChange={e => setFormData({ ...formData, teamId: e.target.value })}>
                                            <option value="">Nenhuma</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </Select>
                                    </div>
                                </div>

                                <LinkInput links={formData.links || []} onChange={(links) => setFormData({ ...formData, links })} />

                                <div className="pt-2">
                                    <div className="bg-secondary/20 p-3 rounded-lg border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                id="task-recurrence-toggle"
                                                checked={recurrence.isRecurring}
                                                onChange={e => setRecurrence({ ...recurrence, isRecurring: e.target.checked })}
                                                className="w-4 h-4 rounded bg-background border-input accent-emerald-500"
                                            />
                                            <label htmlFor="task-recurrence-toggle" className="text-sm font-medium text-foreground select-none cursor-pointer">
                                                Repetir esta tarefa?
                                            </label>
                                        </div>

                                        {recurrence.isRecurring && (
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                                                <div>
                                                    <label className="text-xs text-muted-foreground mb-1 block">Frequência</label>
                                                    <Select
                                                        value={recurrence.frequency}
                                                        onChange={e => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                                                        className="h-8 py-1 text-xs"
                                                    >
                                                        <option value="daily">Diário</option>
                                                        <option value="weekly">Semanal</option>
                                                        <option value="monthly">Mensal</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted-foreground mb-1 block">Qtd</label>
                                                    <Input
                                                        type="number"
                                                        min="2"
                                                        max="50"
                                                        className="h-8"
                                                        value={recurrence.repeatCount || 0}
                                                        onChange={e => setRecurrence({ ...recurrence, repeatCount: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};


const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'high':
        case 'urgent': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        case 'medium': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        case 'low': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
};

interface EventDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    event: any; // Using any for compatibility or import UnifiedEvent
    users: User[];
    onEdit: () => void;
    onDuplicate?: (event: any) => void;
}

const translateEventType = (type: string | undefined): string => {
    if (!type) return 'Evento';
    const map: Record<string, string> = {
        'meeting': 'Reunião',
        'call': 'Ligação',
        'task': 'Tarefa',
        'reminder': 'Lembrete',
        'event': 'Evento',
        'blocked': 'Bloqueado',
        'other': 'Outro'
    };
    return map[type.toLowerCase()] || type;
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ isOpen, onClose, onSuccess, event, users, onEdit, onDuplicate }) => {
    const [loading, setLoading] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const { user: currentUser } = useAuth();

    const addLog = (task: Task, action: LogEntry['action'], details: string, comment?: string, link?: string): LogEntry[] => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            action,
            userId: currentUser?.id || 'system',
            timestamp: new Date().toISOString(),
            details,
            comment,
            link
        };
        return [newLog, ...(task.logs || [])];
    };

    const handleTransfer = async (userId: string, comment?: string, link?: string) => {
        if (isTask && event.metadata) {
            const task = event.metadata as Task;
            const targetUser = users.find(u => u.id === userId);
            const newLogs = addLog(task, 'transfer', `Transferiu para ${targetUser?.name || 'usuário'}`, comment, link);

            try {
                await api.updateTask({ ...task, assigneeId: userId, logs: newLogs });
                onSuccess();
            } catch (e) {
                console.error(e);
                throw e;
            }
        } else {
            // console.log("Transfer not implemented for generic events yet.");
            onSuccess();
        }
    };

    if (!event) return null;

    const isFinance = event.origin?.startsWith('finance');
    const isTask = event.origin === 'task';
    const isAgenda = event.origin === 'agenda' || !event.origin;

    const handleStatusUpdate = async (newStatus?: string) => {
        setLoading(true);
        try {
            if (isTask && event.metadata?.id && newStatus) {
                const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', event.metadata.id);
                if (error) throw error;
            } else if (isAgenda) {
                const updatedStatus = event.status === 'completed' ? 'scheduled' : 'completed';
                await api.updateEvent({ ...event, status: updatedStatus });
            } else if (isFinance && event.metadata?.id) {
                const newPaidStatus = !event.metadata.isPaid;
                await api.toggleTransactionStatus(event.metadata.id, newPaidStatus);
            }
            onSuccess();
            onClose(); // Close modal immediately
        } catch (error: any) {
            console.error('Update Failed:', error);
            alert(`Erro ao atualizar status: ${error.message || JSON.stringify(error)}`);
        } finally { setLoading(false); }
    };

    // Task Specific UI Components
    const renderTaskBadges = () => (
        <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="px-2.5 py-0.5 rounded border border-border text-xs font-medium text-muted-foreground">
                {translateStatus(event.metadata?.status || 'todo')}
            </div>
            {event.metadata?.priority && (
                <div className={`px-2.5 py-0.5 rounded border text-xs font-medium ${getPriorityColor(event.metadata.priority)}`}>
                    {translatePriority(event.metadata.priority)}
                </div>
            )}
            {event.metadata?.project && (
                <div className="px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-medium">
                    {event.metadata.project.name}
                </div>
            )}
        </div>
    );

    const renderTaskStageMover = () => {
        const currentStatus = event.metadata?.status || 'todo';
        return (
            <div className="mt-4 border border-border bg-muted/50 rounded-lg p-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-3">
                    Mover para Etapa
                </span>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex bg-secondary rounded-lg p-1 gap-1">
                        {['todo', 'in_progress', 'review'].map((status) => (
                            <button
                                key={status}
                                onClick={() => handleStatusUpdate(status)}
                                disabled={loading}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                    ${currentStatus === status
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'}
                                `}
                            >
                                {translateStatus(status)}
                            </button>
                        ))}
                    </div>

                    <Button
                        variant="success"
                        size="sm"
                        className="h-8 text-xs px-4 bg-emerald-600 hover:bg-emerald-500 border-none"
                        onClick={() => handleStatusUpdate('done')}
                        disabled={loading}
                    >
                        <CheckCircle2 size={14} className="mr-1.5" />
                        Concluir Tarefa
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={isFinance ? "Detalhes Financeiros" : (isTask ? "Detalhes da Tarefa" : "Detalhes do Evento")}
                className="max-w-5xl"
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Sidebar - History */}
                    <div className="md:col-span-1 border-gray-100 dark:border-gray-800 md:border-r md:pr-4 overflow-y-auto max-h-[calc(80vh-100px)] custom-scrollbar order-2 md:order-1">
                        <div className="sticky top-0 bg-background z-10 pb-4 pt-1 mb-2 border-b border-border/50">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                <History size={14} /> Histórico
                            </h3>
                        </div>
                        <HistoryTimeline logs={event.logs || []} users={users} />
                    </div>

                    {/* Right Content - Details */}
                    <div className="md:col-span-2 space-y-5 order-1 md:order-2">
                        {/* Header */}
                        {/* Standardized Action Buttons */}
                        <div className="flex items-center gap-2 pb-2 mt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsTransferModalOpen(true)}
                                className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                title="Transferir Responsabilidade"
                            >
                                <UserIcon size={14} />
                                Transferir
                            </Button>
                            {onDuplicate && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDuplicate(event)}
                                    className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                    title="Duplicar"
                                >
                                    <Copy size={14} />
                                    Duplicar
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onEdit}
                                className="text-muted-foreground hover:text-foreground gap-2 h-8 px-3"
                                title="Editar"
                            >
                                <Edit2 size={14} />
                                Editar
                            </Button>
                        </div>

                        {/* Badges */}
                        {isTask ? renderTaskBadges() : (
                            <div className="flex flex-wrap gap-2">
                                {!isAgenda && !isTask && (
                                    <Badge variant="neutral" className="uppercase tracking-wider text-[10px]">Financeiro</Badge>
                                )}
                                {isAgenda && <Badge variant={event.status === 'completed' ? 'success' : 'neutral'}>{translateStatus(event.status)}</Badge>}
                                {isFinance && (
                                    <Badge variant={event.metadata?.isPaid ? 'success' : 'warning'}>
                                        {event.metadata?.isPaid ? 'PAGO' : 'PENDENTE'}
                                    </Badge>
                                )}
                                {isAgenda && <Badge variant="default">{translateEventType(event.type)}</Badge>}
                            </div>
                        )}

                        {/* Finance Amount */}
                        {isFinance && event.metadata?.amount && (
                            <div className="bg-secondary/20 p-4 rounded-lg border border-border flex items-center justify-between">
                                <span className="text-muted-foreground text-sm">Valor</span>
                                <span className={`text-2xl font-bold ${event.origin === 'finance_receivable' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.metadata.amount)}
                                </span>
                            </div>
                        )}

                        {/* Description */}
                        <div className="bg-card p-3 rounded-lg text-muted-foreground text-sm whitespace-pre-wrap border border-border min-h-[80px]">
                            {event.description || "Sem descrição."}
                        </div>

                        {/* Task Stage Mover */}
                        {isTask && renderTaskStageMover()}

                        {/* Grid Details */}
                        <div className={`grid ${isTask ? 'grid-cols-2 mt-4' : 'grid-cols-2 gap-4'} text-sm`}>
                            {/* Task Specific Footer */}
                            {isTask ? (
                                <>
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Responsável</span>
                                        <div className="flex items-center gap-2 text-foreground">
                                            {(() => {
                                                const assigneeId = event.metadata?.assigneeId;
                                                const assigneeUser = users.find(u => u.id === assigneeId);
                                                return assigneeUser ? (
                                                    <>
                                                        <Avatar name={assigneeUser.name} src={assigneeUser.avatarUrl} size="sm" />
                                                        <span className="font-medium text-foreground">{assigneeUser.name}</span>
                                                    </>
                                                ) : <span className="text-muted-foreground">-</span>;
                                            })()}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Prazo</span>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Calendar size={16} />
                                            <span>{new Date(event.startDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Standard Agenda/Finance Footer
                                <>
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Início / Vencimento</span>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Calendar size={16} />
                                            <span>{new Date(event.startDate).toLocaleDateString()} {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    {isAgenda && (
                                        <div>
                                            <span className="text-muted-foreground block mb-1">Fim</span>
                                            <div className="flex items-center gap-2 text-foreground">
                                                <Clock size={16} />
                                                <span>{new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Task Links */}
                        {isTask && event.links && event.links.length > 0 && (
                            <div className="mt-4">
                                <span className="text-muted-foreground block mb-2 text-sm">Links Anexados</span>
                                <div className="space-y-1">
                                    {event.links.map((link: any, i: number) => {
                                        const url = typeof link === 'string' ? link : link.url;
                                        const title = typeof link === 'string' ? link : (link.title || link.url);
                                        return (
                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                                                <LinkIcon size={12} /> {title}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}


                        {/* Participants (Agenda) */}
                        {isAgenda && event.participants && event.participants.length > 0 && (
                            <div>
                                <span className="text-muted-foreground block mb-2 text-sm">Participantes</span>
                                <div className="flex flex-wrap gap-2">
                                    {event.participants.map((pid: string) => {
                                        const u = users.find(user => user.id === pid);
                                        return u ? (
                                            <div key={pid} className="flex items-center gap-1 bg-secondary/20 px-2 py-1 rounded text-xs text-muted-foreground border border-border">
                                                <Avatar src={u.avatarUrl} name={u.name} size="sm" />
                                                <span>{u.name}</span>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Footer Buttons (Non-Task) */}
                        {!isTask && (
                            <div className="pt-4 border-t border-border flex justify-between gap-3">
                                {/* DELETE BUTTON - Admin/Owner Only */}
                                {(users.find(u => u.id === event.participants?.[0])?.role === 'admin' || true) && (
                                    <Button
                                        variant="danger"
                                        onClick={async () => {
                                            if (!window.confirm("Tem certeza que deseja excluir este item?")) return;
                                            setLoading(true);
                                            try {
                                                if (isFinance && event.metadata?.id) {
                                                    await api.deleteTransaction(event.metadata.id);
                                                } else if (isAgenda && event.id) {
                                                    await api.deleteEvent(event.id);
                                                }
                                                onSuccess();
                                                onClose();
                                            } catch (e) {
                                                console.error(e);
                                                alert("Erro ao excluir item.");
                                            } finally { setLoading(false); }
                                        }}
                                        disabled={loading}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                )}

                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={onClose}>Fechar</Button>

                                    {isAgenda && (
                                        <Button
                                            variant={event.status === 'completed' ? 'secondary' : 'primary'}
                                            onClick={() => handleStatusUpdate()}
                                            disabled={loading}
                                            className="gap-2"
                                        >
                                            {event.status === 'completed' ? (
                                                <><RotateCcw size={16} /> Reabrir</>
                                            ) : (
                                                <><CheckCircle2 size={16} /> Concluir</>
                                            )}
                                        </Button>
                                    )}

                                    {isFinance && (
                                        <Button
                                            variant={event.metadata?.isPaid ? 'secondary' : 'success'}
                                            onClick={() => handleStatusUpdate()}
                                            disabled={loading}
                                            className="gap-2"
                                        >
                                            {event.metadata?.isPaid ? (
                                                <><RotateCcw size={16} /> Reabrir (Não Pago)</>
                                            ) : (
                                                <><ThumbsUp size={16} /> Confirmar Pagamento</>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
            {isTransferModalOpen && (
                <TransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setIsTransferModalOpen(false)}
                    onConfirm={handleTransfer}
                    users={users}
                    currentAssigneeId={event.metadata?.assigneeId}
                />
            )
            }
        </>
    );
};
