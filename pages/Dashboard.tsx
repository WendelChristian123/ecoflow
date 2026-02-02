
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
    CreditCard as CreditCardIcon
} from 'lucide-react';
import { Loader, cn, Button } from '../components/Shared';
import { DrilldownModal } from '../components/Modals';
import { api, getErrorMessage } from '../services/api';
import { DashboardMetrics, Task, CalendarEvent, FinancialTransaction, Quote, User, CreditCard } from '../types';
import { useNavigate } from 'react-router-dom';
import { processTransactions, ProcessedTransaction } from '../services/financeLogic';
import { parseDateLocal } from '../utils/formatters';
import { isBefore, isSameDay, addDays, isWithinInterval, startOfDay, format, setDate, addMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../context/RBACContext';
import { supabase } from '../services/supabase';

// Helper for distinct values
const getUniqueAssignees = (tasks: Task[], users: User[]) => {
    const ids = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean)));
    return ids.map(id => {
        const user = users.find(u => u.id === id);
        return { id, name: user?.name || 'Usuário Desconhecido' };
    });
};

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { currentTenant, loading: tenantLoading } = useTenant();
    const { isSuperAdmin } = useRBAC();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Raw Data
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);

    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

    // Filters State
    const [horizon, setHorizon] = useState<3 | 7 | 15 | 30>(3); // Days
    const [selectedModules, setSelectedModules] = useState<string[]>(['tasks', 'events', 'finance', 'quotes']);
    const [assigneeFilter, setAssigneeFilter] = useState<'all' | string>('all');
    const [isModulesOpen, setIsModulesOpen] = useState(false);
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);

    // UI States
    const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, type: 'tasks' | 'events' | 'finance' | 'quotes', data: any[] }>({
        isOpen: false, title: '', type: 'tasks', data: []
    });

    useEffect(() => {
        if (tenantLoading) return;
        if (currentTenant) {
            loadDashboard();
        } else {
            setLoading(false);
        }
    }, [currentTenant, tenantLoading]);

    const loadDashboard = async () => {
        if (!currentTenant) return;
        setLoading(true);
        setError(null);
        try {
            // Fetch users for filter
            const { data: profiles } = await supabase.from('profiles').select('*');
            if (profiles) setUsers(profiles as any);

            // Parallel fetch
            const m = await api.getDashboardMetrics(currentTenant.id);
            setMetrics(m);

            const [t, e, tr, q, c] = await Promise.all([
                api.getTasks(currentTenant.id).catch(() => []),
                api.getEvents(currentTenant.id).catch(() => []),
                api.getFinancialTransactions(currentTenant.id).catch(() => []),
                api.getQuotes(currentTenant.id).catch(() => []),
                api.getCreditCards(currentTenant.id).catch(() => [])
            ]);
            setTasks(t);
            setEvents(e);
            setTransactions(tr);
            setQuotes(q);
            setCards(c);
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
                date = parseDateLocal(dateStr);
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

    const openDrilldown = (title: string, type: 'tasks' | 'events' | 'finance' | 'quotes', data: any[]) => {
        setModalState({ isOpen: true, title, type, data });
    };

    const toggleModule = (mod: string) => {
        if (selectedModules.includes(mod)) {
            setSelectedModules(prev => prev.filter(m => m !== mod));
        } else {
            setSelectedModules(prev => [...prev, mod]);
        }
    };


    // --- Component Definitions ---
    const ZoneCard = ({ title, count, icon, type, variant, onClick }: { title: string, count: number, icon: React.ReactNode, type: string, variant: 'danger' | 'warning' | 'info', onClick: () => void }) => {
        if (count === 0) return null;

        // Semantic Colors only for Icons and Text - STRONG Contrast
        const colorMap = {
            danger: { text: "text-red-500", bg: "bg-red-500/10", border: "group-hover:border-red-500/40", title: "text-red-500", header: "bg-red-500" },
            warning: { text: "text-amber-500", bg: "bg-amber-500/10", border: "group-hover:border-amber-500/40", title: "text-amber-500", header: "bg-amber-500" },
            info: { text: "text-emerald-500", bg: "bg-emerald-500/10", border: "group-hover:border-emerald-500/40", title: "text-emerald-500", header: "bg-emerald-500" }
        };

        const theme = colorMap[variant];

        // Standard Card Structure - PREMIUM with Header Bar
        return (
            <div
                onClick={onClick}
                className={cn(
                    "bg-card border border-border shadow-sm rounded-2xl flex flex-col justify-between cursor-pointer min-h-[160px] select-none group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden",
                    theme.border
                )}
            >
                {/* 🎨 Header Bar with Module Name */}
                <div className={cn(
                    "px-4 py-2.5 flex items-center justify-between border-b border-white/10 transition-all",
                    theme.header
                )}>
                    <span className="text-[11px] uppercase tracking-widest text-white font-bold">
                        {title}
                    </span>
                    <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg">
                        <div className="text-white">
                            {icon}
                        </div>
                    </div>
                </div>

                {/* Background Decoration */}
                <div className={cn("absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none", theme.bg.replace('/10', ''))} />

                {/* Content Area */}
                <div className="p-6 pt-4 flex flex-col justify-between flex-1 relative z-10">
                    <div className="mt-auto">
                        <div className={cn("text-5xl font-black tracking-tighter leading-none mb-2 transition-transform duration-300 group-hover:translate-x-1",
                            variant === 'info' ? "text-emerald-500" : theme.text  // 🎨 VERDE para "Próximos Dias"
                        )}>
                            {count}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block opacity-70">
                            Itens Pendentes
                        </span>
                    </div>
                </div>
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
        const hasItems = items.tasks.length > 0 || items.events.length > 0 || items.finance.length > 0 || items.quotes.length > 0;

        // Semantic Accents
        const accents = {
            danger: "text-red-500 border-l-red-500",
            warning: "text-amber-500 border-l-amber-500",
            info: "text-emerald-500 border-l-emerald-500"
        };

        const EmptyState = () => (
            <div className="flex items-center gap-4 text-muted-foreground py-6 px-6 border border-dashed border-border rounded-2xl bg-card shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                <div className={cn("p-2 rounded-full bg-secondary")}>
                    <CheckCircle2 size={20} className="text-primary" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wide">
                    {variant === 'danger' ? "Excelente! Nenhum item vencido sob sua responsabilidade." :
                        variant === 'warning' ? "Sem pendências críticas para hoje." :
                            "Tudo tranquilo para os próximos dias."}
                </span>
            </div>
        );

        return (
            <section className="mb-8">
                <div className="flex items-center gap-3 mb-4 pl-1">
                    <div className={cn("w-1 h-4 rounded-full", variant === 'danger' ? 'bg-red-500' : variant === 'warning' ? 'bg-amber-500' : 'bg-emerald-500')}></div>
                    <div className={cn("text-sm font-bold uppercase tracking-widest", variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-amber-500' : 'text-emerald-500')}>
                        {title}
                    </div>
                    <div className="h-px bg-border flex-1 ml-2"></div>
                </div>

                {hasItems ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-5">
                        <ZoneCard title="Tarefas" count={items.tasks.length} icon={<List size={20} />} type="task" variant={variant} onClick={() => openDrilldown('Tarefas', 'tasks', items.tasks)} />
                        <ZoneCard title="Compromissos" count={items.events.length} icon={<CalendarIcon size={20} />} type="event" variant={variant} onClick={() => openDrilldown('Compromissos', 'events', items.events)} />
                        <ZoneCard title="Financeiro" count={items.finance.length} icon={<Wallet size={20} />} type="finance" variant={variant} onClick={() => openDrilldown('Contas', 'finance', items.finance)} />
                        <ZoneCard title="Orçamentos" count={items.quotes.length} icon={<FileText size={20} />} type="quote" variant={variant} onClick={() => openDrilldown('Orçamentos', 'quotes', items.quotes)} />
                    </div>
                ) : (
                    <EmptyState />
                )}
            </section>
        );
    };

    // --- Loading/Error States ---
    if (loading || tenantLoading) return <Loader />;

    // --- No Tenant State (Super Admin) ---
    if (!currentTenant && isSuperAdmin) {
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

    // --- No Tenant State (Regular User - Error Case) ---
    if (!currentTenant) {
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
            <div className="sticky top-0 z-30 bg-background/98 backdrop-blur-lg py-4 -mx-6 px-6 flex items-center justify-between shadow-sm border-b border-border/50">
                {/* Grupo 1: Filtros de Conteúdo */}
                <div className="flex items-center gap-3">
                    {/* Modules Dropdown - Premium */}
                    <div className="relative">
                        <button
                            onClick={() => setIsModulesOpen(!isModulesOpen)}
                            className="flex items-center gap-2 bg-card border border-border hover:border-emerald-500/50 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-all h-9 shadow-sm"
                        >
                            <Layers size={16} className="text-emerald-600 dark:text-emerald-500" />
                            <span>Módulos ({selectedModules.length})</span>
                            <ChevronDown size={14} className={`transition-transform ${isModulesOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isModulesOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsModulesOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-52 bg-popover border border-border rounded-xl shadow-xl z-50 p-3 transform origin-top-left animate-in fade-in zoom-in-95 duration-200">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Exibir Módulos</div>
                                    <div className="space-y-1">
                                        {['tasks', 'events', 'finance', 'quotes'].map(m => (
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

                    <div className="h-6 w-px bg-border" />

                    {/* Horizon Toggle - Premium */}
                    <div className="flex bg-secondary/50 rounded-lg p-1 border border-border gap-1">
                        {[3, 7, 15, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setHorizon(d as any)}
                                className={cn(
                                    "px-4 py-1.5 text-sm rounded-md transition-all font-semibold min-w-[50px]",
                                    horizon === d
                                        ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                                )}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grupo 2: Usuário e Ações */}
                <div className="flex items-center gap-4">
                    {/* Assignee Dropdown - Premium Custom */}
                    <div className="relative">
                        <button
                            onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                            className="flex items-center gap-2 bg-card border border-border hover:border-emerald-500/30 rounded-lg px-3 py-2 h-9 shadow-sm transition-all min-w-[140px]"
                        >
                            <UserCircle size={16} className="text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground flex-1 text-left">
                                {assigneeFilter === 'all'
                                    ? 'Resp: Todos'
                                    : assignees.find(u => u.id === assigneeFilter)?.name.split(' ')[0] || 'Todos'}
                            </span>
                            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isAssigneeOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsAssigneeOpen(false)} />
                                <div className="absolute top-full right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-xl z-50 p-2 transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Responsável</div>
                                    <div className="space-y-0.5">
                                        <button
                                            onClick={() => { setAssigneeFilter('all'); setIsAssigneeOpen(false); }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                                assigneeFilter === 'all'
                                                    ? "bg-emerald-600 dark:bg-emerald-500 text-white font-semibold shadow-sm"
                                                    : "text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
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
                                                        ? "bg-emerald-600 dark:bg-emerald-500 text-white font-semibold shadow-sm"
                                                        : "text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                                                )}
                                            >
                                                <span>{u.name.split(' ')[0]}</span>
                                                {assigneeFilter === u.id && <CheckCircle2 size={16} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="h-6 w-px bg-border" />

                    {/* Date Display - Premium */}
                    <div className="flex flex-col items-end leading-none">
                        <span className="text-base font-bold text-foreground tracking-tight">
                            {format(new Date(), 'dd/MM', { locale: ptBR })}
                        </span>
                        <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-500 tracking-wider">
                            {format(new Date(), 'EEE', { locale: ptBR }).replace('.', '')}
                        </span>
                    </div>

                    {/* Refresh Button - Premium */}
                    <button
                        onClick={loadDashboard}
                        className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors group"
                    >
                        <RefreshCw size={16} className={cn(
                            "text-muted-foreground group-hover:text-foreground transition-colors",
                            loading && "animate-spin"
                        )} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full bg-background flex flex-col overflow-y-auto custom-scrollbar">
            {/* Main Area */}
            <div className="p-6 pt-0 w-full animate-in fade-in duration-500">

                {/* Filters Row (Top) */}
                {FilterBar()}

                {/* Content - Compact & High Density */}
                <div className="pt-6 pb-12">
                    <ZoneSection title="VENCIDOS" items={overdueItems} variant="danger" />
                    <ZoneSection title="VENCE HOJE" items={todayItems} variant="warning" />
                    <ZoneSection title={`PRÓXIMOS ${horizon} DIAS`} items={upcomingItems} variant="info" />
                </div>
            </div>

            <DrilldownModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type={modalState.type}
                data={modalState.data}
                users={users}
            />
        </div>
    );
};

