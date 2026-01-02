
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact } from '../../types';
import { Loader, Card, Badge, cn, Button, Select, ProgressBar } from '../../components/Shared';
import { DrilldownModal, TransactionModal } from '../../components/Modals';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, DollarSign, ArrowRight, Filter, Plus, CreditCard as CardIcon, Calendar, ThumbsUp, ThumbsDown, BarChart2 } from 'lucide-react';
import { isBefore, startOfDay, endOfDay, addDays, isWithinInterval, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate';
    subtitle?: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const colors = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-slate-800 border border-slate-700/50 p-6 rounded-xl transition-all relative overflow-hidden group flex flex-col justify-between h-full",
                onClick && "cursor-pointer hover:bg-slate-700/50 hover:border-slate-600"
            )}
        >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">{title}</span>
                <div className={cn("p-2 rounded-lg", colors[color])}>{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="text-2xl font-bold text-white tracking-tight">{fmt(value)}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
            </div>
            {onClick && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={18} className="text-slate-400" />
                </div>
            )}
        </div>
    );
};

export const FinancialOverview: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [financeSettings, setFinanceSettings] = useState<any>({});

    const [filters, setFilters] = useState<FinanceFilters & { status: string }>({
        period: 'month',
        accountId: 'all',
        categoryId: 'all',
        type: 'all',
        status: 'all'
    });

    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
    const [chartCustomRange, setChartCustomRange] = useState({ start: '', end: '' });
    const [comparisonMode, setComparisonMode] = useState<'month' | 'semester' | 'year'>('month');

    const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, data: any[] }>({
        isOpen: false, title: '', data: []
    });
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [t, a, c, cc, cont, set] = await Promise.all([
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
            setFinanceSettings(set || {});
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredTransactions = () => {
        const mode = financeSettings.credit_card_expense_mode || 'competence';
        let processedData = processTransactions(transactions, cards, mode);

        let filtered = processedData;
        const now = new Date();
        const todayStart = startOfDay(now);

        // 0. Mandatory Technical Filter
        filtered = filtered.filter(t =>
            t.originType !== 'technical' &&
            !t.description.includes('Pagamento Fatura (Crédito Local)') &&
            !t.description.includes('Entrada Técnica')
        );

        if (filters.period === 'today') {
            filtered = filtered.filter(t => t.date === now.toISOString().split('T')[0]);
        } else if (filters.period === 'last7') {
            const last7 = addDays(now, -7);
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), { start: last7, end: now }));
        } else if (filters.period === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), { start: firstDay, end: lastDay }));
        } else if (filters.period === 'custom' && customDateRange.start && customDateRange.end) {
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), {
                start: parseISO(customDateRange.start),
                end: endOfDay(parseISO(customDateRange.end))
            }));
        }

        if (filters.accountId !== 'all') {
            filtered = filtered.filter(t => t.accountId === filters.accountId);
        }

        if (filters.categoryId !== 'all') {
            filtered = filtered.filter(t => t.categoryId === filters.categoryId);
        }

        if (filters.type !== 'all') {
            filtered = filtered.filter(t => t.type === filters.type);
        }

        if (filters.status === 'overdue') {
            filtered = filtered.filter(t => !t.isPaid && isBefore(parseISO(t.date), todayStart));
        } else if (filters.status === 'pending') {
            filtered = filtered.filter(t => !t.isPaid && !isBefore(parseISO(t.date), todayStart));
        } else if (filters.status === 'paid') {
            filtered = filtered.filter(t => t.isPaid);
        }

        return filtered;
    };

    const handleToggleStatus = async (e: React.MouseEvent, t: FinancialTransaction) => {
        e.stopPropagation();
        const newStatus = !t.isPaid;
        setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isPaid: newStatus } : item));
        try {
            await api.toggleTransactionStatus(t.id, newStatus);
        } catch (error) {
            setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isPaid: !newStatus } : item));
        }
    }

    const filteredData = getFilteredTransactions();
    const todayStart = startOfDay(new Date());

    const isCompetenceExpense = (t: FinancialTransaction) => {
        const mode = financeSettings.credit_card_expense_mode || 'competence';
        // Realized if Paid OR (Expense Type AND CreditCard AND CompetenceMode)
        return t.isPaid || (t.type === 'expense' && t.creditCardId && mode === 'competence');
    };

    const realizedData = filteredData.filter(isCompetenceExpense);
    const realizedIncome = realizedData.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const realizedExpense = realizedData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    const getCardInvoice = (cardId: string) => {
        return transactions
            .filter(t => t.creditCardId === cardId && t.type === 'expense' && !t.isPaid)
            .reduce((acc, t) => acc + t.amount, 0);
    };

    const currentBalance = accounts.reduce((accBalance, account) => {
        const accountIncome = transactions.filter(t => t.accountId === account.id && t.type === 'income' && t.isPaid).reduce((s, t) => s + t.amount, 0);
        const accountExpense = transactions.filter(t => t.accountId === account.id && t.type === 'expense' && t.isPaid).reduce((s, t) => s + t.amount, 0);
        const transfersOut = transactions.filter(t => t.accountId === account.id && t.type === 'transfer' && t.isPaid).reduce((s, t) => s + t.amount, 0);
        const transfersIn = transactions.filter(t => t.toAccountId === account.id && t.type === 'transfer' && t.isPaid).reduce((s, t) => s + t.amount, 0);

        return accBalance + account.initialBalance + accountIncome - accountExpense - transfersOut + transfersIn;
    }, 0);

    const openDrilldown = (title: string, filterFn: (t: FinancialTransaction) => boolean) => {
        const data = filteredData.filter(filterFn);
        setModalState({ isOpen: true, title, data });
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const getComparisonData = () => {
        const now = new Date();
        const data = [];

        if (comparisonMode === 'month') {
            const thisMonthStart = startOfMonth(now);
            const thisMonthEnd = endOfMonth(now);
            const lastMonthStart = startOfMonth(subMonths(now, 1));
            const lastMonthEnd = endOfMonth(subMonths(now, 1));

            const calc = (start: Date, end: Date, type: 'income' | 'expense') =>
                transactions.filter(t =>
                    t.type === type &&
                    isCompetenceExpense(t) &&
                    t.originType !== 'technical' &&
                    !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                    isWithinInterval(parseISO(t.date), { start, end })
                ).reduce((s, t) => s + t.amount, 0);

            data.push({ name: 'Mês Anterior', Receitas: calc(lastMonthStart, lastMonthEnd, 'income'), Despesas: calc(lastMonthStart, lastMonthEnd, 'expense') });
            data.push({ name: 'Mês Atual', Receitas: calc(thisMonthStart, thisMonthEnd, 'income'), Despesas: calc(thisMonthStart, thisMonthEnd, 'expense') });

        } else if (comparisonMode === 'semester') {
            for (let i = 5; i >= 0; i--) {
                const date = subMonths(now, i);
                const start = startOfMonth(date);
                const end = endOfMonth(date);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t =>
                        t.type === type &&
                        isCompetenceExpense(t) &&
                        t.originType !== 'technical' &&
                        !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                        isWithinInterval(parseISO(t.date), { start, end })
                    ).reduce((s, t) => s + t.amount, 0);

                const label = `${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`;
                data.push({ name: label, Receitas: calc('income'), Despesas: calc('expense') });
            }
        } else if (comparisonMode === 'year') {
            for (let i = 11; i >= 0; i--) {
                const date = subMonths(now, i);
                const start = startOfMonth(date);
                const end = endOfMonth(date);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t =>
                        t.type === type &&
                        isCompetenceExpense(t) &&
                        t.originType !== 'technical' &&
                        !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                        isWithinInterval(parseISO(t.date), { start, end })
                    ).reduce((s, t) => s + t.amount, 0);

                const label = `${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`;
                data.push({ name: label, Receitas: calc('income'), Despesas: calc('expense') });
            }
        } else if (comparisonMode === 'custom' && chartCustomRange.start && chartCustomRange.end) {
            const start = startOfMonth(parseISO(chartCustomRange.start));
            const end = endOfMonth(parseISO(chartCustomRange.end));
            // Iterate months from start to end
            let current = start;
            while (current <= end) {
                const monthStart = startOfMonth(current);
                const monthEnd = endOfMonth(current);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t =>
                        t.type === type &&
                        isCompetenceExpense(t) &&
                        t.originType !== 'technical' &&
                        !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                        isWithinInterval(parseISO(t.date), { start: monthStart, end: monthEnd })
                    ).reduce((s, t) => s + t.amount, 0);

                const label = `${current.getMonth() + 1}/${current.getFullYear().toString().substr(2)}`;
                data.push({ name: label, Receitas: calc('income'), Despesas: calc('expense') });
                current = addDays(monthEnd, 1); // Jump to next month
            }
        }
        return data;
    };

    const currentComparisonData = getComparisonData();

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <DollarSign className="text-emerald-500" size={28} /> Visão Geral
                    </h1>
                </div>

                <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                    onClick={() => setIsTransactionModalOpen(true)}
                >
                    <Plus size={18} /> Novo Lançamento
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col xl:flex-row items-center gap-3 mb-8 overflow-x-auto">
                <div className="flex items-center gap-2 px-3 text-slate-400 shrink-0">
                    <Filter size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
                </div>

                <div className="hidden xl:block h-6 w-px bg-slate-800 mx-2" />

                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 w-full">
                    <Select
                        value={filters.period}
                        onChange={e => setFilters({ ...filters, period: e.target.value as any })}
                        className="bg-slate-900 border-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg w-full focus:ring-emerald-500/50"
                    >
                        <option value="today">Hoje</option>
                        <option value="last7">Últimos 7 Dias</option>
                        <option value="month">Este Mês</option>
                        <option value="custom">Personalizado</option>
                        <option value="all">Todo o Período</option>
                    </Select>

                    <Select
                        value={filters.status}
                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                        className="bg-slate-900 border-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg w-full"
                    >
                        <option value="all">Todos Status</option>
                        <option value="overdue">Vencidos</option>
                        <option value="pending">A Vencer</option>
                        <option value="paid">Realizado (Pagos)</option>
                    </Select>

                    <Select
                        value={filters.accountId}
                        onChange={e => setFilters({ ...filters, accountId: e.target.value })}
                        className="bg-slate-900 border-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg w-full"
                    >
                        <option value="all">Todas Contas</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>

                    <Select
                        value={filters.categoryId}
                        onChange={e => setFilters({ ...filters, categoryId: e.target.value })}
                        className="bg-slate-900 border-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg w-full"
                    >
                        <option value="all">Todas Categ.</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>

                    <Select
                        value={filters.type}
                        onChange={e => setFilters({ ...filters, type: e.target.value as any })}
                        className="bg-slate-900 border-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg w-full"
                    >
                        <option value="all">Todos Tipos</option>
                        <option value="income">Receitas</option>
                        <option value="expense">Despesas</option>
                        <option value="transfer">Transferências</option>
                    </Select>
                </div>

                {filters.period === 'custom' && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 ml-2">
                        <input
                            type="date"
                            className="bg-transparent text-xs text-slate-200 outline-none w-24"
                            value={customDateRange.start}
                            onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-slate-600">-</span>
                        <input
                            type="date"
                            className="bg-transparent text-xs text-slate-200 outline-none w-24"
                            value={customDateRange.end}
                            onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                )}
            </div>


            {/* BLOCO 1 - RESUMO */}
            {/* BLOCO 1 - KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="SALDO ATUAL"
                    value={currentBalance}
                    icon={<Wallet size={24} />}
                    color="slate"
                    subtitle="Soma das Contas"
                />
                <StatCard
                    title="RECEITAS"
                    value={realizedIncome}
                    icon={<TrendingUp size={24} />}
                    color="emerald"
                    subtitle="No período selecionado"
                    onClick={() => openDrilldown('Receitas Realizadas', t => t.type === 'income' && t.isPaid)}
                />
                <StatCard
                    title="DESPESAS"
                    value={realizedExpense}
                    icon={<TrendingDown size={24} />}
                    color="rose"
                    subtitle="No período selecionado"
                    onClick={() => openDrilldown('Despesas Realizadas', t => t.type === 'expense' && t.isPaid)}
                />
                <StatCard
                    title="RESULTADO"
                    value={realizedIncome - realizedExpense}
                    icon={<DollarSign size={24} />}
                    color={(realizedIncome - realizedExpense) >= 0 ? 'indigo' : 'amber'}
                    subtitle="Op. Realizadas"
                />
            </div>

            {/* BLOCO 2 - PREVISÃO */}
            {/* BLOCO 2 - PREVISÃO (SITUAÇÃO FINANCEIRA) */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertCircle size={16} /> Situação Financeira
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="VENCIDAS"
                        value={filteredData.filter(t => t.type === 'expense' && !t.isPaid && !t.creditCardId && isBefore(parseISO(t.date), todayStart)).reduce((s, t) => s + t.amount, 0)}
                        icon={<AlertCircle size={24} />}
                        color="rose"
                        onClick={() => openDrilldown('Contas Vencidas', t => t.type === 'expense' && !t.isPaid && !t.creditCardId && isBefore(parseISO(t.date), todayStart))}
                    />
                    <StatCard
                        title="A VENCER (7D)"
                        value={filteredData.filter(t => t.type === 'expense' && !t.isPaid && !t.creditCardId && !isBefore(parseISO(t.date), todayStart)).reduce((s, t) => s + t.amount, 0)}
                        icon={<Clock size={24} />}
                        color="amber"
                        onClick={() => openDrilldown('A Pagar (Futuro)', t => t.type === 'expense' && !t.isPaid && !t.creditCardId && !isBefore(parseISO(t.date), todayStart))}
                    />
                    <StatCard
                        title="A RECEBER VENCIDAS"
                        value={filteredData.filter(t => t.type === 'income' && !t.isPaid && isBefore(parseISO(t.date), todayStart)).reduce((s, t) => s + t.amount, 0)}
                        icon={<AlertCircle size={24} />}
                        color="rose"
                        onClick={() => openDrilldown('Receitas Vencidas', t => t.type === 'income' && !t.isPaid && isBefore(parseISO(t.date), todayStart))}
                    />
                    <StatCard
                        title="A RECEBER (7D)"
                        value={filteredData.filter(t => t.type === 'income' && !t.isPaid && !isBefore(parseISO(t.date), todayStart)).reduce((s, t) => s + t.amount, 0)}
                        icon={<Clock size={24} />}
                        color="indigo"
                        onClick={() => openDrilldown('A Receber (Futuro)', t => t.type === 'income' && !t.isPaid && !isBefore(parseISO(t.date), todayStart))}
                    />
                </div>
            </div>

            {/* BLOCO 3 - CARTÕES DE CRÉDITO */}
            {
                cards.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <CardIcon size={18} className="text-slate-400" /> Cartões de Crédito
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {cards.map(card => {
                                const invoice = getCardInvoice(card.id);
                                const available = card.limitAmount - invoice;
                                const percent = Math.min(100, (invoice / card.limitAmount) * 100);

                                return (
                                    <div key={card.id}
                                        onClick={() => openDrilldown(`Fatura: ${card.name}`, t => t.creditCardId === card.id && !t.isPaid)}
                                        className="bg-slate-800 border border-slate-700/50 p-5 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-700 rounded-lg text-slate-300">
                                                    <CardIcon size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white text-sm">{card.name}</h3>
                                                    <p className="text-xs text-slate-500">Limite: {fmt(card.limitAmount)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 uppercase">Fatura Atual</div>
                                                <div className="font-mono text-slate-200 font-bold">{fmt(invoice)}</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-rose-400">Usado: {Math.round(percent)}%</span>
                                                <span className="text-emerald-400">Disp: {fmt(available)}</span>
                                            </div>
                                            <ProgressBar progress={percent} />
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                                            <div className="flex items-center gap-1">
                                                <Calendar size={12} /> Fecha: {card.closingDay}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar size={12} /> Vence: {card.dueDay}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            }

            {/* BLOCO 4 - ÚLTIMOS LANÇAMENTOS */}
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Últimos Lançamentos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredData.slice(0, 9).map((t: any) => {
                        const isVirtual = t.isVirtual;
                        return (
                            <div key={t.id}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border",
                                    isVirtual ? "bg-indigo-500/10 border-indigo-500/30 cursor-pointer hover:bg-indigo-500/20" : "bg-slate-900/50 border-slate-700/50"
                                )}
                                onClick={() => isVirtual && openDrilldown(t.description, (item) => item.creditCardId === t.virtualChildren[0]?.creditCardId && item.type === 'expense' && !item.isPaid)}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <div className={cn("p-2 rounded-full shrink-0", t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400', isVirtual && "bg-indigo-500/10 text-indigo-400")}>
                                        {isVirtual ? <CardIcon size={16} /> : (t.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />)}
                                    </div>
                                    <div className="truncate">
                                        <div className="font-medium text-slate-200 truncate">{t.description}</div>
                                        <div className="text-xs text-slate-500">{t.date.split('T')[0].split('-').reverse().join('/')} {isVirtual && `(${t.virtualChildren?.length} itens)`}</div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end pl-2">
                                    <div className={cn("font-bold", t.type === 'income' ? 'text-emerald-400' : 'text-rose-400')}>
                                        {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                                    </div>
                                    {!isVirtual && (
                                        financeSettings.credit_card_expense_mode === 'competence' && t.creditCardId ? (
                                            <div className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-medium flex items-center gap-1 select-none" title="Item em fatura aberta (Consome Limite)">
                                                <CardIcon size={10} />
                                                <span>Fatura</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => handleToggleStatus(e, t)}
                                                className={cn(
                                                    "mt-1 p-1 rounded transition-colors",
                                                    t.isPaid ? "text-emerald-500" : "text-slate-500 hover:text-emerald-500"
                                                )}
                                                title={t.isPaid ? "Pago" : "Pendente"}
                                            >
                                                {t.isPaid ? <ThumbsUp size={14} className="fill-emerald-500/10" /> : <ThumbsDown size={14} />}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {filteredData.length === 0 && <p className="text-slate-500 text-sm col-span-full text-center py-4">Nenhum lançamento.</p>}
                </div>
            </div>

            {/* BLOCO 5 - EVOLUÇÃO */}
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <BarChart2 className="text-indigo-500" /> Evolução Financeira
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 uppercase font-bold">Comparar:</span>
                        <Select value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value as any)} className="w-[150px] py-1.5 text-xs bg-slate-900 border-slate-700">
                            <option value="month">Mês Atual vs Anterior</option>
                            <option value="semester">Últimos 6 Meses</option>
                            <option value="year">Anual</option>
                            <option value="custom">Personalizado</option>
                        </Select>
                        {comparisonMode === 'custom' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                <input
                                    type="date"
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                                    value={chartCustomRange.start}
                                    onChange={(e) => setChartCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                                <span className="text-slate-600">-</span>
                                <input
                                    type="date"
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                                    value={chartCustomRange.end}
                                    onChange={(e) => setChartCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <span className="text-sm text-slate-400 uppercase font-bold tracking-wide">Receitas (Realizadas)</span>
                            <div className="mt-2 text-2xl font-bold text-emerald-400">{fmt(currentComparisonData.reduce((acc, d) => acc + d.Receitas, 0))}</div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <span className="text-sm text-slate-400 uppercase font-bold tracking-wide">Despesas (Realizadas)</span>
                            <div className="mt-2 text-2xl font-bold text-rose-400">{fmt(currentComparisonData.reduce((acc, d) => acc + d.Despesas, 0))}</div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 h-[300px] w-full min-w-0">
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart data={currentComparisonData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} maxLength={3} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} formatter={(value: number) => fmt(value)} />
                                <Legend />
                                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <DrilldownModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} title={modalState.title} type="finance" data={modalState.data} />
            <TransactionModal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} onSuccess={loadData} accounts={accounts} categories={categories} cards={cards} contacts={contacts} />
        </div >
    );
};
