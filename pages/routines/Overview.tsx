
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Task, Project, Delegation, User } from '../../types';
import { Loader, Card, cn, Button, Select, Avatar, Badge } from '../../components/Shared';
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
    FileText
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
    color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate';
    subtitle?: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const colors = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-slate-800 border border-slate-700/50 p-6 rounded-xl relative overflow-hidden flex flex-col justify-between h-full transition-all group",
                onClick && "cursor-pointer hover:bg-slate-700/50 hover:border-slate-600"
            )}
        >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">{title}</span>
                <div className={cn("p-2 rounded-lg", colors[color])}>{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
            </div>
            {onClick && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={18} className="text-slate-400" />
                </div>
            )}
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
    const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month'>('week');
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
        if (!user) return { visibleTasks: [], visibleProjects: [] };

        let visibleTasks = tasks;
        let visibleProjects = projects;

        // 1. RBAC & Delegation Scope
        if (!isAdmin) {
            const allowedUserIds = [user.id];
            delegations.forEach(del => {
                if (del.module === 'tasks' && del.permissions.view) {
                    allowedUserIds.push(del.ownerId);
                }
            });
            visibleTasks = tasks.filter(t => allowedUserIds.includes(t.assigneeId));
            visibleProjects = projects.filter(p => p.members.includes(user.id));
        }

        // 2. Assignee Filter
        if (selectedAssignee !== 'all') {
            visibleTasks = visibleTasks.filter(t => t.assigneeId === selectedAssignee);
            visibleProjects = visibleProjects.filter(p => p.members.includes(selectedAssignee));
        }

        // 3. Apply Time Period Filter
        const now = new Date();
        if (period === 'today') {
            visibleTasks = visibleTasks.filter(t => isToday(parseISO(t.dueDate)));
        } else if (period === 'week') {
            visibleTasks = visibleTasks.filter(t => isWithinInterval(parseISO(t.dueDate), { start: startOfWeek(now), end: endOfWeek(now) }));
        } else if (period === 'month') {
            visibleTasks = visibleTasks.filter(t => isWithinInterval(parseISO(t.dueDate), { start: startOfMonth(now), end: endOfMonth(now) }));
        }

        return { visibleTasks, visibleProjects };
    };

    const { visibleTasks, visibleProjects } = getVisibleData();

    // --- Metrics Calculations ---
    const totalPending = visibleTasks.filter(t => t.status !== 'done').length;
    const totalDone = visibleTasks.filter(t => t.status === 'done').length;
    const totalUrgent = visibleTasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;
    const activeProjectsCount = visibleProjects.filter(p => p.status === 'active').length;

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
        { name: 'A Fazer', value: visibleTasks.filter(t => t.status === 'todo').length, color: '#64748b' },
        { name: 'Em Andamento', value: visibleTasks.filter(t => t.status === 'in_progress').length, color: '#6366f1' },
        { name: 'Revisão', value: visibleTasks.filter(t => t.status === 'review').length, color: '#f59e0b' },
        { name: 'Concluído', value: visibleTasks.filter(t => t.status === 'done').length, color: '#10b981' },
    ].filter(d => d.value > 0);

    const upcomingTasks = visibleTasks
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5);

    const getUser = (id: string) => usersList.find(u => u.id === id);

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <CheckSquare className="text-emerald-500" /> Dashboard de Rotinas
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {isAdmin ? 'Visão global administrativa' : 'Acompanhamento de tarefas e projetos'}
                    </p>
                </div>

                <div className="flex gap-3">
                    {/* Report Button */}
                    <Button
                        variant="ghost"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
                    >
                        <FileText size={16} className="mr-2 text-indigo-400" /> Relatórios
                    </Button>

                    {/* User Filter */}
                    <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                            <Users size={14} /> Resp.
                        </div>
                        <select
                            value={selectedAssignee}
                            onChange={(e) => setSelectedAssignee(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-emerald-500 max-w-[150px]"
                        >
                            <option value="all">Todos</option>
                            {availableUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Period Filter */}
                    <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                            <Filter size={14} /> Período
                        </div>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as any)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-emerald-500"
                        >
                            <option value="today">Hoje</option>
                            <option value="week">Esta Semana</option>
                            <option value="month">Este Mês</option>
                            <option value="all">Tudo</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Tarefas Pendentes"
                    value={totalPending}
                    icon={<Clock size={20} />}
                    color="amber"
                    subtitle="Aguardando conclusão"
                    onClick={() => openDrilldown('Tarefas Pendentes', t => t.status !== 'done')}
                />
                <StatCard
                    title="Projetos Ativos"
                    value={activeProjectsCount}
                    icon={<Briefcase size={20} />}
                    color="indigo"
                    subtitle="Em andamento"
                    onClick={() => navigate('/projects')}
                />
                <StatCard
                    title="Concluídas"
                    value={totalDone}
                    icon={<CheckCircle2 size={20} />}
                    color="emerald"
                    subtitle={period === 'all' ? 'Total histórico' : 'Neste período'}
                    onClick={() => openDrilldown('Tarefas Concluídas', t => t.status === 'done')}
                />
                <StatCard
                    title="Prioridade Urgente"
                    value={totalUrgent}
                    icon={<AlertCircle size={20} />}
                    color="rose"
                    subtitle="Requer atenção imediata"
                    onClick={() => openDrilldown('Tarefas Urgentes', t => t.priority === 'urgent' && t.status !== 'done')}
                />
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <Card className="min-h-[350px] flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
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
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Priority Distribution */}
                <Card className="min-h-[350px] flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <AlertCircle size={18} className="text-rose-500" /> Tarefas Pendentes por Prioridade
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart data={priorityData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={60} tick={{ fontSize: 12 }} />
                                <RechartsTooltip
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                />
                                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24}>
                                    {priorityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={
                                            entry.name === 'Urgente' ? '#f43f5e' :
                                                entry.name === 'Alta' ? '#f59e0b' :
                                                    entry.name === 'Média' ? '#6366f1' : '#10b981'
                                        } />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* UPCOMING TASKS LIST */}
            <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Próximas Entregas</h3>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/tasks')}>Ver Tudo <ArrowRight size={14} className="ml-1" /></Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Tarefa</th>
                                <th className="px-6 py-4">Responsável</th>
                                <th className="px-6 py-4">Prazo</th>
                                <th className="px-6 py-4 text-right">Prioridade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {upcomingTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
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
                                            className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                                            onClick={() => navigate('/tasks', { state: { taskId: task.id } })}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-200">{task.title}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{task.description}</div>
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
                                                <div className={isOverdue ? 'text-rose-400 font-bold flex items-center gap-1' : 'text-slate-300'}>
                                                    {isOverdue && <AlertCircle size={12} />}
                                                    {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Badge variant={task.priority === 'urgent' ? 'error' : task.priority === 'high' ? 'warning' : 'neutral'}>
                                                    {task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
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
                tasks={visibleTasks} // Pass all visible tasks (respecting RBAC/Delegation) to the report, it will verify date filters itself
                projects={projects}
                users={usersList}
            />
        </div>
    );
};
