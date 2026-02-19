
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact } from '../../types';
import { Loader, Card, Badge, cn, Button } from '../../components/Shared';
import { FilterSelect } from '../../components/FilterSelect';
import { DrilldownModal, TransactionModal } from '../../components/Modals';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, DollarSign, ArrowRight, Filter, Plus, CreditCard as CardIcon, Calendar, ThumbsUp, ThumbsDown, BarChart2, FileText } from 'lucide-react';
import { FinancialReportModal } from '../../components/Reports/FinancialReportModal';
import { isBefore, startOfDay, endOfDay, addDays, isWithinInterval, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { parseDateLocal } from '../../utils/formatters';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useCompany } from '../../context/CompanyContext';



export const FinancialOverview: React.FC = () => {
    const { currentCompany } = useCompany();
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

    useEffect(() => {
        if (currentCompany) {
            loadData();
        }
    }, [currentCompany]);

    const loadData = async () => {
        if (!currentCompany) return;
        try {
            const [t, a, c, cc, cont, set] = await Promise.all([
                api.getFinancialTransactions(currentCompany.id),
                api.getFinancialAccounts(currentCompany.id),
                api.getFinancialCategories(currentCompany.id),
                api.getCreditCards(currentCompany.id),
                api.getContacts(currentCompany.id),
                api.getCompanySettings()
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
            await api.toggleTransactionStatus(t.id, newStatus); // API should handle security check, but we could pass companyId if needed, usually ID is enough
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
            const lastMonthStart = subMonths(now, 1);
            const lastMonthStartMonth = startOfMonth(lastMonthStart);
            const lastMonthEnd = endOfMonth(lastMonthStart);


            const calc = (start: Date, end: Date, type: 'income' | 'expense') =>
                transactions.filter(t => {
                    const matchesType = t.type === type && t.originType !== 'technical';
                    const isPaidCheck = t.isPaid || (!!t.creditCardId && isBefore(parseDateLocal(t.date), endOfDay(new Date()))); // Treat Card Purchases as Paid (Realized)

                    // Mode Logic:
                    if (mode === 'competence') {
                        // Competence: Include Purchases, Exclude Bill Payments
                        if (t.description.toLowerCase().includes('fatura')) return false;
                        return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start, end });
                    } else {
                        // Cash: Exclude Purchases, Include Bill Payments
                        if (t.creditCardId) return false;
                        return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start, end });
                    }
                }).reduce((s, t) => s + t.amount, 0);

            data.push({ name: 'Mês Anterior', Receitas: calc(lastMonthStartMonth, lastMonthEnd, 'income'), Despesas: calc(lastMonthStartMonth, lastMonthEnd, 'expense') });
            data.push({ name: 'Mês Atual', Receitas: calc(thisMonthStart, thisMonthEnd, 'income'), Despesas: calc(thisMonthStart, thisMonthEnd, 'expense') });

        } else if (comparisonMode === 'semester') {
            for (let i = 5; i >= 0; i--) {
                const date = subMonths(now, i);
                const start = startOfMonth(date);
                const end = endOfMonth(date);
                const calc = (type: 'income' | 'expense') =>
                    transactions.filter(t => {
                        const matchesType = t.type === type && t.originType !== 'technical';
                        const isPaidCheck = t.isPaid || !!t.creditCardId;

                        if (mode === 'competence') {
                            if (t.description.toLowerCase().includes('fatura')) return false;
                            return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start, end });
                        } else {
                            if (t.creditCardId) return false;
                            return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start, end });
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
                        const matchesType = t.type === type && t.originType !== 'technical';
                        const isPaidCheck = t.isPaid || !!t.creditCardId;

                        if (mode === 'competence') {
                            if (t.description.toLowerCase().includes('fatura')) return false;
                            return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start, end });
                        } else {
                            if (t.creditCardId) return false;
                            return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start, end });
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
                        const matchesType = t.type === type && t.originType !== 'technical';
                        const isPaidCheck = t.isPaid || !!t.creditCardId;

                        if (mode === 'competence') {
                            if (t.description.toLowerCase().includes('fatura')) return false;
                            return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start: monthStart, end: monthEnd });
                        } else {
                            if (t.creditCardId) return false;
                            return matchesType && isPaidCheck && isWithinInterval(parseDateLocal(t.date), { start: monthStart, end: monthEnd });
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        <DollarSign className="text-primary" size={32} /> Visão Geral
                        <span className="text-sm font-normal text-muted-foreground ml-2 hidden md:inline">| Financeiro</span>
                    </h1>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-secondary/50 border border-border hover:bg-secondary text-foreground gap-2"
                    >
                        <FileText size={18} className="text-primary" /> Relatórios
                    </Button>
                    <Button
                        className="px-6 gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-105"
                        onClick={() => setIsTransactionModalOpen(true)}
                    >
                        <Plus size={18} /> Novo Lançamento
                    </Button>
                </div>
            </div>




            {/* BLOCO 1 - RESUMO */}
            {/* BLOCO 1 - KPIS (HIERARQUIA: SALDO > FLUXO > RESULTADO) */}
            {/* COMPONENT AUXILIAR LOCAL */}
            {(() => {
                const FinanceStatCard = ({ title, value, icon, color, onClick, subtitle }: { title: string, value: string, icon: React.ReactNode, color: 'emerald' | 'rose' | 'amber' | 'slate' | 'blue', onClick?: () => void, subtitle?: string }) => {
                    const themes = {
                        emerald: { header: 'bg-emerald-500', text: 'text-emerald-500', border: 'hover:border-emerald-500/50' },
                        rose: { header: 'bg-rose-500', text: 'text-rose-500', border: 'hover:border-rose-500/50' },
                        amber: { header: 'bg-amber-500', text: 'text-amber-500', border: 'hover:border-amber-500/50' },
                        slate: { header: 'bg-slate-500', text: 'text-slate-500', border: 'hover:border-slate-500/50' },
                        blue: { header: 'bg-blue-500', text: 'text-blue-500', border: 'hover:border-blue-500/50' },
                    };
                    const theme = themes[color];

                    return (
                        <div
                            onClick={onClick}
                            className={cn(
                                "bg-card border border-border rounded-xl flex flex-col justify-between cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group shadow-sm",
                                theme.border
                            )}
                        >
                            {/* Header Colorido */}
                            <div className={cn("px-4 py-3 flex items-center justify-between", theme.header)}>
                                <span className="text-[11px] font-bold uppercase tracking-widest text-white">{title}</span>
                                <div className="p-1.5 rounded-md bg-white/20 text-white backdrop-blur-sm">
                                    {icon}
                                </div>
                            </div>
                            {/* Content */}
                            <div className="p-6 pt-5 flex flex-col gap-1">
                                <div className={cn("text-3xl font-black tracking-tighter transition-colors", theme.text)}>
                                    {value}
                                </div>
                                {subtitle && <span className="text-[10px] uppercase font-bold text-muted-foreground opacity-70">{subtitle}</span>}
                            </div>
                        </div>
                    );
                };

                return (
                    <>
                        {/* BLOCO 1 - RESUMO */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
                            {/* SALDO - PROTAGONISTA (Mantido layout especial mas alinhado) */}
                            <div className="lg:col-span-4 bg-card border border-border p-0 rounded-xl flex flex-col justify-between relative overflow-hidden group shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                <div className="bg-slate-900 dark:bg-slate-800 p-6 flex justify-between items-start border-b border-white/5">
                                    <div>
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo Atual</span>
                                        <div className="mt-2 text-4xl xl:text-5xl font-black text-white tracking-tighter">
                                            {fmt(currentBalance)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <Wallet size={32} className="text-emerald-400" />
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-950/30 flex-1 flex items-center">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span>Consolidado de todas as contas</span>
                                    </div>
                                </div>
                            </div>


                            {/* FLUXO - SECUNDÁRIO */}
                            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <FinanceStatCard
                                    title="Receitas"
                                    value={fmt(realizedIncome)}
                                    icon={<TrendingUp size={18} />}
                                    color="emerald"
                                    subtitle="Realizadas este mês"
                                    onClick={() => openDrilldown('Receitas Realizadas', t => t.type === 'income' && t.isPaid)}
                                />

                                <FinanceStatCard
                                    title="Despesas"
                                    value={fmt(realizedExpense)}
                                    icon={<TrendingDown size={18} />}
                                    color="rose"
                                    subtitle="Realizadas este mês"
                                    onClick={() => openDrilldown('Despesas Realizadas', t => t.type === 'expense' && t.isPaid)}
                                />

                                <FinanceStatCard
                                    title="Resultado"
                                    value={fmt(realizedIncome - realizedExpense)}
                                    icon={<DollarSign size={18} />}
                                    color={(realizedIncome - realizedExpense) >= 0 ? 'emerald' : 'rose'}
                                    subtitle="Balanço do Período"
                                />
                            </div>
                        </div>

                        {/* BLOCO 2 - RISCO (ATRASADOS vs FUTUROS) */}
                        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-5 pl-1">
                                <div className="h-px bg-border flex-1"></div>
                                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={14} /> Fluxo de Caixa Previsto
                                </h2>
                                <div className="h-px bg-border flex-1"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* PAYABLES OVERDUE - ALARM */}
                                <FinanceStatCard
                                    title="Contas Atrasadas"
                                    value={fmt(payablesOverdue)}
                                    icon={<AlertCircle size={18} />}
                                    color="rose"
                                    subtitle="Pagamentos Vencidos"
                                    onClick={() => openDrilldown('Pagamentos em Atraso', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && isBefore(parseDateLocal(t.date), todayStart), true)}
                                />

                                {/* PAYABLES FUTURE */}
                                <FinanceStatCard
                                    title="A Vencer (7 dias)"
                                    value={fmt(payablesFuture)}
                                    icon={<Clock size={18} />}
                                    color="amber"
                                    subtitle="Próximos Pagamentos"
                                    onClick={() => openDrilldown('Pagamentos a Vencer', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && !isBefore(parseDateLocal(t.date), todayStart), true)}
                                />

                                {/* RECEIVABLES OVERDUE - ALARM */}
                                <FinanceStatCard
                                    title="Recebimentos Atrasados"
                                    value={fmt(receivablesOverdue)}
                                    icon={<AlertCircle size={18} />}
                                    color="rose"
                                    subtitle="Clientes Inadimplentes"
                                    onClick={() => openDrilldown('Recebimentos em Atraso', t => t.type === 'income' && !t.isPaid && isBefore(parseDateLocal(t.date), todayStart))}
                                />

                                {/* RECEIVABLES FUTURE */}
                                <FinanceStatCard
                                    title="A Receber (7 dias)"
                                    value={fmt(receivablesFuture)}
                                    icon={<Clock size={18} />}
                                    color="emerald"
                                    subtitle="Próximas Entradas"
                                    onClick={() => openDrilldown('Recebimentos a Vencer', t => t.type === 'income' && !t.isPaid && !isBefore(parseDateLocal(t.date), todayStart))}
                                />
                            </div>
                        </div>
                    </>
                );
            })()}

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
                                        className="bg-card border border-border shadow-sm p-5 rounded-xl cursor-pointer hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-6 bg-gradient-to-br from-slate-700 to-slate-900 rounded-md shadow-inner flex items-center justify-center">
                                                    <div className="w-6 h-3 bg-white/10 rounded-sm"></div>
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-foreground">{card.name}</h3>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={cn("text-xs uppercase font-bold tracking-wider", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                                                    {isOverdue ? "Total em Aberto" : "Fatura Atual"}
                                                </div>
                                                <div className={cn("text-xl font-bold tracking-tight", isOverdue ? "text-destructive" : "text-foreground")}>
                                                    {fmt(totalOpenAmount)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative h-2 bg-secondary rounded-full overflow-hidden mb-2">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500"
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>

                                        <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide">
                                            <span className="text-muted-foreground">Usado: {Math.round(percent)}%</span>
                                            <span className="text-primary">Disponível: {fmt(available)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            }



            {/* BLOCO 5 - EVOLUÇÃO */}
            <div className="bg-card border border-border shadow-sm rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <h3 className="font-bold text-muted-foreground uppercase tracking-widest text-xs flex items-center gap-2">
                        <BarChart2 size={16} /> Evolução Financeira
                    </h3>
                    <div className="flex items-center gap-2">
                        <FilterSelect
                            value={comparisonMode}
                            onChange={(val) => setComparisonMode(val as any)}
                            options={[
                                { value: 'month', label: 'Mês Atual vs Anterior' },
                                { value: 'semester', label: 'Últimos 6 Meses' },
                                { value: 'year', label: 'Anual' },
                                { value: 'custom', label: 'Personalizado' }
                            ]}
                            className="w-[200px]"
                        />
                        {comparisonMode === 'custom' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 ml-2">
                                <input
                                    type="date"
                                    className="bg-transparent text-xs text-foreground outline-none w-24 border-b border-border focus:border-primary transition-colors"
                                    value={chartCustomRange.start}
                                    onChange={(e) => setChartCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                                <span className="text-muted-foreground">-</span>
                                <input
                                    type="date"
                                    className="bg-transparent text-xs text-foreground outline-none w-24 border-b border-border focus:border-primary transition-colors"
                                    value={chartCustomRange.end}
                                    onChange={(e) => setChartCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    <div className="lg:col-span-1 space-y-4">
                        {(() => {
                            const getData = (type: 'Receitas' | 'Despesas') => {
                                let current = 0;
                                let previous = 0;

                                if (comparisonMode === 'month') {
                                    // Main: Current Month, Previous: Last Month
                                    current = currentComparisonData.find(d => d.name === 'Mês Atual')?.[type] || 0;
                                    previous = currentComparisonData.find(d => d.name === 'Mês Anterior')?.[type] || 0;
                                } else {
                                    // Main: Sum of visible period
                                    current = currentComparisonData.reduce((acc, d) => acc + d[type], 0);

                                    // Previous: Calculated based on period ranges
                                    if (comparisonMode !== 'custom') {
                                        const now = new Date();
                                        const mode = financeSettings.credit_card_expense_mode || 'competence';
                                        let rangeStart: Date, rangeEnd: Date;

                                        if (comparisonMode === 'semester') {
                                            rangeStart = startOfMonth(subMonths(now, 11));
                                            rangeEnd = endOfMonth(subMonths(now, 6));
                                        } else { // year
                                            rangeStart = startOfMonth(subMonths(now, 23));
                                            rangeEnd = endOfMonth(subMonths(now, 12));
                                        }

                                        const tType = type === 'Receitas' ? 'income' : 'expense';
                                        // Treat Card Purchases as Paid (or Realized) for comparison ONLY if they are in the past/today
                                        const isPaidCheck = (t: FinancialTransaction) => t.isPaid || (!!t.creditCardId && isBefore(parseDateLocal(t.date), endOfDay(new Date())));

                                        previous = transactions.filter(t => {
                                            const matchesType = t.type === tType && t.originType !== 'technical';

                                            if (mode === 'competence') {
                                                if (t.description.toLowerCase().includes('fatura')) return false;
                                                return matchesType && isPaidCheck(t) && isWithinInterval(parseDateLocal(t.date), { start: rangeStart, end: rangeEnd });
                                            } else {
                                                if (t.creditCardId) return false;
                                                return matchesType && isPaidCheck(t) && isWithinInterval(parseDateLocal(t.date), { start: rangeStart, end: rangeEnd });
                                            }
                                        }).reduce((s, t) => s + t.amount, 0);
                                    }
                                }
                                return { current, previous };
                            };

                            const revenue = getData('Receitas');
                            const expense = getData('Despesas');

                            return (
                                <>
                                    <div className="p-5 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5">
                                        <span className="text-xs text-emerald-500/70 font-bold uppercase tracking-widest">Receitas {comparisonMode === 'month' ? '(Mês Atual)' : '(Totais)'}</span>
                                        <div className="mt-2 text-3xl font-bold text-emerald-400 tracking-tighter">{fmt(revenue.current)}</div>
                                        {comparisonMode !== 'custom' && (
                                            <div className="mt-1 flex items-center gap-1.5 opacity-60">
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                                                    Anterior: {fmt(revenue.previous)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 rounded-xl border border-dashed border-rose-500/20 bg-rose-500/5">
                                        <span className="text-xs text-rose-500/70 font-bold uppercase tracking-widest">Despesas {comparisonMode === 'month' ? '(Mês Atual)' : '(Totais)'}</span>
                                        <div className="mt-2 text-3xl font-bold text-rose-400 tracking-tighter">{fmt(expense.current)}</div>
                                        {comparisonMode !== 'custom' && (
                                            <div className="mt-1 flex items-center gap-1.5 opacity-60">
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-rose-300">
                                                    Anterior: {fmt(expense.previous)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
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
                                <Bar dataKey="Receitas" fill="#1BBF84" radius={[2, 2, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Despesas" fill="#EF4444" radius={[2, 2, 0, 0]} maxBarSize={40} />
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
                financeSettings={financeSettings}
            />
        </div >
    );
};
