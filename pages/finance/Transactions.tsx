
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact, TenantSettings } from '../../types';
import { Loader, Badge, cn, Button, Select, LinkInput } from '../../components/Shared';
import { TransactionModal, DrilldownModal, ConfirmationModal, RecurrenceActionModal } from '../../components/Modals';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { TrendingUp, TrendingDown, Filter, Plus, Calendar, Search, ArrowRight, DollarSign, MoreVertical, Edit2, Trash2, CheckSquare, Square, ThumbsUp, ThumbsDown, Copy, CreditCard as CardIcon, ChevronLeft, ChevronRight, FileText, ShoppingBag, Briefcase, Zap, Home, Car, Utensils, PiggyBank } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, addDays, addMonths, subMonths, isBefore } from 'date-fns';
import { parseDateLocal } from '../../utils/formatters';
import { ptBR } from 'date-fns/locale';

import { useSearchParams } from 'react-router-dom';

/* --- Icon Helper --- */
const getCategoryIcon = (categoryName?: string) => {
    if (!categoryName) return <DollarSign size={16} />;
    const lower = categoryName.toLowerCase();
    if (lower.includes('comida') || lower.includes('restaurante') || lower.includes('alimentação')) return <Utensils size={16} />;
    if (lower.includes('casa') || lower.includes('aluguel') || lower.includes('condomínio')) return <Home size={16} />;
    if (lower.includes('carro') || lower.includes('transporte') || lower.includes('uber')) return <Car size={16} />;
    if (lower.includes('luz') || lower.includes('energia') || lower.includes('internet')) return <Zap size={16} />;
    if (lower.includes('salário') || lower.includes('renda')) return <Briefcase size={16} />;
    if (lower.includes('investimento')) return <PiggyBank size={16} />;
    if (lower.includes('compra') || lower.includes('shopping')) return <ShoppingBag size={16} />;
    return <DollarSign size={16} />;
};


