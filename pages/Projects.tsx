
import React, { useEffect, useState } from 'react';
import { Plus, Search, MoreVertical, ArrowLeft, LayoutList, Kanban, Edit2 } from 'lucide-react';
import { Card, Badge, ProgressBar, Button, Loader, Avatar, TaskTableView } from '../components/Shared';
import { KanbanBoard } from '../components/Kanban';
import { TaskModal, ProjectModal, TaskDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { Project, User, Team, Task, Status } from '../types';
import { useLocation } from 'react-router-dom';

import { useTenant } from '../context/TenantContext';

export const ProjectsPage: React.FC = () => {
  const { currentTenant } = useTenant();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<'list' | 'board'>('board');
  const [detailFilterStatus, setDetailFilterStatus] = useState<string>('all');
  const [detailSearch, setDetailSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  useEffect(() => {
    if (currentTenant) {
      loadData();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (projects.length > 0 && location.state?.projectId) {
      const found = projects.find(p => p.id === location.state.projectId);
      if (found) {
        setSelectedProject(found);
      }
    }
  }, [projects, location.state]);

  const loadData = async () => {
    if (!currentTenant) return;
    try {
      const [p, u, t, tk] = await Promise.all([
        api.getProjects(currentTenant.id),
        api.getUsers(currentTenant.id),
        api.getTeams(currentTenant.id),
        api.getTasks(currentTenant.id)
      ]);
      setProjects(p);
      setUsers(u);
      setTeams(t);
      setTasks(tk);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      active: 'Ativo',
      completed: 'Concluído',
      on_hold: 'Em Espera'
    };
    return map[status] || status;
  };

  const handleDropTask = async (e: React.DragEvent, status: Status) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await api.updateTaskStatus(taskId, status);
  };

  const handleStatusChange = async (taskId: string, status: Status) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await api.updateTaskStatus(taskId, status);
  };

  const handleDragStartTask = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDeleteTask = async (id: string) => {
    if (window.confirm("Excluir tarefa?")) {
      setTasks(prev => prev.filter(t => t.id !== id));
      await api.deleteTask(id);
    }
  };

  const handleCreate = () => {
    setEditingProject(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    if (selectedProject) {
      setEditingProject(selectedProject);
      setIsModalOpen(true);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <Loader />;

  // --- Project Details View ---
  if (selectedProject) {
    let projectTasks = tasks.filter(t => t.projectId === selectedProject.id);

    if (detailFilterStatus !== 'all') {
      projectTasks = projectTasks.filter(t => t.status === detailFilterStatus);
    }
    if (detailSearch) {
      projectTasks = projectTasks.filter(t => t.title.toLowerCase().includes(detailSearch.toLowerCase()));
    }

    return (
      // Optimized height
      <div className="h-full flex flex-col gap-4">
        <div className="flex flex-col gap-4 shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => setSelectedProject(null)}>
                <ArrowLeft size={16} />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  {selectedProject.name}
                  <Badge variant={selectedProject.status === 'active' ? 'success' : 'neutral'}>
                    {translateStatus(selectedProject.status)}
                  </Badge>
                  <button onClick={handleEdit} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                    <Edit2 size={16} />
                  </button>
                </h2>
              </div>
            </div>
            <Button className="gap-2" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={16} /> Nova Tarefa
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Buscar tarefas..."
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 outline-none"
                value={detailFilterStatus}
                onChange={(e) => setDetailFilterStatus(e.target.value)}
              >
                <option value="all">Todos os Status</option>
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Progresso</option>
                <option value="review">Revisão</option>
                <option value="done">Concluído</option>
              </select>

              <div className="flex bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                <button
                  onClick={() => setDetailViewMode('list')}
                  className={`p-1.5 rounded transition-all ${detailViewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setDetailViewMode('board')}
                  className={`p-1.5 rounded transition-all ${detailViewMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Kanban size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 bg-transparent rounded-xl">
          {detailViewMode === 'board' ? (
            <KanbanBoard
              tasks={projectTasks}
              users={users}
              onDrop={handleDropTask}
              onDragStart={handleDragStartTask}
              onDelete={handleDeleteTask}
              onTaskClick={setSelectedTask}
            />
          ) : (
            <div className="overflow-y-auto h-full custom-scrollbar pr-2">
              <TaskTableView
                tasks={projectTasks}
                users={users}
                onDelete={handleDeleteTask}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </div>

        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={loadData}
          projects={projects}
          teams={teams}
          users={users}
          initialData={{ projectId: selectedProject.id }}
        />

        <TaskDetailModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onSuccess={loadData}
          task={selectedTask}
          users={users}
          projects={projects}
          teams={teams}
        />
      </div>
    );
  }

  // --- Projects Grid View ---
  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar projetos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none placeholder:text-slate-500"
          />
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus size={18} /> Novo Projeto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
        {filteredProjects.map(project => (
          <Card key={project.id} onClick={() => setSelectedProject(project)} className="flex flex-col h-full group hover:border-emerald-500/30 transition-all cursor-pointer">
            <div className="flex justify-between items-start mb-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
                {project.name.charAt(0)}
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">{project.name}</h3>
            <p className="text-sm text-slate-400 mb-6 line-clamp-2 flex-1">{project.description}</p>

            <div className="space-y-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Progresso</span>
                <span className="text-white font-medium">{project.progress}%</span>
              </div>
              <ProgressBar progress={project.progress} />

              <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <div className="flex -space-x-2">
                  {project.members.slice(0, 3).map(memberId => {
                    const u = users.find(user => user.id === memberId);
                    return u ? (
                      <div key={u.id} className="ring-2 ring-slate-800 rounded-full">
                        <Avatar size="sm" src={u.avatarUrl} name={u.name} />
                      </div>
                    ) : null;
                  })}
                  {project.members.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-slate-700 ring-2 ring-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                      +{project.members.length - 3}
                    </div>
                  )}
                </div>
                <Badge variant={project.status === 'active' ? 'success' : project.status === 'completed' ? 'default' : 'neutral'}>
                  {translateStatus(project.status)}
                </Badge>
              </div>
            </div>
          </Card>
        ))}

        <button onClick={handleCreate} className="border border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all h-full min-h-[250px] gap-3 group">
          <div className="h-12 w-12 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
            <Plus size={24} />
          </div>
          <span className="font-medium">Criar Novo Projeto</span>
        </button>
      </div>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        users={users}
        initialData={editingProject}
      />
    </div>
  );
};
