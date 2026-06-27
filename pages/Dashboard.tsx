
import React, { useEffect, useState, useMemo } from 'react';
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar as CalendarIcon,
    Wallet,
    List,
    FileText,
    Building2,
    Plus,
    RefreshCw,
    Filter,
    UserCircle,
    Layers,
    ChevronDown,
    X,
    AlertTriangle,
    CreditCard as CreditCardIcon,
    TrendingUp,
    TrendingDown,
    DollarSign
} from 'lucide-react';
import { Loader, cn, Button, StatCard, Card } from '../components/Shared';
import { DrilldownModal } from '../components/Modals';
import { api, getErrorMessage } from '../services/api';
import { DashboardMetrics, Task, CalendarEvent, FinancialTransaction, FinancialAccount, Quote, User, CreditCard } from '../types';
import { useNavigate } from 'react-router-dom';
import { processTransactions, ProcessedTransaction } from '../services/financeLogic';
import { parseDateLocal } from '../utils/formatters';
import { isBefore, isSameDay, addDays, isWithinInterval, startOfDay, startOfMonth, endOfMonth, format, setDate, addMonths, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompany } from '../context/CompanyContext';
import { useAppEnvironment } from '../context/AppEnvironmentContext';
import { useRBAC } from '../context/RBACContext';
import { supabase } from '../services/supabase';

