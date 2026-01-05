
import React, { useEffect, useState } from 'react';
import { Plus, Filter, LayoutList, Kanban, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Loader, TaskTableView, Select } from '../components/Shared';
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

  const [filterStatus, setFilterStatus] = useState<string>('all');
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
  if (filterStatus !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
  }

  const activeTasks = filteredTasks.filter(t => t.status !== 'done');
  const completedTasks = filteredTasks.filter(t => t.status === 'done');

  if (loading) return <Loader />;

  return (
    // FULL HEIGHT CONTAINER
    <div className="h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 border border-slate-700">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-sm text-slate-200 py-2 outline-none cursor-pointer [&>option]:bg-slate-800 [&>option]:text-slate-200"
            >
              <option value="all">Todos os Status</option>
              <option value="todo">A Fazer</option>
              <option value="in_progress">Em Progresso</option>
              <option value="review">Revisão</option>
              <option value="done">Concluído</option>
            </select>
          </div>

          {can('routines', 'create') && (
            <Button size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Nova Tarefa
            </Button>
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
