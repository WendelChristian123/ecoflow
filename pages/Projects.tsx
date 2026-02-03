
import React, { useEffect, useState } from 'react';
import { Plus, Search, MoreVertical, ArrowLeft, LayoutList, Kanban, Edit2, Trash2, CheckCircle, Filter, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card, Badge, ProgressBar, Button, Loader, Avatar, TaskTableView } from '../components/Shared';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// import { KanbanBoard } from '../components/Kanban'; // REMOVED
import { TaskModal, ProjectModal, TaskDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { Project, User, Team, Task, Status } from '../types';
import { useLocation } from 'react-router-dom';


import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { KanbanProvider, useKanban } from '../components/Kanban/KanbanContext';
import { KanbanBoard as GenericKanbanBoard } from '../components/Kanban/KanbanBoard';
import { KanbanHeader } from '../components/Kanban/KanbanHeader';
import { ProjectCard } from '../components/Projects/ProjectCard';
import { TaskCard } from '../components/Tasks/TaskCard';
import { Settings } from 'lucide-react';
import { StageManagerModal } from '../components/Kanban/StageManagerModal';

const ProjectKanbanWithContext: React.FC<{
  projects: Project[];
  users: User[];
  onDelete: (id: string) => void;
  onClick: (project: Project) => void;
  canMove: boolean;
  hideHeader?: boolean;
}> = ({ projects, users, onDelete, onClick, canMove, hideHeader }) => {
  const { currentKanban } = useKanban();

  const groupByStage = (entities: Project[], stageId: string) => {
    if (!currentKanban) return [];
    const stage = currentKanban.stages.find(s => s.id === stageId);
    return entities.filter(p => {
      if (p.kanbanStageId === stageId) return true;
      // Fallback: Map 'systemStatus' to 'status'
      if (!p.kanbanStageId && stage?.systemStatus && p.status === stage.systemStatus) return true;
      return false;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && <KanbanHeader />}
      <div className="flex-1 min-h-0">
        <GenericKanbanBoard
          entities={projects}
          groupByStage={groupByStage}
          renderCard={(project: Project) => (
            <ProjectCard
              key={project.id}
              project={project}
              users={users}
              onClick={onClick}
              onDelete={onDelete}
              canMove={canMove}
            />
          )}
        />
      </div>
    </div>
  );
};

const ProjectTasksKanban: React.FC<{
  tasks: Task[];
  users: User[];
  onDelete: (id: string) => void;
  onTaskClick: (task: Task) => void;
  canMove: boolean;
}> = ({ tasks, users, onDelete, onTaskClick, canMove }) => {
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
    <div className="flex flex-col h-full">
      <KanbanHeader />
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
  );
};


export const ProjectsPage: React.FC = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
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

  // Project Details Filters
  const [detailDate, setDetailDate] = useState(new Date());
  const [showDetailMonthFilter, setShowDetailMonthFilter] = useState(true);
  const [detailFilterAssignee, setDetailFilterAssignee] = useState<string>('all');
  const [detailFilterPriority, setDetailFilterPriority] = useState<string>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  // Standardized Filters State
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'board'>('grid');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  // No priority for projects

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

  const loadData = async (showLoading = true) => {
    if (!currentTenant) return;
    if (showLoading) setLoading(true);
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

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja excluir o projeto "${project.name}"?`)) return;

    try {
      await api.deleteProject(project.id);
      if (selectedProject?.id === project.id) setSelectedProject(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir projeto.");
    }
  };

  const handleCompleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!window.confirm(`Deseja concluir o projeto "${project.name}"? Isso também marcará todas as tarefas como concluídas.`)) return;

    try {
      await api.completeProject(project.id);
      loadData();
      if (selectedProject?.id === project.id) {
        // Update local state to reflect changes immediately if viewing details
        setSelectedProject({ ...project, status: 'completed' });
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao concluir projeto.");
    }
  };

  const calculateProgress = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const total = projectTasks.length;
    if (total === 0) return 0;
    const completed = projectTasks.filter(t => t.status === 'done').length;
    return Math.round((completed / total) * 100);
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

  // Filter Logic
  const filteredProjects = projects.filter(p => {
    // 1. Search
    const searchMatch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Month (Due Date)
    // REMOVED: Projects should be visible regardless of due date in the main list, unless explicitly filtered.
    // const dateMatch = !p.dueDate || isSameMonth(parseISO(p.dueDate), currentMonth);
    const dateMatch = true;

    // 3. Status
    const statusMatch = statusFilter === 'all' || p.status === statusFilter;

    // 4. Member
    const memberMatch = memberFilter === 'all' || p.members.includes(memberFilter);

    return searchMatch && dateMatch && statusMatch && memberMatch;
  });

  if (loading) return <Loader />;

  // --- Project Details View ---
  if (selectedProject) {
    let projectTasks = tasks.filter(t => t.projectId === selectedProject.id);

    // 1. Month Filter
    if (showDetailMonthFilter) {
      projectTasks = projectTasks.filter(t => {
        if (!t.dueDate) return false;
        return isSameMonth(parseISO(t.dueDate), detailDate);
      });
    }

    // 2. Status Filter
    if (detailFilterStatus !== 'all') {
      projectTasks = projectTasks.filter(t => t.status === detailFilterStatus);
    }

    // 3. Assignee Filter
    if (detailFilterAssignee !== 'all') {
      projectTasks = projectTasks.filter(t => t.assigneeId === detailFilterAssignee);
    }

    // 4. Priority Filter
    if (detailFilterPriority !== 'all') {
      projectTasks = projectTasks.filter(t => t.priority === detailFilterPriority);
    }

    // 5. Text Search
    if (detailSearch) {
      projectTasks = projectTasks.filter(t => t.title.toLowerCase().includes(detailSearch.toLowerCase()));
    }

    // 6. Sort by Due Date
    projectTasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return (
      // Optimized height
      <div className="h-full flex flex-col gap-4">
        <div className="flex flex-col gap-4 shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => setSelectedProject(null)}>
                <ArrowLeft size={16} />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                  {selectedProject.name}
                  <Badge variant={selectedProject.status === 'active' ? 'success' : 'neutral'}>
                    {translateStatus(selectedProject.status)}
                  </Badge>
                  <button onClick={handleEdit} className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Editar Projeto">
                    <Edit2 size={16} />
                  </button>
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={(e) => handleCompleteProject(e, selectedProject)}
                        className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-emerald-500 transition-colors"
                        title="Concluir Projeto (e todas tarefas)"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProject(e, selectedProject)}
                        className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                        title="Excluir Projeto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </h2>
              </div>
            </div>
            <Button className="gap-2" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={16} /> Nova Tarefa
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* 1. Search - Pushed to Left */}
            <div className="relative mr-auto">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Buscar tarefas..."
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="bg-card border border-border text-foreground pl-9 pr-4 py-1.5 rounded-lg text-sm w-64 focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            {/* 2. Month Nav */}
            <div className="flex bg-card border border-border rounded-lg p-0.5 items-center">
              <button onClick={() => setDetailDate(subMonths(detailDate, 1))} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-foreground uppercase px-2 w-24 text-center select-none">{format(detailDate, 'MMM/yyyy', { locale: ptBR })}</span>
              <button onClick={() => setDetailDate(addMonths(detailDate, 1))} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={16} /></button>
            </div>

            {/* 3. Status */}
            <select
              value={detailFilterStatus}
              onChange={(e) => setDetailFilterStatus(e.target.value)}
              className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="all">Status: Todos</option>
              <option value="todo">A Fazer</option>
              <option value="in_progress">Em Progresso</option>
              <option value="review">Revisão</option>
              <option value="done">Concluído</option>
            </select>

            {/* 4. Priority */}
            <select
              value={detailFilterPriority}
              onChange={(e) => setDetailFilterPriority(e.target.value)}
              className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="all">Prioridade: Todas</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>

            {/* 5. Assignee */}
            <select
              value={detailFilterAssignee}
              onChange={(e) => setDetailFilterAssignee(e.target.value)}
              className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none max-w-[140px]"
            >
              <option value="all">Resp: Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            {/* 6. View Toggle */}
            <div className="flex bg-card border border-border rounded-lg p-0.5">
              <button onClick={() => setDetailViewMode('list')} className={`p-1.5 rounded transition-all ${detailViewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                <LayoutList size={16} />
              </button>
              <button onClick={() => setDetailViewMode('board')} className={`p-1.5 rounded transition-all ${detailViewMode === 'board' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                <Kanban size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 bg-transparent rounded-xl">
          {detailViewMode === 'board' ? (
            <KanbanProvider module="tasks" entityTable="tasks" singleBoardMode={true} onEntityMove={() => loadData(false)}>
              <ProjectTasksKanban
                tasks={projectTasks}
                users={users}
                onDelete={handleDeleteTask}
                onTaskClick={setSelectedTask}
                canMove={true} // Detail view usually allows move
              />
            </KanbanProvider>
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

  // --- Projects View ---
  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">

      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Projetos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus projetos e entregas</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Filter size={14} />
            </div>
            <input
              type="text"
              placeholder="Buscar projetos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border border-border text-foreground pl-9 pr-4 py-1.5 rounded-lg text-sm w-48 focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* New Button */}
          <Button className="gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-[34px]" onClick={handleCreate}>
            <Plus size={16} /> Novo
          </Button>

          {/* View Toggle */}
          <div className="flex bg-card border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutList size={16} />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <span className="text-xs font-bold px-1">Grid</span>
            </button>
            <button onClick={() => setViewMode('board')} className={`p-1.5 rounded transition-all ${viewMode === 'board' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Kanban size={16} />
            </button>
          </div>

          {/* Manage Stages - Only in Board View */}
          {viewMode === 'board' && (
            <button
              onClick={() => setIsStageManagerOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-secondary transition-colors border border-border h-[34px]"
            >
              <Settings size={14} />
              Gerenciar Etapas
            </button>
          )}
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="flex-1 min-h-0 overflow-x-auto bg-transparent rounded-xl">
          <KanbanProvider module="projects" entityTable="projects" singleBoardMode={true} onEntityMove={() => loadData(false)}>
            <ProjectKanbanWithContext
              projects={filteredProjects}
              users={users}
              onDelete={(id) => {
                // We need project object for handleDeleteProject
                const proj = projects.find(p => p.id === id);
                if (proj) handleDeleteProject({ stopPropagation: () => { } } as any, proj);
              }}
              onClick={setSelectedProject}
              canMove={user?.role === 'admin'}
              hideHeader={true}
            />
          </KanbanProvider>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
          {filteredProjects.map(project => (
            <Card key={project.id} onClick={() => setSelectedProject(project)} className="flex flex-col h-full group hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-lg">
                  {project.name.charAt(0)}
                </div>
                {user?.role === 'admin' && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleCompleteProject(e, project)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-secondary"
                      title="Concluir"
                    >
                      <CheckCircle size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(e, project)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-2">{project.name}</h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-2 flex-1">{project.description}</p>

              <div className="space-y-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="text-foreground font-medium">{calculateProgress(project.id)}%</span>
                </div>
                <ProgressBar progress={calculateProgress(project.id)} />

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex -space-x-2">
                    {project.members.slice(0, 3).map(memberId => {
                      const u = users.find(user => user.id === memberId);
                      return u ? (
                        <div key={u.id} className="ring-2 ring-card rounded-full">
                          <Avatar size="sm" src={u.avatarUrl} name={u.name} />
                        </div>
                      ) : null;
                    })}
                    {project.members.length > 3 && (
                      <div className="h-6 w-6 rounded-full bg-secondary ring-2 ring-card flex items-center justify-center text-[10px] text-muted-foreground font-medium">
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

          <button onClick={handleCreate} className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all h-full min-h-[250px] gap-3 group">
            <div className="h-12 w-12 rounded-full bg-secondary group-hover:bg-primary/20 flex items-center justify-center transition-colors">
              <Plus size={24} />
            </div>
            <span className="font-medium">Criar Novo Projeto</span>
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-secondary text-foreground font-medium uppercase text-xs">
              <tr>
                <th className="p-4">Projeto</th>
                <th className="p-4">Status</th>
                <th className="p-4">Progresso</th>
                <th className="p-4">Prazo</th>
                <th className="p-4">Membros</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjects.map(p => (
                <tr key={p.id} onClick={() => setSelectedProject(p)} className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <td className="p-4 font-medium text-foreground">{p.name}</td>
                  <td className="p-4">
                    <Badge variant={p.status === 'active' ? 'success' : p.status === 'completed' ? 'default' : 'neutral'}>
                      {translateStatus(p.status)}
                    </Badge>
                  </td>
                  <td className="p-4 w-48">
                    <div className="flex items-center gap-2">
                      <ProgressBar progress={calculateProgress(p.id)} className="flex-1" />
                      <span className="text-xs">{calculateProgress(p.id)}%</span>
                    </div>
                  </td>
                  <td className="p-4">{p.dueDate ? format(parseISO(p.dueDate), 'dd/MM/yyyy') : '-'}</td>
                  <td className="p-4">
                    <div className="flex -space-x-2">
                      {p.members.slice(0, 3).map(memberId => {
                        const u = users.find(user => user.id === memberId);
                        return u ? (
                          <div key={u.id} className="ring-2 ring-card rounded-full">
                            <Avatar size="sm" src={u.avatarUrl} name={u.name} />
                          </div>
                        ) : null;
                      })}
                      {p.members.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-secondary ring-2 ring-card flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                          +{p.members.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-2 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"><ChevronRight size={16} /></button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum projeto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        users={users}
        initialData={editingProject}
        onDuplicate={(project) => {
          setEditingProject({
            ...project,
            id: undefined,
            name: `${project.name} (Cópia)`,
            status: 'active',
            progress: 0,
            // Keep other fields like description, members, dueDate?
            // User said "Resetar... Datas de criação...". DueDate is deadline, optional reset.
            // I'll keep DueDate as is or maybe reset? Project deadline usually shifts.
            // But for "Duplicate", keeping it is safer than empty.
          });
        }}
      />

      <StageManagerModal
        isOpen={isStageManagerOpen}
        onClose={() => setIsStageManagerOpen(false)}
      />
    </div>
  );
};
