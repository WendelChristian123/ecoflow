import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Task, Project, User, Team, CalendarEvent } from '../../types';
import { Loader, Card, cn, Button, Select, Avatar, Badge, StatCard } from '../../components/Shared';
import { FilterSelect } from '../../components/FilterSelect';
import { DrilldownModal, TaskModal, EventModal, TaskDetailModal, EventDetailModal, ProjectModal, TeamModal } from '../../components/Modals';
import { useAppEnvironment } from '../../context/AppEnvironmentContext';
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
    User as UserIcon,
    Calendar as CalendarIcon,
    Plus
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
    const { isApp } = useAppEnvironment();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [delegatorIds, setDelegatorIds] = useState<string[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);

    // Modals
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);
    const [selectedEventDetail, setSelectedEventDetail] = useState<CalendarEvent | null>(null);

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
            const [t, e, p, dIds, u, tm] = await Promise.all([
                api.getTasks(),
                api.getEvents(),
                api.getProjects(),
                api.getDelegators('tasks'),
                api.getUsers(),
                api.getTeams()
            ]);
            setTasks(t);
            setEvents(e);
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

        let visibleEvents = events;

        // 1. RBAC & Delegation Scope
        if (!isAdmin) {
            const allowedUserIds = [user.id, ...delegatorIds];
            scopedTasks = tasks.filter(t => allowedUserIds.includes(t.assigneeId));
            visibleProjects = projects.filter(p => p.members.includes(user.id));
            visibleEvents = events.filter(e => e.participants?.includes(user.id));
        }

        // 2. Assignee Filter
        if (selectedAssignee !== 'all') {
            scopedTasks = scopedTasks.filter(t => t.assigneeId === selectedAssignee);
            visibleProjects = visibleProjects.filter(p => p.members.includes(selectedAssignee));
            visibleEvents = visibleEvents.filter(e => e.participants?.includes(selectedAssignee));
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

        return { scopedTasks, visibleTasks, visibleProjects, visibleEvents };
    };

    const { scopedTasks, visibleTasks, visibleProjects, visibleEvents } = getVisibleData();

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

    const upcomingEvents = visibleEvents.filter(e =>
        e.status !== 'completed' && e.status !== 'cancelled' && e.startDate && !isBefore(parseISO(e.startDate), startOfToday)
    );
    const totalUpcomingEvents = upcomingEvents.length;

    // --- Modal Handler ---
    const openDrilldownTasks = (title: string, filterFn: (t: Task) => boolean) => {
        const data = visibleTasks.filter(filterFn);
        setModalState({ isOpen: true, title, type: 'tasks', data });
    };

    const openDrilldownEvents = (title: string, data: CalendarEvent[]) => {
        setModalState({ isOpen: true, title, type: 'events', data });
    };

    // --- Charts Data ---
    const priorityData = [
        { name: 'Baixa', value: visibleTasks.filter(t => t.priority === 'low' && t.status !== 'done').length },
        { name: 'Média', value: visibleTasks.filter(t => t.priority === 'medium' && t.status !== 'done').length },
        { name: 'Alta', value: visibleTasks.filter(t => t.priority === 'high' && t.status !== 'done').length },
        { name: 'Urgente', value: visibleTasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length },
    ];

    const statusData = [
        { name: 'A Vencer', value: totalDueSoon, color: 'hsl(var(--warning))' },
        { name: 'Vencidos', value: totalOverdue, color: 'hsl(var(--danger))' },
        { name: 'Concluídos', value: totalDone, color: 'hsl(var(--success))' },
    ].filter(d => d.value > 0);

    const upcomingTasks = visibleTasks
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5);

    const getUser = (id: string) => usersList.find(u => u.id === id);

    if (loading) return <Loader />;

    // === MOBILE LAYOUT ===
    if (isApp) {
        const userTeams = isAdmin ? teams : teams.filter(t => (t.memberIds || []).includes(user?.id || ''));

        return (
            <div className="flex-1 flex flex-col gap-5 px-4 pt-3 pb-6 overflow-y-auto custom-scrollbar">
                
                {/* === CAMADA 1: Ações Rápidas === */}
                <section>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Ações rápidas</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            onClick={() => setIsTaskModalOpen(true)}
                            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary transition-all duration-200 active:scale-[0.97] hover:bg-primary/15"
                        >
                            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <CheckSquare size={15} strokeWidth={2} />
                            </div>
                            <span className="text-xs font-semibold truncate">Tarefas</span>
                        </button>
                        
                        <button
                            onClick={() => setIsEventModalOpen(true)}
                            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-card border border-border text-foreground transition-all duration-200 active:scale-[0.97] hover:bg-accent/50 hover:border-border/80"
                        >
                            <div className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                                <CalendarIcon size={15} strokeWidth={2} />
                            </div>
                            <span className="text-xs font-semibold truncate">Compromissos</span>
                        </button>
                        
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-card border border-border text-foreground transition-all duration-200 active:scale-[0.97] hover:bg-accent/50 hover:border-border/80 col-span-2 md:col-span-1"
                        >
                            <div className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                                <FileText size={15} strokeWidth={2} />
                            </div>
                            <span className="text-xs font-semibold truncate">Relatórios</span>
                        </button>
                    </div>
                </section>

                {/* === CAMADA 2: KPIs / Cards da Dashboard === */}
                <section>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Indicadores</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div onClick={() => openDrilldownTasks('Tarefas Vencidas', t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))} className="cursor-pointer">
                            <StatCard title="Vencido" value={totalOverdue} icon={AlertCircle} variant="danger" size="sm" subtitle="Tarefas atrasadas" />
                        </div>
                        <div onClick={() => openDrilldownTasks('A Vencer', t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))} className="cursor-pointer">
                            <StatCard title="A vencer" value={totalDueSoon} icon={Clock} variant="warning" size="sm" subtitle="Tarefas no prazo" />
                        </div>
                        <div onClick={() => openDrilldownTasks('Concluídos', t => t.status === 'done')} className="cursor-pointer">
                            <StatCard title="Concluídos" value={totalDone} icon={CheckCircle2} variant="success" size="sm" subtitle="Total histórico" />
                        </div>
                        <div onClick={() => openDrilldownEvents('Próximos compromissos', upcomingEvents)} className="cursor-pointer">
                            <StatCard title="Compromissos" value={totalUpcomingEvents} icon={CalendarIcon} variant="info" size="sm" subtitle="Próximos eventos" />
                        </div>
                    </div>
                </section>

                {/* === CAMADA 3: Projetos e Equipes === */}
                <section>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Seus Projetos e Equipes</h2>
                    <div className="flex flex-col gap-4">
                        {/* Projetos */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Projetos Ativos ({visibleProjects.length})</div>
                                <button onClick={() => setIsProjectModalOpen(true)} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground">
                                    <Plus size={12} />
                                </button>
                            </div>
                            {visibleProjects.length === 0 ? (
                                <div className="text-xs text-muted-foreground p-3 border border-border rounded-xl bg-card/50 text-center">Nenhum projeto ativo</div>
                            ) : (
                                visibleProjects.map(p => (
                                    <div key={p.id} onClick={() => openDrilldownTasks(`Tarefas do Projeto: ${p.name}`, t => t.projectId === p.id)} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <Briefcase size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold truncate">{p.name}</div>
                                                <div className="text-[10px] text-muted-foreground">{p.members.length} membros</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Equipes */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Suas Equipes ({userTeams.length})</div>
                                <button onClick={() => setIsTeamModalOpen(true)} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground">
                                    <Plus size={12} />
                                </button>
                            </div>
                            {userTeams.length === 0 ? (
                                <div className="text-xs text-muted-foreground p-3 border border-border rounded-xl bg-card/50 text-center">Nenhuma equipe vinculada</div>
                            ) : (
                                userTeams.map(tm => (
                                    <div key={tm.id} onClick={() => openDrilldownTasks(`Tarefas da Equipe: ${tm.name}`, t => t.teamId === tm.id)} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                                                <Users size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold truncate">{tm.name}</div>
                                                <div className="text-[10px] text-muted-foreground">{(tm.memberIds || []).length} membros</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                {/* Modals para o mobile */}
                <DrilldownModal
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                    title={modalState.title}
                    type={modalState.type as 'tasks' | 'events'}
                    data={modalState.data}
                    users={usersList}
                    onItemClick={(item) => {
                        if (modalState.type === 'tasks') setSelectedTaskDetail(item as Task);
                        else setSelectedEventDetail(item as CalendarEvent);
                    }}
                />
                
                {selectedTaskDetail && (
                    <TaskDetailModal
                        isOpen={!!selectedTaskDetail}
                        onClose={() => setSelectedTaskDetail(null)}
                        task={selectedTaskDetail}
                        users={usersList}
                        projects={projects}
                        teams={teams}
                        boardStages={[]}
                        onSuccess={loadData}
                    />
                )}

                {selectedEventDetail && (
                    <EventDetailModal
                        isOpen={!!selectedEventDetail}
                        onClose={() => setSelectedEventDetail(null)}
                        event={selectedEventDetail}
                        users={usersList}
                        projects={projects}
                        teams={teams}
                        onSuccess={loadData}
                    />
                )}

                <ProjectModal
                    isOpen={isProjectModalOpen}
                    onClose={() => setIsProjectModalOpen(false)}
                    onSuccess={loadData}
                    users={usersList}
                />

                <TeamModal
                    isOpen={isTeamModalOpen}
                    onClose={() => setIsTeamModalOpen(false)}
                    onSuccess={loadData}
                    users={usersList}
                />
                
                <TaskModal
                    isOpen={isTaskModalOpen}
                    onClose={() => setIsTaskModalOpen(false)}
                    onSuccess={loadData}
                    projects={projects}
                    teams={teams}
                    users={usersList}
                />

                <EventModal
                    isOpen={isEventModalOpen}
                    onClose={() => setIsEventModalOpen(false)}
                    onSuccess={loadData}
                    users={usersList}
                    projects={projects}
                    teams={teams}
                    tasks={tasks}
                    onEventAdded={loadData}
                />

                <RoutineReportModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    tasks={scopedTasks}
                    projects={projects}
                    users={availableUsers}
                />
            </div>
        );
    }

    // === DESKTOP LAYOUT (unchanged) ===
    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-2 pb-4 pr-2 text-foreground">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                    <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <CheckSquare className="text-success" size={20} /> Dashboard de Rotinas
                    </h1>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                        {isAdmin ? 'Visão global administrativa' : 'Acompanhamento de tarefas e projetos'}
                    </p>
                </div>

                <div className="flex gap-3">
                    {/* Report Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-card border border-border hover:bg-secondary text-foreground h-7 text-[10px]"
                    >
                        <FileText size={14} className="mr-1.5 text-info" /> Relatórios
                    </Button>

                    {/* User Filter */}
                    <FilterSelect
                        inlineLabel="Resp:"
                        icon={<UserIcon size={12} />}
                        value={selectedAssignee}
                        onChange={setSelectedAssignee}
                        options={[
                            { value: 'all', label: 'Todos' },
                            ...availableUsers.map(u => ({ value: u.id, label: u.name || u.email || 'Usuário', avatarUrl: u.avatarUrl }))
                        ]}
                        className="min-w-[150px]"
                        triggerClassName="!h-7 text-[10px]"
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
                        className="min-w-[140px]"
                        triggerClassName="!h-7 text-[10px]"
                    />
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div onClick={() => navigate('/projects')} className="cursor-pointer">
                    <StatCard
                        title="Projetos Ativos"
                        value={activeProjectsCount}
                        icon={Briefcase}
                        variant="info"
                        size="sm"
                        subtitle="Em andamento"
                    />
                </div>
                <div onClick={() => openDrilldownTasks('Tarefas a Vencer', t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))} className="cursor-pointer">
                    <StatCard
                        title="A Vencer"
                        value={totalDueSoon}
                        icon={Clock}
                        variant="warning"
                        size="sm"
                        subtitle="Dentro do prazo"
                    />
                </div>
                <div onClick={() => openDrilldownTasks('Tarefas Vencidas', t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))} className="cursor-pointer">
                    <StatCard
                        title="Vencidos"
                        value={totalOverdue}
                        icon={AlertCircle}
                        variant="danger"
                        size="sm"
                        subtitle="Prazo expirado"
                    />
                </div>
                <div onClick={() => openDrilldownTasks('Tarefas Concluídas', t => t.status === 'done')} className="cursor-pointer">
                    <StatCard
                        title="Concluídos"
                        value={totalDone}
                        icon={CheckCircle2}
                        variant="success"
                        size="sm"
                        subtitle={period === 'all' ? 'Total histórico' : 'Neste período'}
                    />
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 gap-4">
                {/* Status Distribution */}
                <Card className="min-h-[200px] p-4 flex flex-col" variant="solid">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <BarChart2 size={16} className="text-info" /> Distribuição por Status
                    </h3>
                    <div className="flex-1 w-full min-h-0 flex flex-col xl:flex-row gap-4">
                        <div className="w-full xl:w-1/3 min-h-[200px]">
                            <ResponsiveContainer width="99%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={65}
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
                        <div className="w-full xl:w-2/3 flex flex-col md:flex-row gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {/* Vencidos Column */}
                            {totalOverdue > 0 && (
                                <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-3 h-3 rounded-full bg-danger" />
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Vencidos</h4>
                                        <span className="text-[10px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-bold">{totalOverdue}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {visibleTasks.filter(t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))
                                            .sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
                                            .slice(0, 5).map(task => {
                                                const assignee = getUser(task.assigneeId);
                                                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                                                const team = task.teamId ? teams.find(tm => tm.id === task.teamId) : undefined;
                                                return (
                                                <div key={task.id} className="p-1.5 bg-card border border-border/50 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all relative overflow-hidden group flex flex-col gap-0.5 dark:bg-secondary/30 dark:border-transparent dark:shadow-none dark:hover:bg-secondary/50" onClick={() => navigate('/tasks', { state: { taskId: task.id } })}>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-danger"></div>
                                                    <div className="font-semibold text-[11px] truncate pl-2">{task.title}</div>
                                                    <div className="flex flex-col gap-0 pl-2">
                                                        {team && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users size={10} className="shrink-0" /> <span className="truncate">{team.name}</span></div>}
                                                        {project && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Briefcase size={10} className="shrink-0" /> <span className="truncate">{project.name}</span></div>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between pl-2">
                                                        <div className="flex items-center gap-1.5 truncate pr-2">
                                                            <UserIcon size={12} className="shrink-0" />
                                                            <span className="truncate">{assignee?.name?.split(' ')[0] || 'Sem Resp.'}</span>
                                                        </div>
                                                        <span className="text-danger font-medium shrink-0 text-[10px]">Vencido: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            )})}
                                        {totalOverdue > 5 && (
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openDrilldownTasks('Tarefas Vencidas', t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfToday))}>
                                                Ver todas ({totalOverdue})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* A Vencer Column */}
                            {totalDueSoon > 0 && (
                                <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-3 h-3 rounded-full bg-warning" />
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">A Vencer</h4>
                                        <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold">{totalDueSoon}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {visibleTasks.filter(t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))
                                            .sort((a,b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
                                            .slice(0, 5).map(task => {
                                                const assignee = getUser(task.assigneeId);
                                                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                                                const team = task.teamId ? teams.find(tm => tm.id === task.teamId) : undefined;
                                                return (
                                                <div key={task.id} className="p-1.5 bg-card border border-border/50 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all relative overflow-hidden group flex flex-col gap-0.5 dark:bg-secondary/30 dark:border-transparent dark:shadow-none dark:hover:bg-secondary/50" onClick={() => navigate('/tasks', { state: { taskId: task.id } })}>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning"></div>
                                                    <div className="font-semibold text-[11px] truncate pl-2">{task.title}</div>
                                                    <div className="flex flex-col gap-0 pl-2">
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
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openDrilldownTasks('Tarefas a Vencer', t => t.status !== 'done' && !isBefore(parseISO(t.dueDate), startOfToday))}>
                                                Ver todas ({totalDueSoon})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Concluídos Column */}
                            {totalDone > 0 && (
                                <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-3 h-3 rounded-full bg-success" />
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Concluídos</h4>
                                        <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-bold">{totalDone}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {visibleTasks.filter(t => t.status === 'done')
                                            .sort((a,b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime())
                                            .slice(0, 5).map(task => {
                                                const assignee = getUser(task.assigneeId);
                                                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                                                const team = task.teamId ? teams.find(tm => tm.id === task.teamId) : undefined;
                                                return (
                                                <div key={task.id} className="p-1.5 bg-card border border-border/50 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all relative overflow-hidden group flex flex-col gap-0.5 dark:bg-secondary/30 dark:border-transparent dark:shadow-none dark:hover:bg-secondary/50" onClick={() => navigate('/tasks', { state: { taskId: task.id } })}>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-success"></div>
                                                    <div className="font-semibold text-[11px] truncate line-through opacity-70 pl-2">{task.title}</div>
                                                    <div className="flex flex-col gap-0 pl-2 opacity-70">
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
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openDrilldownTasks('Tarefas Concluídas', t => t.status === 'done')}>
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
                <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                    <h3 className="text-base font-bold text-foreground">Próximas Entregas</h3>
                    <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2" onClick={() => navigate('/tasks')}>Ver Tudo <ArrowRight size={12} className="ml-1" /></Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-muted-foreground">
                        <thead className="bg-secondary/50 text-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-3 py-1.5">Tarefa</th>
                                <th className="px-3 py-1.5">Responsável</th>
                                <th className="px-3 py-1.5">Prazo</th>
                                <th className="px-3 py-1.5 text-right">Prioridade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {upcomingTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground italic">
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
                                                    ? "bg-danger/10 hover:bg-danger/20 border-l-danger"
                                                    : "bg-transparent hover:bg-secondary/30 border-l-transparent"
                                            )}
                                            onClick={() => navigate('/tasks', { state: { taskId: task.id } })}
                                        >
                                            <td className="px-3 py-1.5">
                                                <div className="font-medium text-[11px] text-foreground">{task.title}</div>
                                                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{task.description}</div>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                {assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar src={assignee.avatarUrl} name={assignee.name} size="sm" />
                                                        <span className="text-xs">{assignee.name}</span>
                                                    </div>
                                                ) : <span className="text-xs italic">--</span>}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono text-[10px]">
                                                <div className={isOverdue ? 'text-danger font-bold flex flex-col' : 'text-foreground'}>
                                                    <div className="flex items-center gap-1">
                                                        {isOverdue && <AlertCircle size={12} />}
                                                        {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    {isOverdue && <span className="text-[9px] uppercase tracking-wider font-extrabold mt-0.5">Vencido</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 text-right">
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
                type={modalState.type as 'tasks' | 'events'}
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
