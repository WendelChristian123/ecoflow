
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact } from '../../types';
import { Loader, Card, Badge, cn, Button, Select } from '../../components/Shared';
import { DrilldownModal, TransactionModal } from '../../components/Modals';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, DollarSign, ArrowRight, Filter, Plus, CreditCard as CardIcon, Calendar, ThumbsUp, ThumbsDown, BarChart2, FileText } from 'lucide-react';
import { FinancialReportModal } from '../../components/Reports/FinancialReportModal';
import { isBefore, startOfDay, endOfDay, addDays, isWithinInterval, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { parseDateLocal } from '../../utils/formatters';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';



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
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

    const useMemoResult = useMemo(() => {
        const mode = financeSettings.credit_card_expense_mode || 'competence';
        let processedData = processTransactions(transactions, cards, mode);

        // Force CASH mode for Forecast/Payables widgets (to see Virtual Invoices/Bills)
        let processedCashData = processTransactions(transactions, cards, 'cash');

        let filtered = processedData;
        let filteredCash = processedCashData;

        const now = new Date();
        const todayStart = startOfDay(now);

        // 0. Mandatory Technical Filter & Base Filters
        const applyBaseFilters = (data: typeof processedData) => {
            return data.filter(t =>
                t.originType !== 'technical' &&
                !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                !t.description.includes('Entrada Técnica')
            );
        }

        filtered = applyBaseFilters(filtered);
        filteredCash = applyBaseFilters(filteredCash);

        const applyDynamicFilters = (data: typeof processedData) => {
            let res = data;
            if (filters.period === 'today') {
                res = res.filter(t => t.date === now.toISOString().split('T')[0]);
            } else if (filters.period === 'last7') {
                const last7 = addDays(now, -7);
                res = res.filter(t => isWithinInterval(parseDateLocal(t.date), { start: last7, end: now }));
            } else if (filters.period === 'month') {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                res = res.filter(t => isWithinInterval(parseDateLocal(t.date), { start: firstDay, end: lastDay }));
            } else if (filters.period === 'custom' && customDateRange.start && customDateRange.end) {
                res = res.filter(t => isWithinInterval(parseDateLocal(t.date), {
                    start: parseDateLocal(customDateRange.start),
                    end: endOfDay(parseDateLocal(customDateRange.end))
                }));
            }

            if (filters.accountId !== 'all') {
                res = res.filter(t => t.accountId === filters.accountId || t.creditCardId === filters.accountId);
            }

            if (filters.categoryId !== 'all') {
                res = res.filter(t => t.categoryId === filters.categoryId);
            }

            if (filters.type !== 'all') {
                res = res.filter(t => t.type === filters.type);
            }

            // Note: Status filter applied later if needed or here?
            // Existing code applied Status filter here.
            if (filters.status === 'overdue') {
                res = res.filter(t => !t.isPaid && isBefore(parseDateLocal(t.date), todayStart));
            } else if (filters.status === 'pending') {
                res = res.filter(t => !t.isPaid && !isBefore(parseDateLocal(t.date), todayStart));
            } else if (filters.status === 'paid') {
                res = res.filter(t => t.isPaid);
            }
            return res;
        };

        filtered = applyDynamicFilters(filtered);
        filteredCash = applyDynamicFilters(filteredCash);

        return { filtered, filteredCash, rawCash: processedCashData };
    }, [transactions, cards, financeSettings, filters, customDateRange]);

    const { filtered: filteredData, filteredCash: filteredCashData } = useMemoResult;

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


    const todayStart = startOfDay(new Date());

    // STAGE 2: WIDGET LOGIC - ENFORCE USER RULES
    // 1. P&L (Receitas/Despesas) -> ONLY PAID (Realized) in the current period (This Month)
    // "Quero que apareça apenas os numeros que de fato foram pagos"
    // We use filteredData (which is This Month by default)
    const realizedData = filteredData.filter(t => t.isPaid);
    const realizedIncome = realizedData.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const realizedExpense = realizedData.filter(t => t.type === 'expense' && !t.description.toLowerCase().includes('fatura')).reduce((acc, t) => acc + t.amount, 0);

    // 2. Forecast (Fluxo de Caixa) -> ONLY OVERDUE and NEXT 7 DAYS
    // "no fluxo de caixa deixa só os atrasados e o que vai vencer nos proximos 7 d"
    // We MUST use rawCash (Global) because "Overdue" can be from last month, and "Next 7 Days" might cross month boundary.
    const { rawCash } = useMemoResult; // Destructure from result

    // Helper for 7 days limit
    const next7DaysEnd = addDays(todayStart, 7);

    const payablesData = rawCash.filter(t => !t.creditCardId && t.type === 'expense' && !t.isPaid);
    const receivablesData = rawCash.filter(t => t.type === 'income' && !t.isPaid);

    const payablesOverdue = payablesData.filter(t => isBefore(parseDateLocal(t.date), todayStart)).reduce((s, t) => s + t.amount, 0);
    const payablesFuture = payablesData.filter(t => {
        const d = parseDateLocal(t.date);
        return !isBefore(d, todayStart) && isBefore(d, next7DaysEnd); // Next 7 Days Inclusive range logic? usually [today, today+7)
    }).reduce((s, t) => s + t.amount, 0);

    const receivablesOverdue = receivablesData.filter(t => isBefore(parseDateLocal(t.date), todayStart)).reduce((s, t) => s + t.amount, 0);
    const receivablesFuture = receivablesData.filter(t => {
        const d = parseDateLocal(t.date);
        return !isBefore(d, todayStart) && isBefore(d, next7DaysEnd);
    }).reduce((s, t) => s + t.amount, 0);

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

    const openDrilldown = (title: string, filterFn: (t: FinancialTransaction) => boolean, useCashData = false) => {
        const sourceData = useCashData ? filteredCashData : filteredData;
        const data = sourceData.filter(filterFn);
        setModalState({ isOpen: true, title, data });
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const getComparisonData = () => {
        const now = new Date();
        const data = [];
        const mode = financeSettings.credit_card_expense_mode || 'competence';

        if (comparisonMode === 'month') {
            const thisMonthStart = startOfMonth(now);
            const thisMonthEnd = endOfMonth(now);
            const lastMonthStart = startOfMonth(subMonths(now, 1));
            const lastMonthEnd = endOfMonth(subMonths(now, 1));

            const calc = (start: Date, end: Date, type: 'income' | 'expense') =>
                transactions.filter(t => {
                    const matchesType = t.type === type && t.isPaid && t.originType !== 'technical';

                    // Mode Logic:
                    if (mode === 'competence') {
                        // Competence: Include Purchases, Exclude Bill Payments (to avoid double count)
                        if (t.description.toLowerCase().includes('pagamento fatura')) return false;
                        return matchesType && isWithinInterval(parseDateLocal(t.date), { start, end });
                    } else {
                        // Cash: Exclude Purchases (they are paid via Bill), Include Bill Payments
                        // If it has creditCardId, it's a purchase -> Hide
                        if (t.creditCardId) return false;
                        return matchesType && isWithinInterval(parseDateLocal(t.date), { start, end });
                    }
                }).reduce((s, t) => s + t.amount, 0);

            data.push({ name: 'Mês Anterior', Receitas: calc(lastMonthStart, lastMonthEnd, 'income'), Despesas: calc(lastMonthStart, lastMonthEnd, 'expense') });
            data.push({ name: 'Mês Atual', Receitas: calc(thisMonthStart, thisMonthEnd, 'income'), Despesas: calc(thisMonthStart, thisMonthEnd, 'expense') });

        } else if (comparisonMode === 'semester') {
            for (let i = 5; i >= 0; i--) {
                const date = subMonths(now, i);
                const start = startOfMonth(date);
                const end = endOfMonth(date);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t => {
                        const matchesType = t.type === type && t.isPaid && t.originType !== 'technical';
                        if (mode === 'competence') {
                            if (t.description.toLowerCase().includes('pagamento fatura')) return false;
                            return matchesType && isWithinInterval(parseDateLocal(t.date), { start, end });
                        } else {
                            if (t.creditCardId) return false;
                            return matchesType && isWithinInterval(parseDateLocal(t.date), { start, end });
                        }
                    }).reduce((s, t) => s + t.amount, 0);

                const label = `${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`;
                data.push({ name: label, Receitas: calc('income'), Despesas: calc('expense') });
            }
        } else if (comparisonMode === 'year') {
            for (let i = 11; i >= 0; i--) {
                const date = subMonths(now, i);
                const start = startOfMonth(date);
                const end = endOfMonth(date);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t => {
                        const matchesType = t.type === type && t.isPaid && t.originType !== 'technical';
                        if (mode === 'competence') {
                            if (t.description.toLowerCase().includes('pagamento fatura')) return false;
                            return matchesType && isWithinInterval(parseDateLocal(t.date), { start, end });
                        } else {
                            if (t.creditCardId) return false;
                            return matchesType && isWithinInterval(parseDateLocal(t.date), { start, end });
                        }
                    }).reduce((s, t) => s + t.amount, 0);

                const label = `${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`;
                data.push({ name: label, Receitas: calc('income'), Despesas: calc('expense') });
            }
        } else if (comparisonMode === 'custom' && chartCustomRange.start && chartCustomRange.end) {
            const start = startOfMonth(parseDateLocal(chartCustomRange.start));
            const end = endOfMonth(parseDateLocal(chartCustomRange.end));
            // Iterate months from start to end
            let current = start;
            while (current <= end) {
                const monthStart = startOfMonth(current);
                const monthEnd = endOfMonth(current);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t => {
                        const matchesType = t.type === type && t.isPaid && t.originType !== 'technical';
                        if (mode === 'competence') {
                            if (t.description.toLowerCase().includes('pagamento fatura')) return false;
                            return matchesType && isWithinInterval(parseDateLocal(t.date), { start: monthStart, end: monthEnd });
                        } else {
                            if (t.creditCardId) return false;
                            return matchesType && isWithinInterval(parseDateLocal(t.date), { start: monthStart, end: monthEnd });
                        }
                    }).reduce((s, t) => s + t.amount, 0);

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

                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 gap-2"
                    >
                        <FileText size={18} className="text-indigo-400" /> Relatórios
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                        onClick={() => setIsTransactionModalOpen(true)}
                    >
                        <Plus size={18} /> Novo Lançamento
                    </Button>
                </div>
            </div>




            {/* BLOCO 1 - RESUMO */}
            {/* BLOCO 1 - KPIS (HIERARQUIA: SALDO > FLUXO > RESULTADO) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
                {/* SALDO - PROTAGONISTA */}
                <div className="lg:col-span-4 bg-[#0B0D12] border border-slate-800/40 p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet size={80} className="text-emerald-500" />
                    </div>
                    <div>
                        <span className="text-slate-400 text-sm font-medium uppercase tracking-wide opacity-80">Saldo Atual</span>
                        <div className="mt-4 text-4xl xl:text-5xl font-bold text-white tracking-tighter">
                            {fmt(currentBalance)}
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span>Soma de todas as contas</span>
                    </div>
                </div>

                {/* FLUXO - SECUNDÁRIO */}
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div
                        className="bg-[#0B0D12] border border-slate-800/40 p-6 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all group"
                        onClick={() => openDrilldown('Receitas Realizadas', t => t.type === 'income' && t.isPaid)}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-500 group-hover:bg-emerald-500/10 transition-colors">
                                <TrendingUp size={18} />
                            </div>
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Receitas</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-200 group-hover:text-emerald-400 transition-colors tracking-tight">
                            {fmt(realizedIncome)}
                        </div>
                    </div>

                    <div
                        className="bg-[#0B0D12] border border-slate-800/40 p-6 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-rose-500/5 hover:border-rose-500/20 transition-all group"
                        onClick={() => openDrilldown('Despesas Realizadas', t => t.type === 'expense' && t.isPaid)}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-rose-500/5 text-rose-500 group-hover:bg-rose-500/10 transition-colors">
                                <TrendingDown size={18} />
                            </div>
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Despesas</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-200 group-hover:text-rose-400 transition-colors tracking-tight">
                            {fmt(realizedExpense)}
                        </div>
                    </div>

                    <div className="bg-[#0B0D12] border border-slate-800/40 p-6 rounded-2xl flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={cn("p-2 rounded-lg bg-slate-800/50 transition-colors", (realizedIncome - realizedExpense) >= 0 ? "text-indigo-400" : "text-amber-400")}>
                                <DollarSign size={18} />
                            </div>
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Resultado</span>
                        </div>
                        <div className={cn("text-2xl font-bold tracking-tight transition-colors", (realizedIncome - realizedExpense) >= 0 ? "text-indigo-300" : "text-amber-300")}>
                            {fmt(realizedIncome - realizedExpense)}
                        </div>
                    </div>
                </div>
            </div>

            {/* BLOCO 2 - RISCO (ATRASADOS vs FUTUROS) */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-4 pl-1">
                    <div className="h-px bg-slate-800 flex-1"></div>
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={14} /> Fluxo de Caixa Previsto
                    </h2>
                    <div className="h-px bg-slate-800 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* PAYABLES OVERDUE - ALARM */}
                    <div
                        className="bg-[#0B0D12] border border-rose-900/30 p-5 rounded-xl cursor-pointer hover:bg-rose-900/10 transition-all group relative overflow-hidden"
                        onClick={() => openDrilldown('Pagamentos em Atraso', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && isBefore(parseDateLocal(t.date), todayStart), true)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-50"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-rose-400/80 text-[10px] font-bold uppercase tracking-wider">Pagamentos em Atraso</span>
                                <AlertCircle size={16} className="text-rose-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-rose-400 group-hover:text-rose-300 transition-colors">
                                    {fmt(payablesOverdue)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PAYABLES FUTURE - QUIET */}
                    <div
                        className="bg-[#0B0D12] border border-slate-800/40 p-5 rounded-xl cursor-pointer hover:bg-slate-800/60 transition-all group flex flex-col justify-between"
                        onClick={() => openDrilldown('Pagamentos a Vencer', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && !isBefore(parseDateLocal(t.date), todayStart), true)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pagamentos a Vencer (7d)</span>
                            <Clock size={16} className="text-slate-600 group-hover:text-amber-500 transition-colors" />
                        </div>
                        <div className="text-2xl font-bold text-slate-300 group-hover:text-amber-400 transition-colors">
                            {fmt(payablesFuture)}
                        </div>
                    </div>

                    {/* RECEIVABLES OVERDUE - ALARM */}
                    <div
                        className="bg-[#0B0D12] border border-rose-900/30 p-5 rounded-xl cursor-pointer hover:bg-rose-900/10 transition-all group relative overflow-hidden"
                        onClick={() => openDrilldown('Recebimentos em Atraso', t => t.type === 'income' && !t.isPaid && isBefore(parseDateLocal(t.date), todayStart))}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-50"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-rose-400/80 text-[10px] font-bold uppercase tracking-wider">Recebimentos em Atraso</span>
                                <AlertCircle size={16} className="text-rose-500" />
                            </div>
                            <div className="text-2xl font-bold text-rose-400 group-hover:text-rose-300 transition-colors">
                                {fmt(receivablesOverdue)}
                            </div>
                        </div>
                    </div>

                    {/* RECEIVABLES FUTURE - QUIET */}
                    <div
                        className="bg-[#0B0D12] border border-slate-800/40 p-5 rounded-xl cursor-pointer hover:bg-slate-800/60 transition-all group flex flex-col justify-between"
                        onClick={() => openDrilldown('Recebimentos a Vencer', t => t.type === 'income' && !t.isPaid && !isBefore(parseDateLocal(t.date), todayStart))}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Recebimentos a Vencer (7d)</span>
                            <Clock size={16} className="text-slate-600 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <div className="text-2xl font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">
                            {fmt(receivablesFuture)}
                        </div>
                    </div>
                </div>
            </div>

            {/* BLOCO 3 - CARTÕES DE CRÉDITO */}
            {
                cards.length > 0 && (
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-4 pl-1">
                            <div className="h-px bg-slate-800 flex-1"></div>
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <CardIcon size={14} /> Cartões de Crédito
                            </h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {cards.map(card => {
                                // 1. Calculate Total Used (All unpaid expenses) for Limit / Available calculation
                                // Calculate Total Used based on Balance (Debits - Credits)
                                const totalUsed = transactions.reduce((acc, t) => {
                                    // Debits (Increase usage)
                                    if (t.creditCardId === card.id) {
                                        if (t.type === 'expense') return acc + t.amount;
                                        if (t.type === 'transfer') return acc + t.amount; // Transfer Out
                                    }
                                    // Credits (Decrease usage)
                                    if (t.creditCardId === card.id && t.type === 'income') return acc - t.amount;
                                    if (t.toAccountId === card.id && t.type === 'transfer') return acc - t.amount; // Transfer In

                                    return acc;
                                }, 0);

                                const available = card.limitAmount - totalUsed;
                                const percent = Math.min(100, (totalUsed / card.limitAmount) * 100);

                                // 2. Calculate "Current Invoice" Amount for Display (matching Cards.tsx logic)
                                const processed = processTransactions(transactions, [card], 'cash');
                                const virtualInvoices = processed.filter(t =>
                                    (t as ProcessedTransaction).isVirtual &&
                                    t.id.startsWith(`virtual-invoice-${card.id}`)
                                ) as ProcessedTransaction[];

                                // Find Overdue Invoices
                                const today = startOfDay(new Date());
                                const overdueInvoices = virtualInvoices.filter(inv => {
                                    const dueDate = parseDateLocal(inv.date);
                                    return isBefore(dueDate, today) && !inv.isPaid;
                                });
                                const overdueSum = overdueInvoices.reduce((acc, inv) => acc + inv.amount, 0);

                                // Find Current Invoice (Today or Future)
                                const currentInvoice = virtualInvoices.sort((a, b) => parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime())
                                    .find(inv => !isBefore(parseDateLocal(inv.date), today));

                                // If Jan has no expenses, currentInvoice might be null.
                                // In that case, 0 is correct.
                                const currentInvoiceAmount = currentInvoice ? currentInvoice.amount : 0;
                                const totalOpenAmount = overdueSum + currentInvoiceAmount;
                                const isOverdue = overdueSum > 0;

                                return (
                                    <div key={card.id}
                                        onClick={() => openDrilldown(`Fatura: ${card.name}`, t => t.creditCardId === card.id && !t.isPaid)}
                                        className="bg-[#0B0D12] border border-slate-800/40 p-5 rounded-xl cursor-pointer hover:bg-slate-800/30 transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md shadow-inner flex items-center justify-center">
                                                    <div className="w-6 h-3 bg-white/20 rounded-sm"></div>
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-200">{card.name}</h3>
                                                    <div className="text-[10px] text-slate-500">
                                                        Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={cn("text-xs uppercase font-bold tracking-wider", isOverdue ? "text-rose-500" : "text-slate-500")}>
                                                    {isOverdue ? "Total em Aberto" : "Fatura Atual"}
                                                </div>
                                                <div className={cn("text-xl font-bold tracking-tight", isOverdue ? "text-rose-400" : "text-white")}>
                                                    {fmt(totalOpenAmount)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>

                                        <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide">
                                            <span className="text-indigo-400">Usado: {Math.round(percent)}%</span>
                                            <span className="text-emerald-500">Disponível: {fmt(available)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            }



            {/* BLOCO 5 - EVOLUÇÃO */}
            <div className="bg-[#0B0D12] border border-slate-800/40 rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2">
                        <BarChart2 size={16} /> Evolução Financeira
                    </h3>
                    <div className="flex items-center gap-2">
                        <Select value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value as any)} className="w-[160px] py-1 text-xs bg-slate-900 border-slate-700/50 rounded-lg text-slate-400 focus:text-white focus:border-slate-600">
                            <option value="month">Mês Atual vs Anterior</option>
                            <option value="semester">Últimos 6 Meses</option>
                            <option value="year">Anual</option>
                            <option value="custom">Personalizado</option>
                        </Select>
                        {comparisonMode === 'custom' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 ml-2">
                                <input
                                    type="date"
                                    className="bg-transparent text-xs text-slate-400 outline-none w-24 border-b border-slate-800 focus:border-emerald-500 transition-colors"
                                    value={chartCustomRange.start}
                                    onChange={(e) => setChartCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                                <span className="text-slate-700">-</span>
                                <input
                                    type="date"
                                    className="bg-transparent text-xs text-slate-400 outline-none w-24 border-b border-slate-800 focus:border-emerald-500 transition-colors"
                                    value={chartCustomRange.end}
                                    onChange={(e) => setChartCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="p-5 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5">
                            <span className="text-xs text-emerald-500/70 font-bold uppercase tracking-widest">Receitas (Totais)</span>
                            <div className="mt-2 text-3xl font-bold text-emerald-400 tracking-tighter">{fmt(currentComparisonData.reduce((acc, d) => acc + d.Receitas, 0))}</div>
                            {(() => {
                                const currentTotal = currentComparisonData.reduce((acc, d) => acc + d.Receitas, 0);
                                let previousTotal = 0;
                                const now = new Date();

                                const calcPrevious = (start: Date, end: Date) =>
                                    transactions.filter(t =>
                                        t.type === 'income' &&
                                        t.isPaid &&
                                        t.originType !== 'technical' &&
                                        !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                                        isWithinInterval(parseISO(t.date), { start, end })
                                    ).reduce((s, t) => s + t.amount, 0);

                                if (comparisonMode === 'month') {
                                    const rangeStart = startOfMonth(subMonths(now, 3));
                                    const rangeEnd = endOfMonth(subMonths(now, 2));
                                    previousTotal = calcPrevious(rangeStart, rangeEnd);
                                } else if (comparisonMode === 'semester') {
                                    const rangeStart = startOfMonth(subMonths(now, 11));
                                    const rangeEnd = endOfMonth(subMonths(now, 6));
                                    previousTotal = calcPrevious(rangeStart, rangeEnd);
                                } else if (comparisonMode === 'year') {
                                    const rangeStart = startOfMonth(subMonths(now, 23));
                                    const rangeEnd = endOfMonth(subMonths(now, 12));
                                    previousTotal = calcPrevious(rangeStart, rangeEnd);
                                }

                                if (comparisonMode !== 'custom') {
                                    return (
                                        <div className="mt-1 flex items-center gap-1.5 opacity-60">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                                                Anterior: {fmt(previousTotal)}
                                            </span>
                                        </div>
                                    )
                                }
                                return null;
                            })()}
                        </div>
                        <div className="p-5 rounded-xl border border-dashed border-rose-500/20 bg-rose-500/5">
                            <span className="text-xs text-rose-500/70 font-bold uppercase tracking-widest">Despesas (Totais)</span>
                            <div className="mt-2 text-3xl font-bold text-rose-400 tracking-tighter">{fmt(currentComparisonData.reduce((acc, d) => acc + d.Despesas, 0))}</div>
                            {(() => {
                                const currentTotal = currentComparisonData.reduce((acc, d) => acc + d.Despesas, 0);
                                let previousTotal = 0;
                                const now = new Date();

                                const calcPrevious = (start: Date, end: Date) =>
                                    transactions.filter(t =>
                                        t.type === 'expense' &&
                                        t.isPaid &&
                                        t.originType !== 'technical' &&
                                        !t.description.includes('Pagamento Fatura (Crédito Local)') &&
                                        isWithinInterval(parseISO(t.date), { start, end })
                                    ).reduce((s, t) => s + t.amount, 0);

                                if (comparisonMode === 'month') {
                                    const rangeStart = startOfMonth(subMonths(now, 3));
                                    const rangeEnd = endOfMonth(subMonths(now, 2));
                                    previousTotal = calcPrevious(rangeStart, rangeEnd);
                                } else if (comparisonMode === 'semester') {
                                    const rangeStart = startOfMonth(subMonths(now, 11));
                                    const rangeEnd = endOfMonth(subMonths(now, 6));
                                    previousTotal = calcPrevious(rangeStart, rangeEnd);
                                } else if (comparisonMode === 'year') {
                                    const rangeStart = startOfMonth(subMonths(now, 23));
                                    const rangeEnd = endOfMonth(subMonths(now, 12));
                                    previousTotal = calcPrevious(rangeStart, rangeEnd);
                                }

                                if (comparisonMode !== 'custom') {
                                    return (
                                        <div className="mt-1 flex items-center gap-1.5 opacity-60">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-rose-300">
                                                Anterior: {fmt(previousTotal)}
                                            </span>
                                        </div>
                                    )
                                }
                                return null;
                            })()}
                        </div>
                    </div>

                    <div className="lg:col-span-2 h-[250px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={currentComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `R$${val / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ padding: 0 }}
                                    formatter={(value: number) => fmt(value)}
                                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                />
                                <Bar dataKey="Receitas" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Despesas" fill="#f43f5e" radius={[2, 2, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <DrilldownModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} title={modalState.title} type="finance" data={modalState.data} />
            <TransactionModal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} onSuccess={loadData} accounts={accounts} categories={categories} cards={cards} contacts={contacts} />

            <FinancialReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                transactions={transactions}
                accounts={accounts}
                categories={categories}
                cards={cards}
                contacts={contacts}
            />
        </div >
    );
};
