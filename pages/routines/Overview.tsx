import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Task, Project, Delegation, User } from '../../types';
import { Loader, Card, cn, Button, Select, Avatar, Badge } from '../../components/Shared';
import { FilterSelect } from '../../components/FilterSelect';
import { DrilldownModal } from '../../components/Modals';
import { useAuth } from '../../context/AuthContext';
import { useRBAC } from '../../context/RBACContext';
import { useNavigate } from 'react-router-dom';
import {
    CheckSquare,
    Briefcase,
    AlertCircle,
    Clock,
    CheckCircle2,
    BarChart2,
    Filter,
    ArrowRight,
    Users,
    FileText,
    User as UserIcon
} from 'lucide-react';
import { RoutineReportModal } from '../../components/Reports/RoutineReportModal';
import {
    startOfWeek,
    endOfWeek,
    isWithinInterval,
    parseISO,
    startOfMonth,
    endOfMonth,
    isToday,
    isBefore,
    startOfDay
} from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate' | 'orange' | 'red';
    subtitle?: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const themes = {
        emerald: { header: 'bg-emerald-500', text: 'text-emerald-500', border: 'hover:border-emerald-500/50' },
        rose: { header: 'bg-rose-500', text: 'text-rose-500', border: 'hover:border-rose-500/50' },
        amber: { header: 'bg-amber-500', text: 'text-amber-500', border: 'hover:border-amber-500/50' },
        indigo: { header: 'bg-indigo-500', text: 'text-indigo-500', border: 'hover:border-indigo-500/50' },
        slate: { header: 'bg-slate-500', text: 'text-slate-500', border: 'hover:border-slate-500/50' },
        orange: { header: 'bg-orange-500', text: 'text-orange-500', border: 'hover:border-orange-500/50' },
        red: { header: 'bg-red-500', text: 'text-red-500', border: 'hover:border-red-500/50' },
    };
    const theme = themes[color];

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-card border border-border rounded-xl flex flex-col justify-between h-full cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group shadow-sm",
                theme.border,
                onClick ? "cursor-pointer" : ""
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
            <div className="p-6 pt-5 flex flex-col gap-1 relative">
                <div className={cn("text-3xl font-black tracking-tighter transition-colors", theme.text)}>
                    {value}
                </div>
                {subtitle && <span className="text-[10px] uppercase font-bold text-muted-foreground opacity-70">{subtitle}</span>}

                {onClick && (
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight size={18} className="text-muted-foreground" />
                    </div>
                )}
            </div>
        </div>
    );
};

