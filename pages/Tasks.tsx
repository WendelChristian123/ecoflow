
import React, { useEffect, useState } from 'react';
import { Plus, Filter, LayoutList, Kanban, ChevronDown, ChevronRight, ChevronLeft, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button, Loader, TaskTableView, Select as SelectComponent } from '../components/Shared';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanBoard } from '../components/Kanban';
import { TaskModal, TaskDetailModal, ConfirmationModal } from '../components/Modals';
import { api } from '../services/api';
import { Task, User, Status, Project, Team } from '../types';
import { useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../context/RBACContext';
import { useAuth } from '../context/AuthContext';

export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { can, canDelete } = useRBAC();
  const [view, setView] = useState<'list' | 'board'>('board');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // STRICT: Only Self + Delegators
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Filters & State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showMonthFilter, setShowMonthFilter] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  const location = useLocation();

  const canEdit = can('routines', 'edit');

  useEffect(() => {
    if (currentTenant) {
      loadData();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (!loading && tasks.length > 0 && location.state?.taskId) {
      const targetTask = tasks.find(t => t.id === location.state.taskId);
      if (targetTask) {
        setSelectedTask(targetTask);
      }
    }
  }, [loading, tasks, location.state]);

  const loadData = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [t, u, p, tm, delegatorIds] = await Promise.all([
        api.getTasks(currentTenant.id),
        api.getUsers(currentTenant.id),
        api.getProjects(currentTenant.id),
        api.getTeams(currentTenant.id),
        api.getDelegators('tasks')
      ]);
      setTasks(t);
      setUsers(u);
      setProjects(p);
      setTeams(tm);

      // STRICT FILTER: Self + Delegators (Unless Admin)
      if (user) {
        if (user.role === 'admin' || user.role === 'owner' || user.role === 'super_admin') {
          setAssignableUsers(u);
        } else {
          const allowedIds = [user.id, ...delegatorIds];
          setAssignableUsers(u.filter(x => allowedIds.includes(x.id)));
        }
      } else {
        setAssignableUsers([]);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, status: Status) => {
    if (!canEdit) {
      alert("Você não tem permissão para mover tarefas.");
      return;
    }
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));

    try {
      await api.updateTaskStatus(taskId, status);
    } catch (error) {
      console.error("Failed to move task", error);
      alert("Erro ao mover tarefa. Revertendo...");
      loadData(); // Revert on error
    }
  };

  const handleStatusChange = async (taskId: string, status: Status) => {
    if (!canEdit) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await api.updateTaskStatus(taskId, status);
  };

  const requestDelete = (id: string) => {
    if (!canDelete()) return;
    setConfirmDeleteId(id);
  }

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setTasks(prev => prev.filter(t => t.id !== confirmDeleteId));
      await api.deleteTask(confirmDeleteId);
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir tarefa");
      loadData();
    } finally {
      setConfirmDeleteId(null);
    }
  };

  let filteredTasks = tasks;

  // 1. Month Filter
  if (showMonthFilter) {
    filteredTasks = filteredTasks.filter(t => {
      if (!t.dueDate) return false; // If filtering by month, tasks without date might be hidden or shown? Usually hidden.
      return isSameMonth(parseISO(t.dueDate), currentDate);
    });
  }

  // 2. Status Filter
  if (filterStatus !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
  }

  // 3. Assignee Filter
  if (filterAssignee !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.assigneeId === filterAssignee);
  }

  // 4. Priority Filter
  if (filterPriority !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.priority === filterPriority);
  }

  // 5. Sorting (Date Ascending)
  filteredTasks.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const activeTasks = filteredTasks.filter(t => t.status !== 'done');
  const completedTasks = filteredTasks.filter(t => t.status === 'done');

  if (loading) return <Loader />;

  return (
    // FULL HEIGHT CONTAINER
    <div className="h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-4 shrink-0">

        {/* Top Row: Navigation & Main Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Left: View Mode & Date Nav */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                title="Lista"
              >
                <LayoutList size={18} />
              </button>
              <button
                onClick={() => setView('board')}
                className={`p-2 rounded-md transition-all ${view === 'board' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                title="Quadro"
              >
                <Kanban size={18} />
              </button>
            </div>

            {/* Date Filter Toggle & Month Selector */}
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setShowMonthFilter(!showMonthFilter)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${showMonthFilter ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'text-slate-400 hover:text-white'}`}
              >
                {showMonthFilter ? 'Filtrando Mês' : 'Todas as Datas'}
              </button>

              {showMonthFilter && (
                <div className="flex items-center h-full pl-2 border-l border-slate-700">
                  <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:text-white text-slate-400"><ChevronLeft size={16} /></button>
                  <span className="text-sm font-bold text-white uppercase w-32 text-center select-none">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:text-white text-slate-400"><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Right: New Task */}
          <div className="w-full md:w-auto flex justify-end">
            {can('routines', 'create') && (
              <Button size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
                <Plus size={16} /> Nova Tarefa
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Row: Detailed Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-500 uppercase">Filtros:</span>
          </div>

          {/* Status */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none bg-slate-800 hover:bg-slate-750 text-xs text-slate-300 py-1.5 pl-3 pr-8 rounded-lg border border-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">Status: Todos</option>
              <option value="todo">A Fazer</option>
              <option value="in_progress">Em Progresso</option>
              <option value="review">Revisão</option>
              <option value="done">Concluído</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Priority */}
          <div className="relative">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className={`appearance-none bg-slate-800 hover:bg-slate-750 text-xs py-1.5 pl-3 pr-8 rounded-lg border border-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer ${filterPriority !== 'all' ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}
            >
              <option value="all">Prioridade: Todas</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Assignee */}
          <div className="relative">
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className={`appearance-none bg-slate-800 hover:bg-slate-750 text-xs py-1.5 pl-3 pr-8 rounded-lg border border-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer ${filterAssignee !== 'all' ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}
            >
              <option value="all">Responsável: Todos</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Clear Filters Button (only shows if filters active) */}
          {(filterStatus !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all') && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all'); }}
              className="text-[10px] text-slate-500 hover:text-rose-400 underline underline-offset-2 flex items-center gap-1"
            >
              <X size={10} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {view === 'board' ? (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-transparent rounded-xl">
          {filteredTasks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
              Nenhuma tarefa encontrada com os filtros atuais.
            </div>
          ) : (
            <KanbanBoard
              tasks={filteredTasks}
              users={users}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDelete={requestDelete}
              onTaskClick={setSelectedTask}
              canMove={canEdit}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Tarefas Ativas ({activeTasks.length})</h3>
            <TaskTableView
              tasks={activeTasks}
              users={users}
              onDelete={requestDelete}
              onTaskClick={setSelectedTask}
              onStatusChange={handleStatusChange}
            />
          </div>

          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors font-medium"
            >
              {showCompleted ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              Tarefas Concluídas ({completedTasks.length})
            </button>

            {showCompleted && (
              <div className="opacity-75">
                <TaskTableView
                  tasks={completedTasks}
                  users={users}
                  onDelete={requestDelete}
                  onTaskClick={setSelectedTask}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        projects={projects}
        teams={teams}
        users={assignableUsers} // STRICT
      />

      <TaskDetailModal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSuccess={loadData}
        task={selectedTask}
        users={assignableUsers} // STRICT
        projects={projects}
        teams={teams}
      />

      <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Excluir Tarefa" />
    </div>
  );
};