// Helper for distinct values
const getUniqueAssignees = (tasks: Task[], users: User[]) => {
    const ids = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean)));
    return ids.map(id => {
        const user = users.find(u => u.id === id);
        return { id, name: user?.name || 'Usuário Desconhecido' };
    }).sort((a, b) => a.name.localeCompare(b.name));
};

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { currentCompany, loading: companyLoading } = useCompany();
    const { isSuperAdmin, isAdmin } = useRBAC();
    const { isApp } = useAppEnvironment();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Raw Data
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);

    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

    // Filters State
    const [horizon, setHorizon] = useState<3 | 7 | 15 | 30>(3); // Days
    
    // Derived available modules based on permissions
    const { can } = useRBAC();
    const availableModules = useMemo(() => {
        const mods = ['tasks', 'events'];
        if (can('finance', 'view')) mods.push('finance');
        if (can('commercial', 'view')) mods.push('quotes');
        return mods;
    }, [can]);

    const [selectedModules, setSelectedModules] = useState<string[]>([]);
    const [assigneeFilter, setAssigneeFilter] = useState<'all' | string>('all');
    const [isModulesOpen, setIsModulesOpen] = useState(false);
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);

    useEffect(() => {
        setSelectedModules(availableModules);
    }, [availableModules]);

    // UI States
    const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, type: 'tasks' | 'events' | 'finance' | 'quotes', data: any[], indicatorColor?: string }>({
        isOpen: false, title: '', type: 'tasks', data: []
    });

    useEffect(() => {
        if (companyLoading) return;
        if (currentCompany) {
            loadDashboard();
        } else {
            setLoading(false);
        }
    }, [currentCompany, companyLoading]);

    useEffect(() => {
        const handleItemCompleted = (e: any) => {
            const { id, type } = e.detail;
            if (type === 'task') {
                setTasks(prev => prev.filter(t => t.id !== id));
            } else if (type === 'agenda') {
                setEvents(prev => prev.filter(ev => ev.id !== id));
            } else if (type === 'finance') {
                setTransactions(prev => prev.map(tr => tr.id === id ? { ...tr, isPaid: true } : tr));
            }
        };

        window.addEventListener('item-completed', handleItemCompleted);
        return () => window.removeEventListener('item-completed', handleItemCompleted);
    }, []);

    const loadDashboard = async () => {
        if (!currentCompany) return;
        setLoading(true);
        setError(null);
        try {
            // Fetch users for filter
            const { data: profiles } = await supabase.from('profiles').select('*');
            if (profiles) setUsers(profiles as any);

            // Parallel fetch
            const m = await api.getDashboardMetrics(currentCompany.id);
            setMetrics(m);

            const [t, e, tr, q, c, acc] = await Promise.all([
                api.getTasks(currentCompany.id).catch(() => []),
                api.getEvents(currentCompany.id).catch(() => []),
                api.getFinancialTransactions(currentCompany.id).catch(() => []),
                api.getQuotes(currentCompany.id).catch(() => []),
                api.getCreditCards(currentCompany.id).catch(() => []),
                api.getFinancialAccounts(currentCompany.id).catch(() => [])
            ]);
            setTasks(t);
            setEvents(e);
            setTransactions(tr);
            setQuotes(q);
            setCards(c);
            setAccounts(acc);
        } catch (error: any) {
            console.error("Erro ao carregar dashboard:", error);
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    // --- Derived Data ---
    const assignees = useMemo(() => getUniqueAssignees(tasks, users), [tasks, users]);

    // --- Deadline Processing Logic ---
    const getDeadlineStatus = (dateStr?: string | Date, isDone?: boolean) => {
        if (!dateStr || isDone) return 'none';

        let date: Date;
        try {
            if (typeof dateStr === 'string') {
                if (dateStr.includes('T')) {
                    date = parseISO(dateStr);
                } else {
                    date = parseDateLocal(dateStr);
                }
            } else {
                date = dateStr;
            }
        } catch (e) { return 'none'; }

        const today = startOfDay(new Date());
        const eventDate = startOfDay(date);

        if (isBefore(eventDate, today)) return 'overdue';
        if (isSameDay(eventDate, today)) return 'today';

        const horizonDate = addDays(today, horizon);
        const tomorrow = addDays(today, 1);

        // Upcoming logic depends on horizon state
        if (isWithinInterval(eventDate, { start: tomorrow, end: horizonDate })) return 'upcoming';

        return 'future';
    };

    // Filter Items by Zone AND User Filters
    const filterItems = (zone: 'overdue' | 'today' | 'upcoming') => {
        // 1. Filter by Module
        const enableTasks = selectedModules.includes('tasks');
        const enableEvents = selectedModules.includes('events');
        const enableFinance = selectedModules.includes('finance');
        const enableQuotes = selectedModules.includes('quotes');

        // 2. Filter by Assignee
        const checkAssignee = (itemAssigneeId?: string) => {
            if (assigneeFilter === 'all') return true;
            return itemAssigneeId === assigneeFilter;
        };

        // 3. Generate Virtual Items for Credit Card Bills via Central Logic
        let matchedFinance: any[] = [];

        if (enableFinance) {
            // Force CASH mode to generate Virtual Invoices (Bills)
            const processedFinancialData = processTransactions(transactions, cards, 'cash');

            matchedFinance = processedFinancialData.filter(t => {
                if (assigneeFilter !== 'all') return false; // Hide finance when filtering by user
                if (t.isPaid) return false; // Hide paid items

                // Exclude individual credit card purchases (they should be consolidated in invoices)
                if (t.creditCardId && !(t as ProcessedTransaction).isVirtual) return false;

                // Exclude income if we only want "bills to pay"? Usually dashboard shows everything.
                // But usually "Overdue" implies things to PAY or things to RECEIVE.
                // The ZoneCard logic is generic. Let's include both Income and Expense but zone properly.

                if (!t.date) return false;
                return getDeadlineStatus(t.date, t.isPaid) === zone;
            });
        }

        const zoneTasks = enableTasks ? tasks.filter(t =>
            t.dueDate &&
            checkAssignee(t.assigneeId) &&
            getDeadlineStatus(t.dueDate, t.status === 'done' || t.status === 'completed') === zone
        ) : [];

        const zoneEvents = enableEvents ? events.filter(e => {
            // Filter by participant if assignee filter is active
            if (assigneeFilter !== 'all' && !e.participants?.includes(assigneeFilter)) return false;

            return getDeadlineStatus(e.startDate, e.status === 'completed' || e.status === 'cancelled') === zone;
        }) : [];

        const zoneQuotes = enableQuotes ? quotes.filter(q => {
            // Quotes are global/commercial, hide if filtering by user (unless we add responsibleId later)
            if (assigneeFilter !== 'all') return false;

            return q.validUntil &&
                getDeadlineStatus(q.validUntil, ['approved', 'rejected', 'expired'].includes(q.status)) === zone;
        }) : [];

        return { tasks: zoneTasks, events: zoneEvents, quotes: zoneQuotes, finance: matchedFinance };
    };

    const overdueItems = filterItems('overdue');
    const todayItems = filterItems('today');
    const upcomingItems = filterItems('upcoming');

    const openDrilldown = (title: string, type: 'tasks' | 'events' | 'finance' | 'quotes', data: any[], indicatorColor?: string) => {
        setModalState({ isOpen: true, title, type, data, indicatorColor });
    };

    const toggleModule = (mod: string) => {
        if (selectedModules.includes(mod)) {
            setSelectedModules(prev => prev.filter(m => m !== mod));
        } else {
            setSelectedModules(prev => [...prev, mod]);
        }
    };

    // --- Admin Financial KPIs ---
    const financeKPIs = useMemo(() => {
        if (!isAdmin || accounts.length === 0) return null;

        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // Saldo Atual (same logic as Finance Overview)
        const currentBalance = accounts.reduce((accBalance, account) => {
            const accountIncome = transactions.filter(t => t.accountId === account.id && t.type === 'income' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            const accountExpense = transactions.filter(t => t.accountId === account.id && t.type === 'expense' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            const transfersOut = transactions.filter(t => t.accountId === account.id && t.type === 'transfer' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            const transfersIn = transactions.filter(t => t.toAccountId === account.id && t.type === 'transfer' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            return accBalance + account.initialBalance + accountIncome - accountExpense - transfersOut + transfersIn;
        }, 0);

        // Receita e Despesa do Mês (apenas realizados/pagos)
        const monthTransactions = transactions.filter(t => {
            if (!t.date || !t.isPaid) return false;
            if (t.originType === 'technical') return false;
            try {
                const d = parseDateLocal(t.date);
                return isWithinInterval(d, { start: monthStart, end: monthEnd });
            } catch { return false; }
        });

        const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const monthExpense = monthTransactions.filter(t => t.type === 'expense' && !t.description?.toLowerCase().includes('fatura')).reduce((s, t) => s + t.amount, 0);
        const netResult = monthIncome - monthExpense;

        return { currentBalance, monthIncome, monthExpense, netResult };
    }, [isAdmin, accounts, transactions]);

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // --- Financial Panel (Admin Only) ---
    const FinancialPanel = () => {
        if (!financeKPIs) return null;
        const { currentBalance, monthIncome, monthExpense, netResult } = financeKPIs;

        return (
            <div className="flex flex-col gap-3 h-full">
                <h2 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase pl-1 shrink-0">Resumo Financeiro</h2>

                {/* Saldo — hero card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-border/50 p-4 flex flex-col justify-between group shadow-card transition-all duration-300 hover:shadow-premium hover:-translate-y-1 dark:from-slate-900 dark:to-slate-800 dark:border-slate-700/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest dark:text-slate-400">Saldo Atual</span>
                            <div className="mt-1 text-xl font-black text-foreground tracking-tighter dark:text-white">
                                {fmt(currentBalance)}
                            </div>
                        </div>
                        <div className="w-8 h-8 bg-secondary/80 rounded-full border border-border flex items-center justify-center shrink-0 dark:bg-white/5 dark:border-white/10">
                            <Wallet size={16} className="text-success" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_6px_var(--success)]"></div>
                        <span>Consolidado de todas as contas</span>
                    </div>
                </div>

                {/* Receita do Mês */}
                <StatCard
                    title="Receita do Mês"
                    value={fmt(monthIncome)}
                    icon={TrendingUp}
                    variant="success"
                    size="md"
                    className="flex-1"
                />

                {/* Despesa do Mês */}
                <StatCard
                    title="Despesa do Mês"
                    value={fmt(monthExpense)}
                    icon={TrendingDown}
                    variant="danger"
                    size="md"
                    className="flex-1"
                />

                {/* Resultado Líquido */}
                <StatCard
                    title="Resultado Líquido"
                    value={fmt(netResult)}
                    icon={DollarSign}
                    variant={netResult >= 0 ? 'success' : 'danger'}
                    size="md"
                    className="flex-1"
                />
            </div>
        );
    };

    const ZoneCard = ({ title, count, icon: IconComponent, type, variant, onClick }: { title: string, count: number, icon: any, type: string, variant: 'danger' | 'warning' | 'info', onClick: () => void }) => {
        if (count === 0) return null;

        return (
            <div onClick={onClick} className="cursor-pointer h-full">
                <StatCard
                    title={title}
                    value={count}
                    icon={IconComponent}
                    variant={variant}
                    size="md"
                    className="h-full"
                />
            </div>
        );
    };

    const ZoneSection = ({
        title,
        items,
        variant
    }: {
        title: string,
        items: ReturnType<typeof filterItems>,
        variant: 'danger' | 'warning' | 'info'
    }) => {
        const hasItems = 
            (selectedModules.includes('tasks') && availableModules.includes('tasks') && items.tasks.length > 0) || 
            (selectedModules.includes('events') && availableModules.includes('events') && items.events.length > 0) || 
            (selectedModules.includes('finance') && availableModules.includes('finance') && items.finance.length > 0) || 
            (selectedModules.includes('quotes') && availableModules.includes('quotes') && items.quotes.length > 0);

        const EmptyState = () => (
            <Card variant="solid" className="flex items-center gap-4 text-success bg-success/5 border-success/20">
                <div className="p-2 rounded-full bg-success/20 shrink-0">
                    <CheckCircle2 size={20} className="text-success" />
                </div>
                <span className="text-sm font-medium">
                    {variant === 'danger' ? "Excelente! Nenhum item vencido sob sua responsabilidade." :
                        variant === 'warning' ? "Sem pendências críticas para hoje." :
                            "Tudo tranquilo para os próximos dias."}
                </span>
            </Card>
        );

        return (
            <section className="flex-1 flex flex-col min-h-0 pb-2">
                <h2 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-2 pl-1 shrink-0">{title}</h2>
                {hasItems ? (
                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-3 3xl:gap-4" style={{ gridAutoRows: '1fr' }}>
                        {selectedModules.includes('tasks') && availableModules.includes('tasks') && <ZoneCard title="Tarefas" count={items.tasks.length} icon={List} type="task" variant={variant} onClick={() => openDrilldown('Tarefas', 'tasks', items.tasks, variant)} />}
                        {selectedModules.includes('events') && availableModules.includes('events') && <ZoneCard title="Compromissos" count={items.events.length} icon={CalendarIcon} type="event" variant={variant} onClick={() => openDrilldown('Compromissos', 'events', items.events, variant)} />}
                        {selectedModules.includes('finance') && availableModules.includes('finance') && <ZoneCard title="Financeiro" count={items.finance.length} icon={Wallet} type="finance" variant={variant} onClick={() => openDrilldown('Contas', 'finance', items.finance, variant)} />}
                        {selectedModules.includes('quotes') && availableModules.includes('quotes') && <ZoneCard title="Orçamentos" count={items.quotes.length} icon={FileText} type="quote" variant={variant} onClick={() => openDrilldown('Orçamentos', 'quotes', items.quotes, variant)} />}
                    </div>
                ) : (
                    <EmptyState />
                )}
            </section>
        );
    };

    // --- Loading/Error States ---
    if (loading || companyLoading) return <Loader />;

    // --- No Company State (Super Admin) ---
    if (!currentCompany && isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="p-6 bg-card rounded-full border-4 border-border shadow-2xl">
                    <Building2 size={64} className="text-primary" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-3xl font-bold text-foreground">Bem-vindo, Super Admin</h2>
                    <p className="text-muted-foreground">
                        Você ainda não selecionou uma empresa para gerenciar. Escolha uma existente no menu lateral ou crie uma nova.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button onClick={() => navigate('/super-admin/dashboard')} className="gap-2 bg-primary hover:bg-primary/90">
                        <Plus size={18} /> Criar / Gerenciar Empresas
                    </Button>
                </div>
            </div>
        );
    }

    // --- No Company State (Regular User - Error Case) ---
    if (!currentCompany) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <AlertCircle size={48} className="text-muted-foreground mb-4" />
                <h3 className="text-xl font-bold text-foreground">Nenhuma empresa vinculada</h3>
                <p className="text-muted-foreground mt-2">Contate o administrador para liberar seu acesso.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="p-4 bg-destructive/10 rounded-full text-destructive">
                    <AlertTriangle size={48} />
                </div>
                <div className="text-center max-w-lg">
                    <h3 className="text-xl font-bold text-foreground mb-2">Erro ao carregar Dashboard</h3>
                    <div className="text-muted-foreground text-sm font-mono bg-secondary p-4 rounded-lg border border-border break-words max-h-48 overflow-y-auto custom-scrollbar">
                        {error}
                    </div>
                </div>
                <Button onClick={loadDashboard} className="gap-2">
                    <RefreshCw size={16} /> Tentar Novamente
                </Button>
            </div >
        );
    }

    // --- Filter Bar Component (Premium) ---
    const FilterBar = () => {
        const moduleNames: Record<string, string> = { tasks: 'Tarefas', events: 'Agenda', finance: 'Financeiro', quotes: 'Orçamentos' };

        return (
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center shrink-0 gap-4 mb-3">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 xl:gap-8 w-full lg:w-auto">
                    <div>
                        <h1 className="text-base font-bold text-foreground tracking-tight">Painel Principal</h1>
                        <p className="text-muted-foreground text-xs">Visão geral de rotinas e alertas.</p>
                    </div>
                    
                    {!isApp && (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 md:flex-none">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsModulesOpen(!isModulesOpen)}
                                    className="w-full gap-2 h-7 text-[10px] justify-between md:justify-start px-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Layers size={16} className="text-primary" />
                                        <span className="hidden sm:inline">Módulos ({selectedModules.length})</span>
                                        <span className="sm:hidden">({selectedModules.length})</span>
                                    </div>
                                    <ChevronDown size={14} className={`transition-transform ${isModulesOpen ? 'rotate-180' : ''}`} />
                                </Button>

                                {isModulesOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsModulesOpen(false)} />
                                        <div className="absolute top-full left-0 mt-2 w-52 bg-popover rounded-xl shadow-xl z-50 p-3 transform origin-top-left animate-in fade-in zoom-in-95 duration-200">
                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Exibir Módulos</div>
                                            <div className="space-y-1">
                                                {availableModules
                                                    .sort((a, b) => moduleNames[a].localeCompare(moduleNames[b]))
                                                    .map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => toggleModule(m)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                                            selectedModules.includes(m)
                                                                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                                                                : "text-muted-foreground hover:bg-secondary hover:text-foreground font-medium"
                                                        )}
                                                    >
                                                        <span>{moduleNames[m]}</span>
                                                        {selectedModules.includes(m) && <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-500" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="relative flex-1 md:flex-none">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                                    className="w-full gap-2 h-7 text-[10px] justify-between md:justify-start px-2 md:min-w-[120px]"
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <UserCircle size={16} className="text-muted-foreground shrink-0" />
                                        <span className="text-xs md:text-sm font-medium text-foreground truncate">
                                            {assigneeFilter === 'all'
                                                ? 'Todos'
                                                : assignees.find(u => u.id === assigneeFilter)?.name.split(' ')[0] || 'Todos'}
                                        </span>
                                    </div>
                                    <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`} />
                                </Button>

                                {isAssigneeOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsAssigneeOpen(false)} />
                                        <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-48 bg-popover rounded-xl shadow-xl z-50 p-2 transform origin-top md:origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Responsável</div>
                                            <div className="space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                <button
                                                    onClick={() => { setAssigneeFilter('all'); setIsAssigneeOpen(false); }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                                        assigneeFilter === 'all'
                                                            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                                            : "text-foreground hover:bg-secondary hover:text-primary font-medium"
                                                    )}
                                                >
                                                    <span>Todos</span>
                                                    {assigneeFilter === 'all' && <CheckCircle2 size={16} />}
                                                </button>
                                                {assignees.map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => { setAssigneeFilter(u.id); setIsAssigneeOpen(false); }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                                            assigneeFilter === u.id
                                                                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                                                : "text-foreground hover:bg-secondary hover:text-primary font-medium"
                                                        )}
                                                    >
                                                        <span className="truncate">{u.name.split(' ')[0]}</span>
                                                        {assigneeFilter === u.id && <CheckCircle2 size={16} className="shrink-0 ml-2" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    {/* Horizon Toggle */}
                    <div className="flex bg-secondary/50 rounded-lg p-1 gap-1 overflow-x-auto custom-scrollbar">
                        {[3, 7, 15, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setHorizon(d as any)}
                                className={cn(
                                    "px-3 py-1.5 text-[11px] md:text-xs rounded-md transition-all font-bold min-w-[36px] md:min-w-[40px] flex items-center justify-center",
                                    horizon === d
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                                )}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Date Display */}
                        <div className="flex flex-col items-end leading-none mr-2">
                            <span className="text-sm font-bold text-foreground tracking-tight">
                                {format(new Date(), 'dd/MM', { locale: ptBR })}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                                {format(new Date(), 'EEE', { locale: ptBR }).replace('.', '')}
                            </span>
                        </div>

                        {/* Refresh Button */}
                        <Button
                            variant="secondary"
                            onClick={loadDashboard}
                            className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
                        >
                            <RefreshCw size={14} className={cn(loading && "animate-spin text-primary")} />
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col pt-3 animate-in fade-in duration-500 pr-2 overflow-hidden">
            {FilterBar()}

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 overflow-hidden">
                {/* Coluna Esquerda — Alertas */}
                <div className={cn("flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar pr-2")}>
                    <ZoneSection title="Vencidos" items={overdueItems} variant="danger" />
                    <ZoneSection title="Vence Hoje" items={todayItems} variant="warning" />
                    <ZoneSection title={`Próximos ${horizon} dias`} items={upcomingItems} variant="info" />
                </div>

                {/* Coluna Direita — Resumo Financeiro (Admin Only) */}
                {isAdmin && financeKPIs && (
                    <>
                        <div className="hidden lg:block w-px bg-border my-4 shrink-0" />
                        <div className="w-full lg:w-[300px] 3xl:w-[360px] 4xl:w-[420px] shrink-0 flex flex-col overflow-y-auto custom-scrollbar pr-2">
                            <FinancialPanel />
                        </div>
                    </>
                )}
            </div>

            <DrilldownModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type={modalState.type}
                data={modalState.data}
                users={users}
                onPayAction={(item) => {
                    navigate(`/finance/cards?payInvoice=${item.id}`);
                }}
                onStatusChange={(item, isPaid) => {
                    setTransactions(prev => prev.map(t => t.id === item.id ? { ...t, isPaid } : t));
                }}
                indicatorColor={modalState.indicatorColor as any}
            />
        </div>
    );
};

