
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact } from '../../types';
import { Loader, Card, Badge, cn, Button, StatCard } from '../../components/Shared';
import { FilterSelect } from '../../components/FilterSelect';
import { DrilldownModal, TransactionModal } from '../../components/Modals';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, DollarSign, ArrowRight, Filter, Plus, CreditCard as CardIcon, Calendar, ThumbsUp, ThumbsDown, BarChart2, FileText, Printer, LayoutList, ArrowUpRight, ArrowDownRight, ArrowRightLeft, HandCoins, Settings, X, MoreHorizontal } from 'lucide-react';
import { FinancialReportModal } from '../../components/Reports/FinancialReportModal';
import { isBefore, startOfDay, endOfDay, addDays, isWithinInterval, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { parseDateLocal } from '../../utils/formatters';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useCompany } from '../../context/CompanyContext';
import { useAppEnvironment } from '../../context/AppEnvironmentContext';



export const FinancialOverview: React.FC = () => {
    const { currentCompany } = useCompany();
    const navigate = useNavigate();
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
    
    // Mobile States
    const { isApp } = useAppEnvironment();
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'transfer'>('expense');

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

    // === MOBILE LAYOUT ===
    if (isApp) {
        const recentActivity = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

        return (
            <div className="flex-1 flex flex-col gap-5 px-4 pt-3 pb-24 overflow-y-auto custom-scrollbar relative">
                
                {/* CAMADA 1: Ações Principais */}
                <section>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            onClick={() => setIsQuickAddOpen(true)}
                            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary transition-all duration-200 active:scale-[0.97] hover:bg-primary/15"
                        >
                            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <Plus size={15} strokeWidth={2} />
                            </div>
                            <span className="text-xs font-semibold truncate">+ Lançamentos</span>
                        </button>
                        
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-card border border-border text-foreground transition-all duration-200 active:scale-[0.97] hover:bg-accent/50 hover:border-border/80"
                        >
                            <div className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                                <FileText size={15} strokeWidth={2} />
                            </div>
                            <span className="text-xs font-semibold truncate">Relatórios</span>
                        </button>
                    </div>
                </section>

                {/* CAMADA 2: Resumo Financeiro */}
                <section>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Resumo (Mês Atual)</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div onClick={() => openDrilldown('Saldo Consolidado', t => t.isPaid)} className="col-span-2 cursor-pointer bg-gradient-to-br from-card to-secondary/30 border border-border rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform">
                            <span className="text-xs font-bold text-muted-foreground uppercase">Saldo Atual</span>
                            <div className="mt-1 text-3xl font-black text-foreground tracking-tighter">{fmt(currentBalance)}</div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_var(--success)]"></div> Todas as contas
                            </div>
                        </div>

                        <div onClick={() => openDrilldown('Receitas Realizadas', t => t.type === 'income' && t.isPaid)} className="cursor-pointer">
                            <StatCard title="Receitas" value={fmt(realizedIncome)} icon={TrendingUp} variant="success" size="sm" />
                        </div>
                        <div onClick={() => openDrilldown('Despesas Realizadas', t => t.type === 'expense' && t.isPaid)} className="cursor-pointer">
                            <StatCard title="Despesas" value={fmt(realizedExpense)} icon={TrendingDown} variant="danger" size="sm" />
                        </div>
                        <div className="col-span-2">
                            <StatCard title="Resultado do Período" value={fmt(realizedIncome - realizedExpense)} icon={DollarSign} variant={(realizedIncome - realizedExpense) >= 0 ? 'success' : 'danger'} size="sm" />
                        </div>
                    </div>
                </section>

                {/* CAMADA 3: Atenção Financeira */}
                <section>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Atenção Financeira</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div onClick={() => openDrilldown('Contas Atrasadas', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && isBefore(parseDateLocal(t.date), todayStart), true)} className="cursor-pointer">
                            <StatCard title="A Pagar" value={fmt(payablesOverdue)} icon={AlertCircle} variant="danger" subtitle="Atrasadas" size="sm" />
                        </div>
                        <div onClick={() => openDrilldown('A Vencer (7 dias)', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && !isBefore(parseDateLocal(t.date), todayStart), true)} className="cursor-pointer">
                            <StatCard title="A Pagar" value={fmt(payablesFuture)} icon={Clock} variant="warning" subtitle="Próx. 7 dias" size="sm" />
                        </div>
                        <div onClick={() => openDrilldown('Recebimentos Atrasados', t => t.type === 'income' && !t.isPaid && isBefore(parseDateLocal(t.date), todayStart))} className="cursor-pointer">
                            <StatCard title="A Receber" value={fmt(receivablesOverdue)} icon={AlertCircle} variant="danger" subtitle="Atrasadas" size="sm" />
                        </div>
                        <div onClick={() => openDrilldown('A Receber (7 dias)', t => t.type === 'income' && !t.isPaid && !isBefore(parseDateLocal(t.date), todayStart))} className="cursor-pointer">
                            <StatCard title="A Receber" value={fmt(receivablesFuture)} icon={Clock} variant="success" subtitle="Próx. 7 dias" size="sm" />
                        </div>
                    </div>
                </section>

                {/* CAMADA 4: Lançamentos Recentes */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Lançamentos Recentes</h2>
                        <button onClick={() => navigate('/finance/transactions')} className="text-[10px] text-primary font-bold uppercase tracking-wider flex items-center gap-1 p-2 bg-primary/10 rounded-lg">
                            Ver todos <ArrowRight size={10} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {recentActivity.length === 0 ? (
                            <div className="text-xs text-muted-foreground p-4 border border-border rounded-xl bg-card/50 text-center">Nenhum lançamento recente</div>
                        ) : (
                            recentActivity.map(t => (
                                <div key={t.id} onClick={() => { setTransactionType(t.type); setIsTransactionModalOpen(true); }} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98]">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", t.type === 'income' ? 'bg-success/10 text-success' : t.type === 'expense' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary')}>
                                            {t.type === 'income' ? <ArrowUpRight size={14} /> : t.type === 'expense' ? <ArrowDownRight size={14} /> : <ArrowRightLeft size={14} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold truncate">{t.description}</div>
                                            <div className="text-[10px] text-muted-foreground">{parseDateLocal(t.date).toLocaleDateString('pt-BR')} • {categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria'}</div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={cn("font-bold text-sm", t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-danger' : 'text-foreground')}>
                                            {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                                        </div>
                                        <Badge variant={t.isPaid ? 'success' : 'neutral'} className="text-[9px] py-0 mt-1">{t.isPaid ? 'Pago' : 'Pendente'}</Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* CAMADA 5: Acessos Financeiros */}
                <section>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Acessos</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                        {[
                            { label: 'Lançamentos', icon: LayoutList, path: '/finance/transactions' },
                            { label: 'Contas & Bancos', icon: Wallet, path: '/finance/accounts' },
                            { label: 'Cartões', icon: CardIcon, path: '/finance/cards' },
                            { label: 'Dívidas', icon: HandCoins, path: '/finance/loans' },
                            { label: 'Categorias', icon: Filter, path: '/finance/categories' },
                        ].map(item => (
                            <button
                                key={item.label}
                                onClick={() => navigate(item.path)}
                                className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border text-foreground transition-all active:scale-[0.97]"
                            >
                                <div className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                                    <item.icon size={16} />
                                </div>
                                <span className="text-xs font-semibold truncate">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* MODALS MOBILE */}
                {isQuickAddOpen && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsQuickAddOpen(false)}></div>
                        <div className="bg-card w-full rounded-t-3xl p-6 relative z-10 animate-in slide-in-from-bottom-full duration-200 shadow-2xl border-t border-border">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg">Novo Lançamento</h3>
                                <button onClick={() => setIsQuickAddOpen(false)} className="p-2 bg-secondary rounded-full"><X size={16} /></button>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => { setTransactionType('income'); setIsQuickAddOpen(false); setIsTransactionModalOpen(true); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-success/10 border border-success/20 text-success font-bold active:scale-[0.98]">
                                    <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center"><ArrowUpRight size={20} /></div>
                                    <div className="text-left"><div className="text-base">Receita</div><div className="text-xs font-normal opacity-80">Nova entrada de dinheiro</div></div>
                                </button>
                                <button onClick={() => { setTransactionType('expense'); setIsQuickAddOpen(false); setIsTransactionModalOpen(true); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger font-bold active:scale-[0.98]">
                                    <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center"><ArrowDownRight size={20} /></div>
                                    <div className="text-left"><div className="text-base">Despesa</div><div className="text-xs font-normal opacity-80">Nova saída ou conta a pagar</div></div>
                                </button>
                                <button onClick={() => { setTransactionType('transfer'); setIsQuickAddOpen(false); setIsTransactionModalOpen(true); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 font-bold active:scale-[0.98]">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center"><ArrowRightLeft size={20} /></div>
                                    <div className="text-left"><div className="text-base">Transferência</div><div className="text-xs font-normal opacity-80">Mover saldo entre contas</div></div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <DrilldownModal
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                    title={modalState.title}
                    type="finance"
                    data={modalState.data}
                    users={[]}
                />

                <TransactionModal
                    isOpen={isTransactionModalOpen}
                    onClose={() => setIsTransactionModalOpen(false)}
                    onSuccess={loadData}
                    accounts={accounts}
                    categories={categories}
                    cards={cards}
                    contacts={contacts}
                    initialType={transactionType}
                />

                <FinancialReportModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    transactions={filteredData}
                    accounts={accounts}
                    categories={categories}
                />

            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-4 pb-8 pr-2">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
                <div>
                    <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <DollarSign className="text-primary" size={20} /> Visão Geral
                        <span className="text-[10px] font-normal text-muted-foreground ml-2 hidden md:inline">| Financeiro</span>
                    </h1>
                </div>

                <div className="flex gap-2">
                    {/* Relatórios: ícone apenas no mobile */}
                    <Button
                        variant="ghost"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-secondary/50 border border-border hover:bg-secondary text-foreground gap-1.5 h-7 text-[10px]"
                        title="Relatórios"
                    >
                        <Printer size={14} className="text-primary" />
                        <span className="hidden sm:inline">Relatórios</span>
                    </Button>

                    {/* Lançamentos - somente mobile */}
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/finance/transactions')}
                        className="sm:hidden bg-secondary/50 border border-border hover:bg-secondary text-foreground gap-1.5 h-7 text-[10px]"
                        title="Lançamentos"
                    >
                        <LayoutList size={14} className="text-primary" />
                        <span>Lançamentos</span>
                    </Button>

                    <Button
                        className="px-3 gap-1.5 shadow-lg shadow-primary/20 transition-all hover:scale-105 h-7 text-[10px]"
                        onClick={() => setIsTransactionModalOpen(true)}
                    >
                        <Plus size={14} /> Novo Lançamento
                    </Button>
                </div>
            </div>




            {/* BLOCO 1 - RESUMO */}
            {/* BLOCO 1 - KPIS (HIERARQUIA: SALDO > FLUXO > RESULTADO) */}
            {/* COMPONENT AUXILIAR LOCAL */}


            {(() => {
                return (
                    <>
                        {/* BLOCO 1 - RESUMO */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-6">
                            {/* SALDO - PROTAGONISTA (Mantido layout especial mas alinhado) */}
                            <div className="lg:col-span-4 bg-gradient-to-br from-card to-secondary/30 border border-border/50 p-0 rounded-2xl flex flex-col justify-between relative overflow-hidden group shadow-card transition-all duration-300 hover:shadow-premium hover:-translate-y-1 dark:from-slate-900 dark:to-slate-800 dark:border-slate-700/50">
                                <div className="p-4 lg:p-5 flex justify-between items-start">
                                    <div>
                                        <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest dark:text-slate-400">Saldo Atual</span>
                                        <div className="mt-1 text-2xl xl:text-3xl font-black text-foreground tracking-tighter dark:text-white">
                                            {fmt(currentBalance)}
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 bg-secondary/80 rounded-full border border-border flex items-center justify-center shrink-0 dark:bg-white/5 dark:border-white/10">
                                        <Wallet size={20} className="text-success dark:text-success" />
                                    </div>
                                </div>
                                <div className="px-4 lg:px-5 py-3 bg-secondary/50 flex-1 flex items-center border-t border-border mt-auto dark:bg-black/20 dark:border-white/5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground dark:text-slate-300">
                                        <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_var(--success)]"></div>
                                        <span>Consolidado de todas as contas</span>
                                    </div>
                                </div>
                            </div>


                            {/* FLUXO - SECUNDÁRIO */}
                            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div onClick={() => openDrilldown('Receitas Realizadas', t => t.type === 'income' && t.isPaid)} className="cursor-pointer">
                                    <StatCard
                                        title="Receitas"
                                        value={fmt(realizedIncome)}
                                        icon={TrendingUp}
                                        variant="success"
                                        subtitle="Realizadas este mês"
                                        size="sm"
                                    />
                                </div>

                                <div onClick={() => openDrilldown('Despesas Realizadas', t => t.type === 'expense' && t.isPaid)} className="cursor-pointer">
                                    <StatCard
                                        title="Despesas"
                                        value={fmt(realizedExpense)}
                                        icon={TrendingDown}
                                        variant="danger"
                                        subtitle="Realizadas este mês"
                                        size="sm"
                                    />
                                </div>

                                <StatCard
                                    title="Resultado"
                                    value={fmt(realizedIncome - realizedExpense)}
                                    icon={DollarSign}
                                    variant={(realizedIncome - realizedExpense) >= 0 ? 'success' : 'danger'}
                                    subtitle="Balanço do Período"
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* BLOCO 2 - RISCO (ATRASADOS vs FUTUROS) */}
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-4 pl-1">
                                <div className="h-px bg-border flex-1"></div>
                                <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={14} /> Fluxo de Caixa Previsto
                                </h2>
                                <div className="h-px bg-border flex-1"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* PAYABLES OVERDUE - ALARM */}
                                <div onClick={() => openDrilldown('Pagamentos em Atraso', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && isBefore(parseDateLocal(t.date), todayStart), true)} className="cursor-pointer">
                                    <StatCard
                                        title="Contas Atrasadas"
                                        value={fmt(payablesOverdue)}
                                        icon={AlertCircle}
                                        variant="danger"
                                        subtitle="Pagamentos Vencidos"
                                        size="sm"
                                    />
                                </div>

                                {/* PAYABLES FUTURE */}
                                <div onClick={() => openDrilldown('Pagamentos a Vencer', t => t.type === 'expense' && !t.isPaid && (!t.creditCardId || (t as ProcessedTransaction).isVirtual) && !isBefore(parseDateLocal(t.date), todayStart), true)} className="cursor-pointer">
                                    <StatCard
                                        title="A Vencer (7 dias)"
                                        value={fmt(payablesFuture)}
                                        icon={Clock}
                                        variant="warning"
                                        subtitle="Próximos Pagamentos"
                                        size="sm"
                                    />
                                </div>

                                {/* RECEIVABLES OVERDUE - ALARM */}
                                <div onClick={() => openDrilldown('Recebimentos em Atraso', t => t.type === 'income' && !t.isPaid && isBefore(parseDateLocal(t.date), todayStart))} className="cursor-pointer">
                                    <StatCard
                                        title="Recebimentos Atrasados"
                                        value={fmt(receivablesOverdue)}
                                        icon={AlertCircle}
                                        variant="danger"
                                        subtitle="Clientes Inadimplentes"
                                        size="sm"
                                    />
                                </div>

                                {/* RECEIVABLES FUTURE */}
                                <div onClick={() => openDrilldown('Recebimentos a Vencer', t => t.type === 'income' && !t.isPaid && !isBefore(parseDateLocal(t.date), todayStart))} className="cursor-pointer">
                                    <StatCard
                                        title="A Receber (7 dias)"
                                        value={fmt(receivablesFuture)}
                                        icon={Clock}
                                        variant="success"
                                        subtitle="Próximas Entradas"
                                        size="sm"
                                    />
                                </div>
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
                                                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 shadow-sm"
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>

                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide">
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
            <div className="bg-card border border-border/50 shadow-card rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <BarChart2 size={20} className="text-primary" /> Evolução Financeira
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
                                    <div className="p-5 rounded-xl border border-dashed border-success/20 bg-success/5">
                                        <span className="text-xs text-success/70 font-bold uppercase tracking-widest">Receitas {comparisonMode === 'month' ? '(Mês Atual)' : '(Totais)'}</span>
                                        <div className="mt-2 text-3xl font-bold text-success tracking-tighter">{fmt(revenue.current)}</div>
                                        {comparisonMode !== 'custom' && (
                                            <div className="mt-1 flex items-center gap-1.5 opacity-60">
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-success">
                                                    Anterior: {fmt(revenue.previous)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 rounded-xl border border-dashed border-danger/20 bg-danger/5">
                                        <span className="text-xs text-danger/70 font-bold uppercase tracking-widest">Despesas {comparisonMode === 'month' ? '(Mês Atual)' : '(Totais)'}</span>
                                        <div className="mt-2 text-3xl font-bold text-danger tracking-tighter">{fmt(expense.current)}</div>
                                        {comparisonMode !== 'custom' && (
                                            <div className="mt-1 flex items-center gap-1.5 opacity-60">
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-danger">
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

            <DrilldownModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ ...modalState, isOpen: false })}
                title={modalState.title}
                type="finance"
                data={modalState.data}
                users={[]}
                onPayAction={(item) => {
                    navigate(`/finance/cards?payInvoice=${item.id}`);
                }}
            />
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
