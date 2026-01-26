
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

        // Semantic Colors only for Icons and Text
        const colorMap = {
            danger: { text: "text-destructive", bg: "bg-destructive/10", border: "group-hover:border-destructive/30" },
            warning: { text: "text-amber-500", bg: "bg-amber-500/10", border: "group-hover:border-amber-500/30" },
            info: { text: "text-primary", bg: "bg-primary/10", border: "group-hover:border-primary/30" }
        };

        const theme = colorMap[variant];

        // Standard Card Structure
        return (
            <div
                onClick={onClick}
                className={cn(
                    "bg-card border border-border shadow-sm rounded-xl p-5 flex flex-col justify-between cursor-pointer h-32 select-none group transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
                    theme.border // Subtle border interaction
                )}
            >
                <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                        {title}
                    </span>
                    <div className={cn("p-2 rounded-lg transition-colors", theme.bg, theme.text)}>
                        {icon}
                    </div>
                </div>

                <div className="mt-auto">
                    <div className={cn("text-3xl font-black tracking-tighter leading-none mb-1", theme.text)}>
                        {count}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Pendentes</span>
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
            danger: "text-destructive border-l-destructive",
            warning: "text-amber-500 border-l-amber-500",
            info: "text-primary border-l-primary"
        };

        const EmptyState = () => (
            <div className="flex items-center gap-3 text-muted-foreground italic text-sm py-4 px-4 border border-dashed border-border rounded-xl bg-secondary/20">
                <CheckCircle2 size={18} className="opacity-50" />
                <span>{variant === 'danger' ? "Excelente! Nenhum item vencido." : variant === 'warning' ? "Agenda livre por hoje." : "Sem pendências para os próximos dias."}</span>
            </div>
        );

        return (
            <section className="mb-8">
                <div className="flex items-center gap-3 mb-4 pl-1">
                    <div className={cn("w-1 h-4 rounded-full", variant === 'danger' ? 'bg-destructive' : variant === 'warning' ? 'bg-amber-500' : 'bg-primary')}></div>
                    <div className={cn("text-sm font-bold uppercase tracking-widest", variant === 'danger' ? 'text-destructive' : variant === 'warning' ? 'text-amber-500' : 'text-primary')}>
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

    // --- Filter Bar Component (Compact) ---
    const FilterBar = () => {
        const moduleNames: Record<string, string> = { tasks: 'Tarefas', events: 'Agenda', finance: 'Financeiro', quotes: 'Orçamentos' };

        return (
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md py-4 -mx-6 px-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm border-b border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground flex-wrap py-1">
                    <Filter size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider mr-2">Filtros</span>

                    {/* Modules Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsModulesOpen(!isModulesOpen)}
                            className="flex items-center gap-2 bg-secondary/50 border border-border hover:bg-secondary text-foreground px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all"
                        >
                            <Layers size={14} className="text-primary" />
                            <span>Módulos ({selectedModules.length})</span>
                            <ChevronDown size={12} className={`transition-transform ${isModulesOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isModulesOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsModulesOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 p-2 transform origin-top-left animate-in fade-in zoom-in-95 duration-200">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2 pt-1">Exibir Módulos</div>
                                    <div className="space-y-1">
                                        {['tasks', 'events', 'finance', 'quotes'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => toggleModule(m)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors",
                                                    selectedModules.includes(m) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                                )}
                                            >
                                                <span className="font-medium">{moduleNames[m]}</span>
                                                {selectedModules.includes(m) && <CheckCircle2 size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Horizon Toggle */}
                    <div className="flex bg-secondary rounded-md p-0.5 border border-border gap-0.5">
                        {[3, 7, 15, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setHorizon(d as any)}
                                className={cn(
                                    "px-3 py-1 text-[10px] rounded-[4px] transition-all font-bold",
                                    horizon === d ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Side: Assignee & Date */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <UserCircle size={14} className="text-muted-foreground" />
                        <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className="bg-card border border-border text-foreground text-[10px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring uppercase tracking-wide font-medium cursor-pointer hover:bg-secondary transition-colors shadow-sm"
                        >
                            <option value="all" className="bg-card text-foreground">Resp: Todos</option>
                            {assignees.map(u => (
                                <option key={u.id} value={u.id} className="bg-card text-foreground">{u.name.split(' ')[0]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-4 w-px bg-border" />

                    <div className="text-right flex flex-col leading-none">
                        <span className="text-sm font-bold text-foreground tracking-tighter">
                            {format(new Date(), 'dd/MM', { locale: ptBR })}
                        </span>
                        <span className="text-[9px] text-primary font-bold uppercase tracking-widest">
                            {format(new Date(), 'EEE', { locale: ptBR }).replace('.', '')}
                        </span>
                    </div>

                    <Button onClick={loadDashboard} variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-secondary text-muted-foreground">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </Button>
                </div>
            </div>
        );
    }

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

