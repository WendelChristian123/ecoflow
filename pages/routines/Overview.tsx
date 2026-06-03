import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Task, Project, User, Team } from '../../types';
import { Loader, Card, cn, Button, Select, Avatar, Badge, StatCard } from '../../components/Shared';
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



export const RoutinesOverview: React.FC = () => {
    const { user } = useAuth();
    const { isAdmin } = useRBAC();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [delegatorIds, setDelegatorIds] = useState<string[]>([]);
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
            const [t, p, dIds, u, tm] = await Promise.all([
                api.getTasks(),
                api.getProjects(),
                api.getDelegators('tasks'),
                api.getUsers(),
                api.getTeams()
            ]);
            setTasks(t);
            setProjects(p);
            setDelegatorIds(dIds);
            setUsersList(u);
            setTeams(tm);
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

        const allowedIds = [user.id, ...delegatorIds];

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
            const allowedUserIds = [user.id, ...delegatorIds];
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
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2 text-foreground">
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
                            ...availableUsers.map(u => ({ value: u.id, label: u.name || u.email || 'Usuário', avatarUrl: u.avatarUrl }))
                        ]}
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
                        className="min-w-[160px]"
                    />
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div onClick={() => navigate('/projects')} className="cursor-pointer">
                    <StatCard
                        title="Projetos Ativos"
                        value={activeProjectsCount}
                        icon={Briefcase}
                        iconColorClass="text-indigo-500 bg-indigo-500/10"
                        subtitle="Em andamento"
                    />
                </div>
                <div onClick={() => openDrilldown('Tarefas a Vencer', t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))} className="cursor-pointer">
                    <StatCard
                        title="A Vencer"
                        value={totalDueSoon}
                        icon={Clock}
                        iconColorClass="text-orange-500 bg-orange-500/10"
                        subtitle="Dentro do prazo"
                    />
                </div>
                <div onClick={() => openDrilldown('Tarefas Vencidas', t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))} className="cursor-pointer">
                    <StatCard
                        title="Vencidos"
                        value={totalOverdue}
                        icon={AlertCircle}
                        iconColorClass="text-red-500 bg-red-500/10"
                        subtitle="Prazo expirado"
                    />
                </div>
                <div onClick={() => openDrilldown('Tarefas Concluídas', t => t.status === 'done')} className="cursor-pointer">
                    <StatCard
                        title="Concluídos"
                        value={totalDone}
                        icon={CheckCircle2}
                        iconColorClass="text-emerald-500 bg-emerald-500/10"
                        subtitle={period === 'all' ? 'Total histórico' : 'Neste período'}
                    />
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 gap-6">
                {/* Status Distribution */}
                <Card className="min-h-[350px] flex flex-col" variant="solid">
                    <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                        <BarChart2 size={18} className="text-indigo-500" /> Distribuição por Status
                    </h3>
                    <div className="flex-1 w-full min-h-0 flex flex-col xl:flex-row gap-8">
                        <div className="w-full xl:w-1/3 min-h-[250px]">
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
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        
                        {/* Tasks Columns */}
                        <div className="w-full xl:w-2/3 flex flex-col md:flex-row gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {/* Vencidos Column */}
                            {totalOverdue > 0 && (
                                <div className="flex-1 min-w-[220px] flex flex-col gap-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Vencidos</h4>
                                        <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-bold">{totalOverdue}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {visibleTasks.filter(t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))
                                            .sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
                                            .slice(0, 5).map(task => {
                                                const assignee = getUser(task.assigneeId);
                                                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                                                const team = task.teamId ? teams.find(tm => tm.id === task.teamId) : undefined;
                                                return (
                                                <div key={task.id} className="p-3 bg-card border border-border/50 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all relative overflow-hidden group flex flex-col gap-1.5 dark:bg-secondary/30 dark:border-transparent dark:shadow-none dark:hover:bg-secondary/50" onClick={() => navigate('/tasks', { state: { taskId: task.id } })}>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                                                    <div className="font-semibold text-sm truncate pl-2">{task.title}</div>
                                                    <div className="flex flex-col gap-1 pl-2">
                                                        {team && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users size={10} className="shrink-0" /> <span className="truncate">{team.name}</span></div>}
                                                        {project && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Briefcase size={10} className="shrink-0" /> <span className="truncate">{project.name}</span></div>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between pl-2">
                                                        <div className="flex items-center gap-1.5 truncate pr-2">
                                                            <UserIcon size={12} className="shrink-0" />
                                                            <span className="truncate">{assignee?.name?.split(' ')[0] || 'Sem Resp.'}</span>
                                                        </div>
                                                        <span className="text-rose-500 font-medium shrink-0 text-[10px]">Vencido: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            )})}
                                        {totalOverdue > 5 && (
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openDrilldown('Tarefas Vencidas', t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))}>
                                                Ver todas ({totalOverdue})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* A Vencer Column */}
                            {totalDueSoon > 0 && (
                                <div className="flex-1 min-w-[220px] flex flex-col gap-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">A Vencer</h4>
                                        <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-bold">{totalDueSoon}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {visibleTasks.filter(t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))
                                            .sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
                                            .slice(0, 5).map(task => {
                                                const assignee = getUser(task.assigneeId);
                                                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                                                const team = task.teamId ? teams.find(tm => tm.id === task.teamId) : undefined;
                                                return (
                                                <div key={task.id} className="p-3 bg-card border border-border/50 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all relative overflow-hidden group flex flex-col gap-1.5 dark:bg-secondary/30 dark:border-transparent dark:shadow-none dark:hover:bg-secondary/50" onClick={() => navigate('/tasks', { state: { taskId: task.id } })}>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                                                    <div className="font-semibold text-sm truncate pl-2">{task.title}</div>
                                                    <div className="flex flex-col gap-1 pl-2">
                                                        {team && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users size={10} className="shrink-0" /> <span className="truncate">{team.name}</span></div>}
                                                        {project && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Briefcase size={10} className="shrink-0" /> <span className="truncate">{project.name}</span></div>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between pl-2">
                                                        <div className="flex items-center gap-1.5 truncate pr-2">
                                                            <UserIcon size={12} className="shrink-0" />
                                                            <span className="truncate">{assignee?.name?.split(' ')[0] || 'Sem Resp.'}</span>
                                                        </div>
                                                        <span className="shrink-0 text-[10px]">Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            )})}
                                        {totalDueSoon > 5 && (
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openDrilldown('Tarefas a Vencer', t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))}>
                                                Ver todas ({totalDueSoon})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Concluídos Column */}
                            {totalDone > 0 && (
                                <div className="flex-1 min-w-[220px] flex flex-col gap-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Concluídos</h4>
                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">{totalDone}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {visibleTasks.filter(t => t.status === 'done')
                                            .sort((a,b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime())
                                            .slice(0, 5).map(task => {
                                                const assignee = getUser(task.assigneeId);
                                                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                                                const team = task.teamId ? teams.find(tm => tm.id === task.teamId) : undefined;
                                                return (
                                                <div key={task.id} className="p-3 bg-card border border-border/50 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all relative overflow-hidden group flex flex-col gap-1.5 dark:bg-secondary/30 dark:border-transparent dark:shadow-none dark:hover:bg-secondary/50" onClick={() => navigate('/tasks', { state: { taskId: task.id } })}>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                                                    <div className="font-semibold text-sm truncate line-through opacity-70 pl-2">{task.title}</div>
                                                    <div className="flex flex-col gap-1 pl-2 opacity-70">
                                                        {team && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users size={10} className="shrink-0" /> <span className="truncate">{team.name}</span></div>}
                                                        {project && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Briefcase size={10} className="shrink-0" /> <span className="truncate">{project.name}</span></div>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between pl-2">
                                                        <div className="flex items-center gap-1.5 truncate pr-2">
                                                            <UserIcon size={12} className="shrink-0" />
                                                            <span className="truncate">{assignee?.name?.split(' ')[0] || 'Sem Resp.'}</span>
                                                        </div>
                                                        <span className="shrink-0 text-[10px]">Data: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            )})}
                                        {totalDone > 5 && (
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openDrilldown('Tarefas Concluídas', t => t.status === 'done')}>
                                                Ver todas ({totalDone})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
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
                users={availableUsers}
            />
        </div>
    );
};
