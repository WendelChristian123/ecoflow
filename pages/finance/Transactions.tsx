
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact, TenantSettings } from '../../types';
import { Loader, Badge, cn, Button, Select, LinkInput } from '../../components/Shared';
import { TransactionModal, DrilldownModal, ConfirmationModal, RecurrenceActionModal } from '../../components/Modals';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { TrendingUp, TrendingDown, Filter, Plus, Calendar, Search, ArrowRight, DollarSign, MoreVertical, Edit2, Trash2, CheckSquare, Square, ThumbsUp, ThumbsDown, Copy, CreditCard as CardIcon, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, addDays, addMonths, subMonths, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useSearchParams } from 'react-router-dom';

export const FinancialTransactions: React.FC = () => {
    const [searchParams] = useSearchParams(); // Deep linking
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [settings, setSettings] = useState<TenantSettings>({});

    const [filters, setFilters] = useState<FinanceFilters & { search: string }>({
        period: 'month',
        accountId: 'all',
        categoryId: 'all',
        type: 'all',
        status: 'all',
        search: ''
    });
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | undefined>(undefined);
    const [modalInitialType, setModalInitialType] = useState<'income' | 'expense' | 'transfer' | undefined>(undefined);
    const [drilldownState, setDrilldownState] = useState<{ isOpen: boolean, title: string, data: any[] }>({ isOpen: false, title: '', data: [] });

    // Deletion
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [recurrenceDeleteTarget, setRecurrenceDeleteTarget] = useState<FinancialTransaction | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [t, a, c, cc, cont, s] = await Promise.all([
                api.getFinancialTransactions(),
                api.getFinancialAccounts(),
                api.getFinancialCategories(),
                api.getCreditCards(),
                api.getContacts(),
                api.getTenantSettings()
            ]);
            setTransactions(t);
            setAccounts(a);
            setCategories(c);
            setCards(cc);
            setContacts(cont);
            setSettings(s || {});

            // Deep Linking Check
            const transactionId = searchParams.get('transactionId');
            if (transactionId) {
                const target = t.find(tx => tx.id === transactionId);
                if (target) {
                    // 1. Switch month to target date
                    setSelectedMonth(parseISO(target.date));
                    // 2. Open Modal
                    setEditingTransaction(target);
                    setIsModalOpen(true);
                }
            }
        } catch (error) {
            console.error(error);
        } finally { setLoading(false); }
    };

    const handleEdit = (t: FinancialTransaction) => {
        setEditingTransaction(t);
        setIsModalOpen(true);
    };

    const handleCreate = (type?: 'income' | 'expense' | 'transfer') => {
        setEditingTransaction(undefined);
        setModalInitialType(type);
        setIsModalOpen(true);
        setIsAddMenuOpen(false);
    }

    const handleDeleteClick = (e: React.MouseEvent, t: FinancialTransaction) => {
        e.stopPropagation();
        if (t.recurrenceId) {
            setRecurrenceDeleteTarget(t);
        } else {
            setConfirmDeleteId(t.id);
        }
    };

    const deleteTransaction = async () => {
        if (!confirmDeleteId) return;
        try {
            await api.deleteTransaction(confirmDeleteId);
            setConfirmDeleteId(null);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    }

    const executeRecurrenceDelete = async (scope: 'single' | 'future') => {
        if (!recurrenceDeleteTarget) return;
        try {
            await api.deleteTransaction(
                recurrenceDeleteTarget.id,
                scope,
                recurrenceDeleteTarget.recurrenceId,
                recurrenceDeleteTarget.date
            );
            setRecurrenceDeleteTarget(null);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir recorrência.");
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await api.toggleTransactionStatus(id, !currentStatus);
            setTransactions(prev => prev.map(t => t.id === id ? { ...t, isPaid: !currentStatus } : t));
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar status.");
        }
    }

    // Filter Logic
    const getFilteredTransactions = () => {
        // Pass the mode from settings to processTransactions
        // If settings.credit_card_expense_mode is 'competence', individual items are shown
        // If 'cash', they are grouped into virtual invoices
        const mode = settings.credit_card_expense_mode || 'competence';
        let processed = processTransactions(transactions, cards, mode);

        let filtered = processed;
        const now = new Date();

        // 0. Mandatory Technical Filter (Hide Internal/Technical Transactions)
        filtered = filtered.filter(t =>
            t.originType !== 'technical' &&
            !t.description.includes('Crédito Local') &&
            !t.description.includes('Entrada Técnica')
        );

        // 1. Date Filter
        if (filters.period === 'today') {
            filtered = filtered.filter(t => t.date === now.toISOString().split('T')[0]);
        } else if (filters.period === 'last7') {
            const last7 = addDays(now, -7);
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), { start: last7, end: now }));
        } else if (filters.period === 'month') {
            const first = startOfMonth(selectedMonth);
            const last = endOfMonth(selectedMonth);
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), { start: first, end: last }));
        } else if (filters.period === 'custom' && customDateRange.start && customDateRange.end) {
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), {
                start: parseISO(customDateRange.start),
                end: endOfDay(parseISO(customDateRange.end))
            }));
        }

        // 2. Account
        if (filters.accountId !== 'all') filtered = filtered.filter(t => t.accountId === filters.accountId);

        // 3. Category
        if (filters.categoryId !== 'all') filtered = filtered.filter(t => t.categoryId === filters.categoryId);

        // 4. Type
        if (filters.type !== 'all') filtered = filtered.filter(t => t.type === filters.type);

        // 5. Status
        if (filters.status !== 'all') {
            if (filters.status === 'paid') filtered = filtered.filter(t => t.isPaid);
            if (filters.status === 'pending') filtered = filtered.filter(t => !t.isPaid);
            if (filters.status === 'overdue') filtered = filtered.filter(t => !t.isPaid && isBefore(parseISO(t.date), startOfDay(now)));
        }

        // 6. Search
        if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(t =>
                t.description.toLowerCase().includes(q) ||
                (t as any).virtualChildren?.some((c: any) => c.description.toLowerCase().includes(q))
            );
        }

        return filtered; // processTransactions already sorts by date desc
    };

    const filteredData = getFilteredTransactions();

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return <Loader />;

    return (
        <div className="h-full flex flex-col space-y-6 pb-4">
            {/* Header: Title (+) | Month Nav | Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 px-1 relative">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-white">Lançamentos</h1>
                    <div className="relative">
                        <button
                            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                            className="w-8 h-8 rounded-full bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center transition-colors shadow-lg shadow-rose-500/20"
                            title="Novo Lançamento"
                        >
                            <Plus size={18} />
                        </button>

                        {/* Dropdown Menu */}
                        {isAddMenuOpen && (
                            <div className="absolute top-10 left-0 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-1 space-y-0.5">
                                    <button
                                        onClick={() => handleCreate('expense')}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-left"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                                        Nova Despesa
                                    </button>
                                    <button
                                        onClick={() => handleCreate('income')}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-left"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                        Nova Receita
                                    </button>
                                    <button
                                        onClick={() => handleCreate('transfer')}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-left"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
                                        Nova Transferência
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Month Navigation */}
                <div className="flex items-center gap-8 text-slate-200">
                    <button onClick={() => setSelectedMonth(prev => subMonths(prev, 1))} className="text-slate-500 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-lg font-bold capitalize w-36 text-center select-none">
                        {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={() => setSelectedMonth(prev => addMonths(prev, 1))} className="text-slate-500 hover:text-white transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button className="w-10 h-10 rounded-xl bg-transparent border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-center transition-colors">
                        <FileText size={18} />
                    </button>
                    <button className="w-10 h-10 rounded-xl bg-transparent border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-center transition-colors">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-950/30 p-1.5 rounded-xl border border-slate-800/50 flex items-center shrink-0">
                <button className="flex items-center gap-2 text-slate-400 px-4 py-2 border-r border-slate-800/50 hover:text-emerald-500 transition-colors text-xs font-medium uppercase tracking-wide">
                    <Filter size={14} /> Filtrar por
                </button>

                <div className="flex-1 flex items-center gap-2 px-3">
                    <Search size={16} className="text-slate-600" />
                    <input
                        type="text"
                        placeholder="Buscar por descrição, categoria..."
                        className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600"
                        value={filters.search}
                        onChange={e => setFilters({ ...filters, search: e.target.value })}
                    />
                </div>

                <div className="px-2">
                    <Select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="py-1.5 text-xs w-[100px] bg-slate-900 border-slate-800">
                        <option value="all">Todos</option>
                        <option value="paid">Pagos</option>
                        <option value="pending">Pendentes</option>
                        <option value="overdue">Vencidos</option>
                    </Select>
                </div>
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {filteredData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-xl border border-dashed border-slate-800/50">
                        <FileText size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium opacity-50">Nenhum lançamento neste mês.</p>
                    </div>
                ) : (
                    filteredData.map((t) => {
                        const isVirtual = (t as ProcessedTransaction).isVirtual;
                        const accountName = accounts.find(a => a.id === t.accountId)?.name || 'Conta Excluída';
                        const categoryName = categories.find(c => c.id === t.categoryId)?.name || 'Geral';
                        const card = cards.find(c => c.id === t.creditCardId);

                        // Drilldown for virtual invoice
                        const handleVirtualClick = () => {
                            if (isVirtual) {
                                setDrilldownState({
                                    isOpen: true,
                                    title: t.description,
                                    data: (t as ProcessedTransaction).virtualChildren || []
                                });
                            }
                        };

                        // Check if item is an individual credit card expense in Competence Mode
                        // We check: Type=Expense AND CreditCardID exists AND !isVirtual AND Mode=Competence
                        const isCreditCardExpenseInCompetenceMode =
                            t.type === 'expense' &&
                            t.creditCardId &&
                            !isVirtual &&
                            settings.credit_card_expense_mode === 'competence';

                        return (
                            <div
                                key={t.id}
                                className={cn(
                                    "relative flex items-center justify-between p-4 rounded-xl border transition-all group",
                                    isVirtual
                                        ? "bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40 cursor-pointer"
                                        : "bg-slate-800 border-slate-700/50 hover:border-slate-600"
                                )}
                                onClick={isVirtual ? handleVirtualClick : undefined}
                            >
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                        isVirtual ? "bg-indigo-500/10 text-indigo-400" :
                                            t.type === 'income' ? "bg-emerald-500/10 text-emerald-400" :
                                                t.type === 'transfer' ? "bg-blue-500/10 text-blue-400" :
                                                    "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {isVirtual || t.creditCardId ? <CardIcon size={20} /> :
                                            t.type === 'income' ? <TrendingUp size={20} /> :
                                                t.type === 'transfer' ? <ArrowRight size={20} /> :
                                                    <TrendingDown size={20} />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                                            {t.description}
                                            {isVirtual && <Badge variant="neutral" className="h-5 px-1.5 text-[10px]">Fatura Agrupada</Badge>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} /> {t.date.split('T')[0].split('-').reverse().join('/')}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                                            <span>{isVirtual || t.creditCardId ? (card?.name || 'Cartão') : accountName}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                                            <span className="px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                                                {categoryName}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 pl-4">
                                    <div className="text-right">
                                        <div className={cn("font-bold text-sm",
                                            t.type === 'income' ? "text-emerald-400" :
                                                t.type === 'transfer' ? "text-slate-300" :
                                                    "text-rose-400"
                                        )}>
                                            {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{fmt(t.amount)}
                                        </div>
                                        {t.recurrenceId && (
                                            <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1 mt-0.5">
                                                <Copy size={10} /> Recorrente
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions / Status */}
                                    <div className="flex items-center gap-2">
                                        {isVirtual ? (
                                            <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs font-medium">
                                                {t.virtualChildren?.length} itens
                                            </div>
                                        ) : isCreditCardExpenseInCompetenceMode ? (
                                            /* STATIC BADGE FOR CREDIT CARD EXPENSE IN COMPETENCE MODE */
                                            <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium flex items-center gap-1.5 select-none" title="Este item compõe uma fatura de cartão">
                                                <CardIcon size={12} />
                                                <span>Fatura</span>
                                            </div>
                                        ) : (
                                            /* TOGGLE BUTTON FOR STANDARD TRANSACTIONS */
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleStatus(t.id, t.isPaid); }}
                                                className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                                    t.isPaid
                                                        ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                                        : "bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-emerald-500"
                                                )}
                                                title={t.isPaid ? "Pago (Clique para desfazer)" : "Pendente (Clique para pagar)"}
                                            >
                                                {t.isPaid ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
                                            </button>
                                        )}

                                        {/* Edit/Delete Actions */}
                                        {!isVirtual && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={(e) => handleDeleteClick(e, t)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadData}
                accounts={accounts}
                categories={categories}
                cards={cards}
                contacts={contacts}
                initialData={editingTransaction}
                initialType={modalInitialType}
            />

            <DrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState({ ...drilldownState, isOpen: false })}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
            />

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={deleteTransaction}
                title="Excluir Lançamento"
                description="Tem certeza? Esta ação não pode ser desfeita."
            />

            <RecurrenceActionModal
                isOpen={!!recurrenceDeleteTarget}
                onClose={() => setRecurrenceDeleteTarget(null)}
                onConfirm={executeRecurrenceDelete}
                action="delete"
            />
        </div>
    );
};