export const RoutinesOverview: React.FC = () => {
    const { user } = useAuth();
    const { isAdmin } = useRBAC();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);

    // Filter State
    const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month'>('month');
    const [selectedAssignee, setSelectedAssignee] = useState<string>('all');

    // Modal State
    const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, type: 'tasks', data: any[] }>({
        isOpen: false, title: '', type: 'tasks', data: []
    });

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [t, p, d, u] = await Promise.all([
                api.getTasks(),
                api.getProjects(),
                api.getMyDelegations(),
                api.getUsers()
            ]);
            setTasks(t);
            setProjects(p);
            setDelegations(d);
            setUsersList(u);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Build Available Users List for Filter ---
    const getAvailableUsers = () => {
        if (isAdmin) return usersList;
        if (!user) return [];

        const allowedIds = [user.id];
        delegations.forEach(d => {
            if (d.module === 'tasks' && d.permissions.view) {
                allowedIds.push(d.ownerId);
            }
        });

        // Return unique users
        return usersList.filter(u => allowedIds.includes(u.id));
    };

    const availableUsers = getAvailableUsers();

    // --- Filtering Logic (RBAC + Delegation + Filters) ---
    const getVisibleData = () => {
        if (!user) return { scopedTasks: [], visibleTasks: [], visibleProjects: [] };

        let scopedTasks = tasks;
        let visibleProjects = projects;

        // 1. RBAC & Delegation Scope
        if (!isAdmin) {
            const allowedUserIds = [user.id];
            delegations.forEach(del => {
                if (del.module === 'tasks' && del.permissions.view) {
                    allowedUserIds.push(del.ownerId);
                }
            });
            scopedTasks = tasks.filter(t => allowedUserIds.includes(t.assigneeId));
            visibleProjects = projects.filter(p => p.members.includes(user.id));
        }

        // 2. Assignee Filter
        if (selectedAssignee !== 'all') {
            scopedTasks = scopedTasks.filter(t => t.assigneeId === selectedAssignee);
            visibleProjects = visibleProjects.filter(p => p.members.includes(selectedAssignee));
        }

        // 3. Apply Time Period Filter (For Dashboard Display Only)
        let visibleTasks = scopedTasks;
        const now = new Date();
        if (period === 'today') {
            visibleTasks = scopedTasks.filter(t => isToday(parseISO(t.dueDate)));
        } else if (period === 'week') {
            visibleTasks = scopedTasks.filter(t => isWithinInterval(parseISO(t.dueDate), { start: startOfWeek(now), end: endOfWeek(now) }));
        } else if (period === 'month') {
            visibleTasks = scopedTasks.filter(t => isWithinInterval(parseISO(t.dueDate), { start: startOfMonth(now), end: endOfMonth(now) }));
        }

        return { scopedTasks, visibleTasks, visibleProjects };
    };

    const { scopedTasks, visibleTasks, visibleProjects } = getVisibleData();

    // --- Metrics Calculations ---
    const now = new Date();
    const startOfToday = startOfDay(now);

    const activeProjectsCount = visibleProjects.filter(p => p.status === 'active').length;

    const totalDone = visibleTasks.filter(t => t.status === 'done').length;

    const totalOverdue = visibleTasks.filter(t =>
        t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday)
    ).length;

    const totalDueSoon = visibleTasks.filter(t =>
        t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday)
    ).length;

    // --- Modal Handler ---
    const openDrilldown = (title: string, filterFn: (t: Task) => boolean) => {
        const data = visibleTasks.filter(filterFn);
        setModalState({ isOpen: true, title, type: 'tasks', data });
    };

    // --- Charts Data ---
    const priorityData = [
        { name: 'Baixa', value: visibleTasks.filter(t => t.priority === 'low' && t.status !== 'done').length },
        { name: 'Média', value: visibleTasks.filter(t => t.priority === 'medium' && t.status !== 'done').length },
        { name: 'Alta', value: visibleTasks.filter(t => t.priority === 'high' && t.status !== 'done').length },
        { name: 'Urgente', value: visibleTasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length },
    ];

    const statusData = [
        { name: 'A Vencer', value: totalDueSoon, color: '#f97316' }, // Orange
        { name: 'Vencidos', value: totalOverdue, color: '#ef4444' }, // Red
        { name: 'Concluídos', value: totalDone, color: '#10b981' }, // Emerald
    ].filter(d => d.value > 0);

    const upcomingTasks = visibleTasks
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5);

    const getUser = (id: string) => usersList.find(u => u.id === id);

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2 bg-background text-foreground">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <CheckSquare className="text-emerald-500" /> Dashboard de Rotinas
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isAdmin ? 'Visão global administrativa' : 'Acompanhamento de tarefas e projetos'}
                    </p>
                </div>

                <div className="flex gap-3">
                    {/* Report Button */}
                    <Button
                        variant="ghost"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-card border border-border hover:bg-secondary text-foreground"
                    >
                        <FileText size={16} className="mr-2 text-indigo-500" /> Relatórios
                    </Button>

                    {/* User Filter */}
                    <FilterSelect
                        inlineLabel="Resp:"
                        icon={<UserIcon size={14} />}
                        value={selectedAssignee}
                        onChange={setSelectedAssignee}
                        options={[
                            { value: 'all', label: 'Todos' },
                            ...availableUsers.map(u => ({ value: u.id, label: u.name, avatarUrl: u.avatarUrl }))
                        ]}
                        darkMode={true}
                        className="min-w-[180px]"
                    />

                    {/* Period Filter */}
                    <FilterSelect
                        inlineLabel="Período:"
                        value={period}
                        onChange={(val) => setPeriod(val as any)}
                        options={[
                            { value: 'week', label: 'Semanal' },
                            { value: 'month', label: 'Mensal' },
                            { value: 'year', label: 'Anual' }
                        ]}
                        darkMode={true}
                        className="min-w-[160px]"
                    />
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Projetos Ativos"
                    value={activeProjectsCount}
                    icon={<Briefcase size={20} />}
                    color="indigo"
                    subtitle="Em andamento"
                    onClick={() => navigate('/projects')}
                />
                <StatCard
                    title="A Vencer"
                    value={totalDueSoon}
                    icon={<Clock size={20} />}
                    color="orange"
                    subtitle="Dentro do prazo"
                    onClick={() => openDrilldown('Tarefas a Vencer', t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))}
                />
                <StatCard
                    title="Vencidos"
                    value={totalOverdue}
                    icon={<AlertCircle size={20} />}
                    color="red"
                    subtitle="Prazo expirado"
                    onClick={() => openDrilldown('Tarefas Vencidas', t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))}
                />
                <StatCard
                    title="Concluídos"
                    value={totalDone}
                    icon={<CheckCircle2 size={20} />}
                    color="emerald"
                    subtitle={period === 'all' ? 'Total histórico' : 'Neste período'}
                    onClick={() => openDrilldown('Tarefas Concluídas', t => t.status === 'done')}
                />
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 gap-6">
                {/* Status Distribution */}
                <Card className="min-h-[350px] flex flex-col" variant="solid">
                    <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                        <BarChart2 size={18} className="text-indigo-500" /> Distribuição por Status
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="99%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* UPCOMING TASKS LIST */}
            <Card className="p-0 overflow-hidden" variant="solid">
                <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/20">
                    <h3 className="text-lg font-bold text-foreground">Próximas Entregas</h3>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/tasks')}>Ver Tudo <ArrowRight size={14} className="ml-1" /></Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-muted-foreground">
                        <thead className="bg-secondary/50 text-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Tarefa</th>
                                <th className="px-6 py-4">Responsável</th>
                                <th className="px-6 py-4">Prazo</th>
                                <th className="px-6 py-4 text-right">Prioridade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {upcomingTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                                        Nenhuma tarefa pendente no período selecionado.
                                    </td>
                                </tr>
                            ) : (
                                upcomingTasks.map(task => {
                                    const assignee = getUser(task.assigneeId);
                                    const isOverdue = isBefore(parseISO(task.dueDate), startOfDay(new Date()));

                                    return (
                                        <tr
                                            key={task.id}
                                            className={cn(
                                                "transition-colors cursor-pointer border-l-4",
                                                isOverdue
                                                    ? "bg-rose-500/10 hover:bg-rose-500/20 border-l-rose-500"
                                                    : "bg-transparent hover:bg-secondary/30 border-l-transparent"
                                            )}
                                            onClick={() => navigate('/tasks', { state: { taskId: task.id } })}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-foreground">{task.title}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{task.description}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar src={assignee.avatarUrl} name={assignee.name} size="sm" />
                                                        <span className="text-xs">{assignee.name}</span>
                                                    </div>
                                                ) : <span className="text-xs italic">--</span>}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">
                                                <div className={isOverdue ? 'text-rose-500 font-bold flex flex-col' : 'text-foreground'}>
                                                    <div className="flex items-center gap-1">
                                                        {isOverdue && <AlertCircle size={12} />}
                                                        {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    {isOverdue && <span className="text-[9px] uppercase tracking-wider font-extrabold mt-0.5">Vencido</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Badge variant={
                                                    task.priority === 'urgent' ? 'error' :
                                                        task.priority === 'high' ? 'warning' :
                                                            task.priority === 'medium' ? 'info' :
                                                                'success'
                                                }>
                                                    {task.priority === 'urgent' ? 'Urgente' :
                                                        task.priority === 'high' ? 'Alta' :
                                                            task.priority === 'medium' ? 'Média' :
                                                                'Baixa'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <DrilldownModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type="tasks"
                data={modalState.data}
                users={usersList}
            />

            <RoutineReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                tasks={scopedTasks} // Pass SCOPED tasks (ignoring dashboard period) so the Report can do its own date filtering
                projects={projects}
                users={usersList}
            />
        </div>
    );
};
