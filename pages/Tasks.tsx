
import React, { useEffect, useState } from 'react';
import { Plus, Filter, LayoutList, Kanban, ChevronDown, ChevronRight, ChevronLeft, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button, Loader, TaskTableView, Select as SelectComponent } from '../components/Shared';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// import { KanbanBoard } from '../components/Kanban'; // REMOVED
import { TaskModal, TaskDetailModal, ConfirmationModal } from '../components/Modals';
import { api } from '../services/api';
import { Task, User, Status, Project, Team } from '../types';
import { useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../context/RBACContext';
import { useAuth } from '../context/AuthContext';
import { KanbanProvider, useKanban } from '../components/Kanban/KanbanContext';
import { KanbanBoard as GenericKanbanBoard } from '../components/Kanban/KanbanBoard';
import { KanbanHeader } from '../components/Kanban/KanbanHeader';
import { TaskCard } from '../components/Tasks/TaskCard';
import { Settings } from 'lucide-react';
import { StageManagerModal } from '../components/Kanban/StageManagerModal';

const TaskKanbanWithContext: React.FC<{
  tasks: Task[];
  users: User[];
  onDelete: (id: string) => void;
  onTaskClick: (task: Task) => void;
  canMove: boolean;
  hideHeader?: boolean;
  isStageManagerOpen: boolean;
  onCloseStageManager: () => void;
}> = ({ tasks, users, onDelete, onTaskClick, canMove, hideHeader, isStageManagerOpen, onCloseStageManager }) => {
  const { currentKanban } = useKanban();

  const groupByStage = (entities: Task[], stageId: string) => {
    if (!currentKanban) return [];
    const stage = currentKanban.stages.find(s => s.id === stageId);
    return entities.filter(t => {
      if (t.kanbanStageId === stageId) return true;
      if (!t.kanbanStageId && stage?.systemStatus && t.status === stage.systemStatus) return true;
      return false;
    });
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {!hideHeader && <KanbanHeader />}
        <div className="flex-1 min-h-0">
          <GenericKanbanBoard
            entities={tasks}
            groupByStage={groupByStage}
            renderCard={(task: Task) => (
              <TaskCard
                key={task.id}
                task={task}
                users={users}
                onClick={onTaskClick}
                onDelete={onDelete}
                canMove={canMove}
              />
            )}
          />
        </div>
      </div>

      <StageManagerModal
        isOpen={isStageManagerOpen}
        onClose={onCloseStageManager}
      />
    </>
  );
};

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
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const loadData = async (showLoading = true) => {
    if (!currentTenant) return;
    if (showLoading) setLoading(true);
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

  const handleCreateSuccess = (newTask?: Task) => {
    loadData();
    if (newTask) {
      setSelectedTask(newTask);
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

  // 5. Search Logic (New)
  if (searchTerm) {
    const lower = searchTerm.toLowerCase();
    filteredTasks = filteredTasks.filter(t =>
      (t.title || '').toLowerCase().includes(lower) ||
      (t.description || '').toLowerCase().includes(lower)
    );
  }

  // 6. Sorting (Date Ascending)
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
      {/* Filters Bar with Actions */}
      <div className="flex flex-nowrap items-center gap-2 mb-4 shrink-0 overflow-x-auto">
        {/* 1. Search */}
        <div className="relative mr-auto">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Filter size={14} />
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card border border-border text-foreground pl-9 pr-4 py-1.5 rounded-lg text-sm w-40 focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* 2. New Task Button */}
        {can('routines', 'create') && (
          <Button className="gap-2 whitespace-nowrap bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-[34px]" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nova
          </Button>
        )}

        {/* 3. Month Nav */}
        <div className="flex bg-card border border-border rounded-lg p-0.5 items-center">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-xs font-bold text-foreground uppercase px-2 w-24 text-center select-none">{format(currentDate, 'MMM/yyyy', { locale: ptBR })}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={16} /></button>
        </div>

        {/* 4. Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="all">Status: Todos</option>
          <option value="todo">A Fazer</option>
          <option value="in_progress">Em Progresso</option>
          <option value="review">Revisão</option>
          <option value="done">Concluído</option>
        </select>

        {/* 5. Priority */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="all">Prioridade: Todas</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>

        {/* 6. Assignee */}
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none max-w-[140px]"
        >
          <option value="all">Resp: Todos</option>
          {assignableUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>


        {/* 7. View Toggle */}
        <div className="flex bg-card border border-border rounded-lg p-0.5">
          <button onClick={() => setView('list')} className={`p-1.5 rounded transition-all ${view === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <LayoutList size={16} />
          </button>
          <button onClick={() => setView('board')} className={`p-1.5 rounded transition-all ${view === 'board' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Kanban size={16} />
          </button>
        </div>

        {/* 8. Manage Stages - Only in Board View */}
        {view === 'board' && (
          <button
            onClick={() => setIsStageManagerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-secondary transition-colors border border-border h-[34px] whitespace-nowrap"
          >
            <Settings size={14} />
            Etapas
          </button>
        )}
      </div>

      {/* Content Area */}
      {view === 'board' ? (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-transparent rounded-xl">
          {filteredTasks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl">
              Nenhuma tarefa encontrada com os filtros atuais.
            </div>
          ) : (
            <KanbanProvider module="tasks" entityTable="tasks" singleBoardMode={true} onEntityMove={() => loadData(false)}>
              <TaskKanbanWithContext
                tasks={filteredTasks}
                users={users}
                onDelete={requestDelete}
                onTaskClick={setSelectedTask}
                canMove={canEdit}
                hideHeader={true}
                isStageManagerOpen={isStageManagerOpen}
                onCloseStageManager={() => setIsStageManagerOpen(false)}
              />
            </KanbanProvider>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Tarefas Ativas ({activeTasks.length})</h3>
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
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors font-medium"
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
        onSuccess={handleCreateSuccess}
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
