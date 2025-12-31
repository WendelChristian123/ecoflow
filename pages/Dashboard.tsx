
import React, { useEffect, useState } from 'react';
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar as CalendarIcon,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Wallet,
    AlertTriangle,
    ArrowRight,
    List,
    RefreshCw,
    FileText,
    ThumbsUp,
    XCircle,
    Building2,
    Plus
} from 'lucide-react';
import { Loader, cn, Button } from '../components/Shared';
import { DrilldownModal } from '../components/Modals';
import { api, getErrorMessage } from '../services/api';
import { DashboardMetrics, Task, CalendarEvent, FinancialTransaction, Quote } from '../types';
import { useNavigate } from 'react-router-dom';
import { parseISO, isBefore, isSameDay, addDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../context/RBACContext';

// ... SummaryCard and SectionHeader components ...
const SummaryCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate' | 'blue';
    subtitle?: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const colors = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-slate-800 border border-slate-700/50 p-5 rounded-xl transition-all relative overflow-hidden group",
                onClick && "cursor-pointer hover:bg-slate-700/50 hover:border-slate-600"
            )}
        >
            <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <div className={cn("p-2 rounded-lg", colors[color])}>{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
            </div>
            {onClick && (
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={16} className="text-slate-400" />
                </div>
            )}
        </div>
    );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
        <div className="text-emerald-500">{icon}</div>
        <h2 className="text-lg font-bold text-white uppercase tracking-wider text-xs">{title}</h2>
    </div>
);

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { currentTenant, loading: tenantLoading } = useTenant();
    const { isSuperAdmin } = useRBAC();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

    // Data for Modals
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);

    // Modal State
    const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, type: 'tasks' | 'events' | 'finance' | 'quotes', data: any[] }>({
        isOpen: false, title: '', type: 'tasks', data: []
    });

    useEffect(() => {
        if (tenantLoading) return; // Wait for tenant to resolve

        if (currentTenant) {
            loadDashboard();
        } else {
            setLoading(false); // No tenant, stop loading UI
        }
    }, [currentTenant, tenantLoading]);

    const loadDashboard = async () => {
        if (!currentTenant) return;
        setLoading(true);
        setError(null);
        try {
            const m = await api.getDashboardMetrics(currentTenant.id);
            setMetrics(m);

            const [t, e, tr, q] = await Promise.all([
                api.getTasks(currentTenant.id).catch(() => []),
                api.getEvents(currentTenant.id).catch(() => []),
                api.getFinancialTransactions(currentTenant.id).catch(() => []),
                api.getQuotes(currentTenant.id).catch(() => [])
            ]);
            setTasks(t);
            setEvents(e);
            setTransactions(tr);
            setQuotes(q);
        } catch (error: any) {
            console.error("Erro ao carregar dashboard:", error);
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const openModal = (title: string, type: 'tasks' | 'events' | 'finance' | 'quotes', filterFn: (item: any) => boolean) => {
        let data: any[] = [];
        if (type === 'tasks') data = tasks.filter(filterFn);
        if (type === 'events') data = events.filter(filterFn);
        if (type === 'finance') data = transactions.filter(filterFn);
        if (type === 'quotes') data = quotes.filter(filterFn);

        setModalState({ isOpen: true, title, type, data });
    };

    const todayStart = startOfDay(new Date());
    const next7DaysEnd = endOfDay(addDays(new Date(), 7));

    // --- Loading State ---
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
            </div>
        );
    }

    if (!metrics) return null;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-10">

            {/* BLOCO 1 - TAREFAS */}
            <section>
                <SectionHeader icon={<CheckCircle2 size={20} />} title="Gestão de Tarefas" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                        title="Total de Tarefas"
                        value={metrics.tasks.total}
                        icon={<List size={20} />}
                        color="slate"
                        onClick={() => openModal('Todas as Tarefas', 'tasks', () => true)}
                    />
                    <SummaryCard
                        title="Pendentes"
                        value={metrics.tasks.pending}
                        icon={<Clock size={20} />}
                        color="amber"
                        subtitle="Aguardando ação"
                        onClick={() => openModal('Tarefas Pendentes', 'tasks', (t) => t.status !== 'done')}
                    />
                    <SummaryCard
                        title="Concluídas"
                        value={metrics.tasks.completed}
                        icon={<CheckCircle2 size={20} />}
                        color="emerald"
                        onClick={() => openModal('Tarefas Concluídas', 'tasks', (t) => t.status === 'done')}
                    />
                    <SummaryCard
                        title="Urgentes"
                        value={metrics.tasks.urgent}
                        icon={<AlertCircle size={20} />}
                        color="rose"
                        subtitle="Prioridade máxima"
                        onClick={() => openModal('Tarefas Urgentes', 'tasks', (t) => t.priority === 'urgent' && t.status !== 'done')}
                    />
                </div>
            </section>

            {/* BLOCO 2 - COMPROMISSOS */}
            <section>
                <SectionHeader icon={<CalendarIcon size={20} />} title="Agenda & Compromissos" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard
                        title="Hoje"
                        value={metrics.agenda.today}
                        icon={<CalendarIcon size={20} />}
                        color="indigo"
                        subtitle="Eventos para hoje"
                        onClick={() => openModal('Eventos de Hoje', 'events', (e) => {
                            return isSameDay(parseISO(e.startDate), new Date());
                        })}
                    />
                    <SummaryCard
                        title="Próximos 7 Dias"
                        value={metrics.agenda.next7Days}
                        icon={<ArrowRight size={20} />}
                        color="slate"
                        onClick={() => navigate('/agenda')}
                    />
                    <SummaryCard
                        title="Atrasados"
                        value={metrics.agenda.overdue}
                        icon={<AlertTriangle size={20} />}
                        color="rose"
                        subtitle="Precisam de atenção"
                        onClick={() => openModal('Eventos Atrasados', 'events', (e) => isBefore(parseISO(e.endDate), new Date()) && e.status !== 'completed')}
                    />
                </div>
            </section>

            {/* BLOCO 3 - GESTÃO COMERCIAL / ORÇAMENTOS (NOVO) */}
            <section>
                <SectionHeader icon={<FileText size={20} />} title="Gestão Comercial / Orçamentos" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                        title="Total de Orçamentos"
                        value={metrics.commercial.totalQuotes}
                        icon={<List size={20} />}
                        color="slate"
                        onClick={() => openModal('Todos os Orçamentos', 'quotes', () => true)}
                    />
                    <SummaryCard
                        title="Em Aberto"
                        value={metrics.commercial.pendingQuotes}
                        icon={<Clock size={20} />}
                        color="blue"
                        subtitle="Rascunho ou Enviado"
                        onClick={() => openModal('Orçamentos em Aberto', 'quotes', (q) => q.status === 'draft' || q.status === 'sent')}
                    />
                    <SummaryCard
                        title="Aprovados"
                        value={metrics.commercial.approvedQuotes}
                        icon={<ThumbsUp size={20} />}
                        color="emerald"
                        subtitle={`Total: ${fmt(metrics.commercial.convertedValue)}`}
                        onClick={() => openModal('Orçamentos Aprovados', 'quotes', (q) => q.status === 'approved')}
                    />
                    <SummaryCard
                        title="Rejeitados/Exp."
                        value={quotes.filter(q => q.status === 'rejected' || q.status === 'expired').length}
                        icon={<XCircle size={20} />}
                        color="rose"
                        subtitle="Perdidos"
                        onClick={() => openModal('Orçamentos Rejeitados', 'quotes', (q) => q.status === 'rejected' || q.status === 'expired')}
                    />
                </div>
            </section>

            {/* BLOCO 4 - FINANCEIRO */}
            <section>
                <SectionHeader icon={<DollarSign size={20} />} title="Visão Financeira" />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {/* Main Balance Card */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-xl flex items-center justify-between col-span-1 lg:col-span-1">
                        <div>
                            <p className="text-slate-400 font-medium text-sm mb-1">Saldo Atual Total</p>
                            <h3 className={cn("text-3xl font-bold", metrics.financial.balance >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {fmt(metrics.financial.balance)}
                            </h3>
                        </div>
                        <div className="p-3 bg-slate-700/50 rounded-lg">
                            <Wallet size={32} className="text-white" />
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SummaryCard
                            title="Contas Vencidas"
                            value={fmt(metrics.financial.overdueBills)}
                            icon={<AlertCircle size={20} />}
                            color="rose"
                            onClick={() => openModal('Contas Vencidas', 'finance', (t) => t.type === 'expense' && !t.isPaid && isBefore(parseISO(t.date), todayStart))}
                        />
                        <SummaryCard
                            title="A Pagar (7 dias)"
                            value={fmt(metrics.financial.dueIn7Days)}
                            icon={<TrendingDown size={20} />}
                            color="amber"
                            onClick={() => openModal('A Pagar (Próx. 7 dias)', 'finance', (t) => {
                                return t.type === 'expense' && !t.isPaid && isWithinInterval(parseISO(t.date), { start: todayStart, end: next7DaysEnd });
                            })}
                        />
                        <SummaryCard
                            title="A Receber Vencidas"
                            value={fmt(metrics.financial.overdueReceivables)}
                            icon={<AlertCircle size={20} />}
                            color="rose"
                            onClick={() => openModal('Receitas Vencidas', 'finance', (t) => t.type === 'income' && !t.isPaid && isBefore(parseISO(t.date), todayStart))}
                        />
                        <SummaryCard
                            title="A Receber (7 dias)"
                            value={fmt(metrics.financial.receivablesIn7Days)}
                            icon={<Clock size={20} />}
                            color="indigo"
                            onClick={() => openModal('A Receber (Próx. 7 dias)', 'finance', (t) => {
                                return t.type === 'income' && !t.isPaid && isWithinInterval(parseISO(t.date), { start: todayStart, end: next7DaysEnd });
                            })}
                        />
                    </div>
                </div>
            </section>

            <DrilldownModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type={modalState.type}
                data={modalState.data}
            />
        </div>
    );
};