export const FinancialTransactions: React.FC = () => {
    // High contrast scrollbar based on dark theme
    const scrollbarStyles = `
        .transaction-scroll::-webkit-scrollbar {
            width: 6px;
        }
        .transaction-scroll::-webkit-scrollbar-track {
            background: transparent; 
        }
        .transaction-scroll::-webkit-scrollbar-thumb {
            background-color: #334155;
            border-radius: 3px;
        }
        .transaction-scroll::-webkit-scrollbar-thumb:hover {
            background-color: #475569;
        }
    `;

    const [searchParams] = useSearchParams();
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

            const transactionId = searchParams.get('transactionId');
            if (transactionId) {
                const target = t.find(tx => tx.id === transactionId);
                if (target) {
                    setSelectedMonth(parseDateLocal(target.date));
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

    const getFilteredTransactions = () => {
        const mode = settings.credit_card_expense_mode || 'competence';
        let processed = processTransactions(transactions, cards, mode);
        let filtered = processed;
        const now = new Date();

        filtered = filtered.filter(t =>
            t.originType !== 'technical' &&
            !t.description.includes('Crédito Local') &&
            !t.description.includes('Entrada Técnica')
        );

        if (filters.period === 'today') {
            filtered = filtered.filter(t => t.date === now.toISOString().split('T')[0]);
        } else if (filters.period === 'last7') {
            const last7 = addDays(now, -7);
            filtered = filtered.filter(t => isWithinInterval(parseDateLocal(t.date), { start: last7, end: now }));
        } else if (filters.period === 'month') {
            const first = startOfMonth(selectedMonth);
            const last = endOfMonth(selectedMonth);
            filtered = filtered.filter(t => isWithinInterval(parseDateLocal(t.date), { start: first, end: last }));
        } else if (filters.period === 'custom' && customDateRange.start && customDateRange.end) {
            filtered = filtered.filter(t => isWithinInterval(parseDateLocal(t.date), {
                start: parseDateLocal(customDateRange.start),
                end: endOfDay(parseDateLocal(customDateRange.end))
            }));
        }

        if (filters.accountId !== 'all') {
            if (filters.accountId.startsWith('card_')) {
                const cardId = filters.accountId.replace('card_', '');
                filtered = filtered.filter(t => t.creditCardId === cardId);
            } else {
                filtered = filtered.filter(t => t.accountId === filters.accountId);
            }
        }
        if (filters.categoryId !== 'all') filtered = filtered.filter(t => t.categoryId === filters.categoryId);
        if (filters.type !== 'all') filtered = filtered.filter(t => t.type === filters.type);

        if (filters.status !== 'all') {
            if (filters.status === 'paid') filtered = filtered.filter(t => t.isPaid);
            if (filters.status === 'pending') filtered = filtered.filter(t => !t.isPaid);
            if (filters.status === 'overdue') filtered = filtered.filter(t => !t.isPaid && isBefore(parseDateLocal(t.date), startOfDay(now)));
        }

        if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(t =>
                t.description.toLowerCase().includes(q) ||
                (t as ProcessedTransaction).virtualChildren?.some(c => c.description.toLowerCase().includes(q))
            );
        }

        return filtered;
    };

    const filteredData = getFilteredTransactions();

    const sortedData = React.useMemo(() => {
        // Ascending sort (Oldest -> Newest) as per latest request
        return [...filteredData].sort((a, b) => parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime());
    }, [filteredData]);

    // Grouping by Date
    const groupedTransactions = React.useMemo(() => {
        const groups: { [key: string]: (FinancialTransaction | ProcessedTransaction)[] } = {};
        sortedData.forEach(t => {
            const dateKey = t.date.split('T')[0];
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(t);
        });
        // Sort groups Ascending
        return Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(date => ({
            date,
            items: groups[date]
        }));
    }, [sortedData]);

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const renderTransactionItem = (t: FinancialTransaction | ProcessedTransaction) => {
        const isVirtual = (t as ProcessedTransaction).isVirtual;
        const accountName = accounts.find(a => a.id === t.accountId)?.name || 'Conta Excluída';
        const card = cards.find(c => c.id === t.creditCardId);
        const category = categories.find(c => c.id === t.categoryId);

        const handleRowClick = () => {
            if (isVirtual) {
                setDrilldownState({
                    isOpen: true,
                    title: t.description,
                    data: (t as ProcessedTransaction).virtualChildren || []
                });
            } else {
                handleEdit(t as FinancialTransaction);
            }
        };

        // Premium Dark Mode Row Style
        return (
            <div
                key={t.id}
                onClick={handleRowClick}
                className="grid grid-cols-[40px_1fr_auto_auto_auto_80px] md:grid-cols-[48px_1fr_150px_150px_130px_80px] items-center gap-4 px-4 py-3.5 cursor-pointer border-b border-slate-800/40 hover:bg-slate-800/20 transition-all group lg:first:rounded-t-lg lg:last:rounded-b-lg lg:last:border-0"
            >
                {/* 1. Icon - Minimalist with subtle colored bg */}
                <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-inner",
                    t.type === 'income' ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-400"
                )}>
                    {getCategoryIcon(category?.name)}
                </div>

                {/* 2. Description - Clean Font, High Contrast */}
                <div className="flex flex-col min-w-0 pr-2">
                    <span className={cn("text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate tracking-tight", isVirtual && "italic text-slate-400")}>
                        {t.description}
                    </span>
                    {isVirtual && <span className="text-[10px] text-slate-500">Agrupado</span>}
                </div>

                {/* 3. Category - Subtle, low contrast */}
                <div className="hidden md:block truncate">
                    <span className="text-xs text-slate-500 font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                        {category?.name || 'Geral'}
                    </span>
                </div>

                {/* 4. Account - Uppercase, very subtle, dark badge look */}
                <div className="hidden md:block text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-800/50">
                        {isVirtual || t.creditCardId ? (card?.name || 'CARTÃO') : accountName}
                    </span>
                </div>

                {/* 5. Value - Hierarchical Focus: Bold, Colored */}
                <div className={cn(
                    "text-sm md:text-base font-bold whitespace-nowrap text-right tracking-tight",
                    t.type === 'income' ? "text-emerald-500" : "text-rose-500" // STRICT: Red for expenses
                )}>
                    {t.type === 'income' ? '+' : '-'} {fmt(t.amount)}
                </div>

                {/* 6. Action - Plain Icon, no button bg unless active */}
                <div className="flex justify-end items-center gap-1 pr-1" onClick={(e) => e.stopPropagation()}>
                    {!isVirtual && (
                        <>
                            {t.creditCardId ? (
                                <div className="p-2 text-slate-500 cursor-help" title="Lançamento no Cartão">
                                    <CardIcon size={16} />
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStatus(t.id, t.isPaid); }}
                                    className={cn(
                                        "transition-all p-2 rounded-full hover:bg-slate-800",
                                        t.isPaid
                                            ? "text-emerald-500"
                                            : "text-slate-600 hover:text-emerald-500"
                                    )}
                                    title={t.isPaid ? "Pago" : "Marcar como Pago"}
                                >
                                    <ThumbsUp size={16} className={cn(t.isPaid && "fill-current")} />
                                </button>
                            )}

                            <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(t.id); }}
                                className="transition-all p-2 rounded-full text-slate-600 hover:text-rose-500 hover:bg-rose-500/10"
                                title="Excluir"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full flex flex-col overflow-hidden relative bg-[#0b0f19] text-slate-200 font-sans"> {/* Premium Dark Background */}
            <style>{scrollbarStyles}</style>

            {/* Page Header Area */}
            <div className="flex-none px-4 md:px-8 pt-6 pb-4 flex flex-col gap-6 z-20">

                {/* Title Row */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-white tracking-tight">Lançamentos</h1>
                        <button
                            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                            className="w-10 h-10 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-105"
                        >
                            <Plus size={20} />
                        </button>
                        {/* Dropdown Menu */}
                        {isAddMenuOpen && (
                            <div className="absolute top-16 left-8 w-52 bg-[#1e293b] border border-slate-700/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={() => handleCreate('expense')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:text-white hover:bg-slate-700/50 transition-colors text-left border-b border-slate-700/50 last:border-0">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div> Nova Despesa
                                </button>
                                <button onClick={() => handleCreate('income')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:text-white hover:bg-slate-700/50 transition-colors text-left border-b border-slate-700/50 last:border-0">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div> Nova Receita
                                </button>
                                <button onClick={() => handleCreate('transfer')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:text-white hover:bg-slate-700/50 transition-colors text-left">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div> Nova Transferência
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Month Nav */}
                    <div className="flex items-center bg-slate-900/50 rounded-full p-1 border border-slate-800 shadow-sm">
                        <button onClick={() => setSelectedMonth(prev => subMonths(prev, 1))} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold capitalize w-36 text-center text-slate-200 select-none">
                            {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                        </span>
                        <button onClick={() => setSelectedMonth(prev => addMonths(prev, 1))} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Select
                        value={filters.type}
                        onChange={e => setFilters({ ...filters, type: e.target.value as any })}
                        className="py-2.5 bg-[#0f172a] border-slate-800 text-sm focus:border-emerald-500/50 transition-all rounded-lg text-slate-200 font-medium"
                    >
                        <option value="all" className="bg-[#0f172a]">Todas Operações</option>
                        <option value="income" className="bg-[#0f172a]">Receitas</option>
                        <option value="expense" className="bg-[#0f172a]">Despesas</option>
                    </Select>

                    <Select
                        value={filters.status}
                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                        className="py-2.5 bg-[#0f172a] border-slate-800 text-sm focus:border-emerald-500/50 transition-all rounded-lg text-slate-200 font-medium"
                    >
                        <option value="all" className="bg-[#0f172a]">Todos Status</option>
                        <option value="paid" className="bg-[#0f172a]">Pagos</option>
                        <option value="pending" className="bg-[#0f172a]">Pendentes</option>
                        <option value="overdue" className="bg-[#0f172a]">Vencidos</option>
                    </Select>

                    <Select
                        value={filters.accountId}
                        onChange={e => setFilters({ ...filters, accountId: e.target.value })}
                        className="py-2.5 bg-[#0f172a] border-slate-800 text-sm focus:border-emerald-500/50 transition-all rounded-lg text-slate-200 font-medium"
                    >
                        <option value="all" className="bg-[#0f172a]">Contas e Cartões</option>
                        <optgroup label="Contas Bancárias">
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id} className="bg-[#0f172a]">{acc.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Cartões de Crédito">
                            {cards.map(card => (
                                <option key={card.id} value={`card_${card.id}`} className="bg-[#0f172a]">{card.name}</option>
                            ))}
                        </optgroup>
                    </Select>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2.5 bg-[#0f172a] border border-slate-800 rounded-lg text-sm text-slate-200 focus:border-emerald-500/50 focus:bg-[#0f172a] focus:outline-none transition-all placeholder:text-slate-600 font-medium"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-scroll transaction-scroll relative w-full px-4 md:px-8 pb-8">
                <div className="max-w-6xl mx-auto space-y-8 mt-2">
                    {groupedTransactions.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-xl border border-slate-800/20 border-dashed">
                            <FileText size={24} className="mb-2 opacity-30" />
                            <span className="text-sm font-medium">Nenhum lançamento encontrado</span>
                        </div>
                    ) : (
                        groupedTransactions.map(group => (
                            <div key={group.date}>
                                {/* Date Header - As Separator */}
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-4 mb-2 opacity-80 flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                    {format(parseDateLocal(group.date), "dd/MM - EEEE", { locale: ptBR })}
                                </div>
                                {/* Clean Block of Transactions */}
                                <div className="bg-[#111725] border border-slate-800/40 rounded-lg shadow-sm overflow-hidden">
                                    {group.items.map(t => renderTransactionItem(t))}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Static Footer (End of List) */}
                    {filteredData.length > 0 && (
                        <div className="mt-8 mb-4 bg-[#0f172a]/50 border border-slate-800/60 rounded-2xl px-8 py-6 grid grid-cols-2 gap-12">
                            {/* Income Summary */}
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-r border-slate-800/50 pr-12">
                                <div>
                                    <div className="text-emerald-500/80 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></div>
                                        Receitas
                                    </div>
                                    <div className="text-emerald-400 font-bold text-3xl tracking-tight">
                                        {fmt(filteredData.filter(t => t.type === 'income' && t.isPaid).reduce((acc, t) => acc + t.amount, 0))}
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">A Receber</div>
                                    <div className="text-slate-400 font-medium text-sm">
                                        {fmt(filteredData.filter(t => t.type === 'income' && !t.isPaid).reduce((acc, t) => acc + t.amount, 0))}
                                    </div>
                                </div>
                            </div>

                            {/* Expense Summary */}
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div>
                                    <div className="text-rose-500/80 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"></div>
                                        Despesas
                                    </div>
                                    <div className="text-rose-500 font-bold text-3xl tracking-tight">
                                        {fmt(filteredData.filter(t => t.type === 'expense' && t.isPaid).reduce((acc, t) => acc + t.amount, 0))}
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">A Pagar</div>
                                    <div className="text-slate-400 font-medium text-sm">
                                        {fmt(filteredData.filter(t => t.type === 'expense' && !t.isPaid).reduce((acc, t) => acc + t.amount, 0))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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
                data={drilldownState.data}
                type="finance"
                users={[]}
            />

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={deleteTransaction}
                title="Excluir Lançamento"
                description="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                cancelText="Cancelar"
                variant="danger"
            />

            <RecurrenceActionModal
                isOpen={!!recurrenceDeleteTarget}
                onClose={() => setRecurrenceDeleteTarget(null)}
                onConfirm={executeRecurrenceDelete}
                action="delete"
            />
        </div >
    );
};
