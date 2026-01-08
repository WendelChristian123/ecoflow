
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
import { parseISO, isBefore, isSameDay, addDays, isWithinInterval, startOfDay, format, setDate, addMonths, isAfter } from 'date-fns';
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
                // STRICT DATE FIX: If string contains T, start by extracting date part only to avoid Timezone Shift on Due Dates
                // This assumes string is ISO. If we parse ISO with 'Z', it shifts to local time (e.g. yesterday).
                // By taking just YYYY-MM-DD, parseISO parses it as Local Midnight, preserving the calendar date.
                const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                date = parseISO(raw);
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

        // 3. Generate Virtual Items for Credit Card Bills
        const virtualBills: any[] = [];
        if (enableFinance) {
            const today = new Date();
            cards.forEach(card => {
                // Generate for current and next month to cover standard horizons
                [0, 1].forEach(offset => {
                    const targetMonth = addMonths(today, offset);
                    // Handle Due Day rollover if day doesn't exist (e.g. Feb 30) - setDate handles it by overflow, usually okay
                    const dueDate = setDate(targetMonth, card.dueDay);

                    // Sum of all unpaid expenses for this card that are due on or before this bill's due date
                    const billAmount = transactions
                        .filter(t =>
                            t.creditCardId === card.id &&
                            t.type === 'expense' &&
                            !t.isPaid &&
                            isBefore(parseISO(t.date), addDays(dueDate, 1))
                        )
                        .reduce((sum, t) => sum + t.amount, 0);

                    // Only add if it falls in the relevant date logic
                    const status = getDeadlineStatus(dueDate, false);
                    if (status === zone) {
                        virtualBills.push({
                            id: `bill-${card.id}-${offset}`,
                            title: `Fatura: ${card.name}`,
                            description: `Fatura: ${card.name} (Vence dia ${card.dueDay})`, // Use Description for list display
                            amount: billAmount,
                            type: 'expense',
                            date: format(dueDate, 'yyyy-MM-dd'),
                            isPaid: false,
                            category: 'Cartão de Crédito',
                            isVirtualBill: true,
                            creditCardId: card.id
                        });
                    }
                });
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

        const zoneFinance = enableFinance ? transactions.filter(t => {
            if (assigneeFilter !== 'all') return false; // Hide finance when filtering by user
            if (t.isPaid) return false;
            // Exclude individual credit card purchases from the radar to reduce noise
            if (t.originType === 'credit_card' || t.creditCardId) return false;
            if (!t.date) return false;
            return getDeadlineStatus(t.date, t.isPaid) === zone;
        }) : [];

        // Merge real finance items with virtual bills
        const combinedFinance = [...zoneFinance, ...virtualBills];

        return { tasks: zoneTasks, events: zoneEvents, quotes: zoneQuotes, finance: combinedFinance };
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

        // Premium Dark Cards - Compact
        const activeClasses = "bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600 transition-all shadow-sm group";

        const countColors = {
            danger: "text-rose-400 drop-shadow-[0_2px_10px_rgba(251,113,133,0.15)]",
            warning: "text-orange-400 drop-shadow-[0_2px_10px_rgba(251,146,60,0.15)]",
            info: "text-amber-200 drop-shadow-[0_2px_10px_rgba(253,230,138,0.15)]"
        };

        const iconClasses = cn(
            "transition-colors duration-300",
            variant === 'danger' ? "text-rose-500/80 group-hover:text-rose-400" :
                variant === 'warning' ? "text-orange-500/80 group-hover:text-orange-400" :
                    "text-indigo-400/80 group-hover:text-indigo-300"
        );

        return (
            <div
                onClick={onClick}
                className={cn(
                    "relative overflow-hidden rounded-xl p-4 flex flex-col justify-between cursor-pointer h-24 select-none",
                    activeClasses
                )}
            >
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
                        {title}
                    </span>
                    <div className={cn("p-1.5 rounded-md bg-slate-900/50", iconClasses)}>
                        {icon}
                    </div>
                </div>

                <div className="mt-auto flex items-baseline gap-2">
                    <span className={cn("text-3xl font-black tracking-tighter", countColors[variant])}>
                        {count}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Pendentes</span>
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

        // Refined Block Styles
        // darker background, full border, cleaner look
        const sectionBase = "relative p-5 rounded-xl border border-slate-800/40 mb-6 bg-[#0B0D12]";
        const borderColors = {
            danger: "border-l-4 border-l-rose-500 shadow-[inset_4px_0_0_0_rgba(244,63,94,0.1)]",
            warning: "border-l-4 border-l-orange-500 shadow-[inset_4px_0_0_0_rgba(249,115,22,0.1)]",
            info: "border-l-4 border-l-amber-300 shadow-[inset_4px_0_0_0_rgba(252,211,77,0.1)]"
        };

        const titleColors = {
            danger: "text-rose-400",
            warning: "text-orange-400",
            info: "text-amber-200"
        };

        const emptyText = {
            danger: "Excelente! Nenhum item vencido.",
            warning: "Agenda livre por hoje.",
            info: "Sem pendências para os próximos dias."
        };

        const EmptyState = () => (
            <div className="flex items-center gap-3 text-slate-500 italic text-sm py-4 px-4 border border-slate-800/30 rounded-lg bg-slate-900/30">
                <CheckCircle2 size={16} />
                {emptyText[variant]}
            </div>
        );

        return (
            <section className={cn(sectionBase, borderColors[variant])}>
                <div className="flex items-center gap-3 mb-5">
                    <div className={cn("text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2", titleColors[variant])}>
                        {title}
                    </div>
                </div>

                {hasItems ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
                        <ZoneCard title="Tarefas" count={items.tasks.length} icon={<List size={18} />} type="task" variant={variant} onClick={() => openDrilldown('Tarefas', 'tasks', items.tasks)} />
                        <ZoneCard title="Compromissos" count={items.events.length} icon={<CalendarIcon size={18} />} type="event" variant={variant} onClick={() => openDrilldown('Compromissos', 'events', items.events)} />
                        <ZoneCard title="Financeiro" count={items.finance.length} icon={<Wallet size={18} />} type="finance" variant={variant} onClick={() => openDrilldown('Contas', 'finance', items.finance)} />
                        <ZoneCard title="Orçamentos" count={items.quotes.length} icon={<FileText size={18} />} type="quote" variant={variant} onClick={() => openDrilldown('Orçamentos', 'quotes', items.quotes)} />
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
                <div className="p-6 bg-slate-800 rounded-full border-4 border-slate-700 shadow-2xl">
                    <Building2 size={64} className="text-indigo-400" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-3xl font-bold text-white">Bem-vindo, Super Admin</h2>
                    <p className="text-slate-400">
                        Você ainda não selecionou uma empresa para gerenciar. Escolha uma existente no menu lateral ou crie uma nova.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button onClick={() => navigate('/super-admin/dashboard')} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
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
                <AlertCircle size={48} className="text-slate-500 mb-4" />
                <h3 className="text-xl font-bold text-white">Nenhuma empresa vinculada</h3>
                <p className="text-slate-400 mt-2">Contate o administrador para liberar seu acesso.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="p-4 bg-rose-500/10 rounded-full text-rose-500">
                    <AlertTriangle size={48} />
                </div>
                <div className="text-center max-w-lg">
                    <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar Dashboard</h3>
                    <div className="text-slate-400 text-sm font-mono bg-slate-900 p-4 rounded-lg border border-slate-800 break-words max-h-48 overflow-y-auto custom-scrollbar">
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
            <div className="sticky top-0 z-30 bg-[#05060A]/95 backdrop-blur-md py-4 -mx-6 px-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 flex-wrap py-1">
                    <Filter size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider mr-2">Filtros</span>

                    {/* Modules Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsModulesOpen(!isModulesOpen)}
                            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all"
                        >
                            <Layers size={14} className="text-indigo-400" />
                            <span>Módulos ({selectedModules.length})</span>
                            <ChevronDown size={12} className={`transition-transform ${isModulesOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isModulesOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsModulesOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 p-2 transform origin-top-left animate-in fade-in zoom-in-95 duration-200">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 pt-1">Exibir Módulos</div>
                                    <div className="space-y-1">
                                        {['tasks', 'events', 'finance', 'quotes'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => toggleModule(m)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors",
                                                    selectedModules.includes(m) ? "bg-indigo-500/10 text-indigo-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
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

                    <div className="w-px h-4 bg-slate-800 mx-1" />

                    {/* Horizon Toggle */}
                    <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-800 gap-0.5">
                        {[3, 7, 15, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setHorizon(d as any)}
                                className={cn(
                                    "px-3 py-1 text-[10px] rounded-[4px] transition-all font-bold",
                                    horizon === d ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
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
                        <UserCircle size={14} className="text-slate-500" />
                        <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className="bg-slate-900 border-none text-slate-300 text-[10px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase tracking-wide font-medium cursor-pointer hover:bg-slate-800 transition-colors"
                        >
                            <option value="all">Resp: Todos</option>
                            {assignees.map(u => (
                                <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-4 w-px bg-slate-800" />

                    <div className="text-right flex flex-col leading-none">
                        <span className="text-sm font-bold text-slate-200 tracking-tighter">
                            {format(new Date(), 'dd/MM', { locale: ptBR })}
                        </span>
                        <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">
                            {format(new Date(), 'EEE', { locale: ptBR }).replace('.', '')}
                        </span>
                    </div>

                    <Button onClick={loadDashboard} variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-slate-800 text-slate-400">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-[#05060A] flex flex-col overflow-y-auto custom-scrollbar">
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
