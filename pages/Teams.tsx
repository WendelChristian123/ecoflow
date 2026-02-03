
import React, { useEffect, useState } from 'react';
import { Mail, Shield, ArrowLeft, Plus, Search, LayoutList, Kanban, Edit2, Trash2, ChevronDown, ChevronLeft, ChevronRight, X, Filter } from 'lucide-react';
import { Card, Avatar, Loader, Badge, Button, TaskTableView, cn } from '../components/Shared';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// import { KanbanBoard } from '../components/Kanban'; // REMOVED
import { TaskModal, TeamModal, TaskDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { Team, User, Task, Project, Status } from '../types';
import { useAuth } from '../context/AuthContext';

import { KanbanProvider, useKanban } from '../components/Kanban/KanbanContext';
import { KanbanBoard as GenericKanbanBoard } from '../components/Kanban/KanbanBoard';
import { KanbanHeader } from '../components/Kanban/KanbanHeader';
import { TeamCard } from '../components/Teams/TeamCard';
import { TaskCard } from '../components/Tasks/TaskCard';

const TeamKanbanWithContext: React.FC<{
  teams: Team[];
  users: User[];
  onDelete: (id: string, e: React.MouseEvent) => void;
  onEdit: (team: Team, e: React.MouseEvent) => void;
  onClick: (team: Team) => void;
  canMove: boolean;
  valETarget: any; // unused
  isAdmin: boolean;
}> = ({ teams, users, onDelete, onEdit, onClick, canMove, isAdmin }) => {
  const { currentKanban } = useKanban();

  const groupByStage = (entities: Team[], stageId: string) => {
    if (!currentKanban) return [];
    // Teams don't have 'status' usually, maybe just stage?
    // Let's assume they rely purely on kanbanStageId
    return entities.filter(t => t.kanbanStageId === stageId);
  };

  return (
    <div className="flex flex-col h-full">
      <KanbanHeader />
      <div className="flex-1 min-h-0">
        <GenericKanbanBoard
          entities={teams}
          groupByStage={groupByStage}
          renderCard={(team: Team) => (
            <TeamCard
              key={team.id}
              team={team}
              users={users}
              onClick={onClick}
              onDelete={onDelete}
              onEdit={onEdit}
              canMove={canMove}
              isAdmin={isAdmin}
            />
          )}
        />
      </div>
    </div>
  );
};

const TeamTasksKanban: React.FC<{
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

export const TeamsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>(undefined);

  // Standardized Filters State
  /* Filters State */
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'board'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');

  const [detailViewMode, setDetailViewMode] = useState<'list' | 'board'>('board');
  const [detailFilterStatus, setDetailFilterStatus] = useState<string>('all');
  const [detailSearch, setDetailSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Team Details Filters
  const [detailDate, setDetailDate] = useState(new Date());
  const [showDetailMonthFilter, setShowDetailMonthFilter] = useState(true);
  const [detailFilterAssignee, setDetailFilterAssignee] = useState<string>('all');
  const [detailFilterPriority, setDetailFilterPriority] = useState<string>('all');


  useEffect(() => {
    const init = async () => {
      try {
        const [t, u, tk, p] = await Promise.all([
          api.getTeams(),
          api.getUsers(),
          api.getTasks(),
          api.getProjects()
        ]);
        setTeams(t);
        setUsers(u);
        setTasks(tk);
        setProjects(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [tk, t] = await Promise.all([api.getTasks(), api.getTeams()]);
      setTasks(tk);
      setTeams(t);
    } catch (e) {
      console.error(e);
    }
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
    setEditingTeam(undefined);
    setIsTeamModalOpen(true);
  };

  const handleEdit = () => {
    if (selectedTeam) {
      setEditingTeam(selectedTeam);
      setIsTeamModalOpen(true);
    }
  };

  const handleDeleteTeam = async (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    if (!window.confirm("Atenção: Excluir uma equipe não exclui as tarefas, mas remove a atribuição de equipe. Continuar?")) return;
    try {
      await api.deleteTeam(teamId);
      if (selectedTeam?.id === teamId) setSelectedTeam(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir equipe.");
    }
  };

  const filteredTeams = teams.filter(t => {
    const searchMatch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const memberMatch = memberFilter === 'all' || t.memberIds.includes(memberFilter);
    return searchMatch && memberMatch;
  });

  if (loading) return <Loader />;

  // --- Team Details View ---
  if (selectedTeam) {
    let teamTasks = tasks.filter(t => t.teamId === selectedTeam.id);
    const teamLead = users.find(u => u.id === selectedTeam.leadId);

    // 1. Month Filter
    if (showDetailMonthFilter) {
      teamTasks = teamTasks.filter(t => {
        if (!t.dueDate) return false;
        return isSameMonth(parseISO(t.dueDate), detailDate);
      });
    }

    // 2. Status Filter
    if (detailFilterStatus !== 'all') {
      teamTasks = teamTasks.filter(t => t.status === detailFilterStatus);
    }

    // 3. Assignee Filter
    if (detailFilterAssignee !== 'all') {
      teamTasks = teamTasks.filter(t => t.assigneeId === detailFilterAssignee);
    }

    // 4. Priority Filter
    if (detailFilterPriority !== 'all') {
      teamTasks = teamTasks.filter(t => t.priority === detailFilterPriority);
    }

    // 5. Text Search
    if (detailSearch) {
      teamTasks = teamTasks.filter(t => t.title.toLowerCase().includes(detailSearch.toLowerCase()));
    }

    // 6. Sort by Due Date
    teamTasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return (
      // Optimized height
      <div className="h-full flex flex-col gap-4">
        <div className="flex flex-col gap-4 shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => setSelectedTeam(null)}>
                <ArrowLeft size={16} />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  {selectedTeam.name}
                  <Badge variant="neutral">{selectedTeam.memberIds.length} membros</Badge>
                  <button onClick={handleEdit} className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Edit2 size={16} />
                  </button>
                  {['admin', 'owner', 'super_admin'].includes(user?.role || '') && (
                    <button
                      onClick={(e) => handleDeleteTeam(e, selectedTeam.id)}
                      className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                      title="Excluir Equipe"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </h2>
                <p className="text-muted-foreground text-sm">Líder: {teamLead?.name || 'Não atribuído'}</p>
              </div>
            </div>
            <Button className="gap-2" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={16} /> Nova Tarefa
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card/50 p-2 rounded-xl border border-border">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                placeholder="Buscar tarefas..."
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="w-full bg-card border border-input text-foreground text-sm rounded-lg pl-9 pr-3 py-1.5 focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Month Toggle & Selector */}
              <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border">
                <button
                  onClick={() => setShowDetailMonthFilter(!showDetailMonthFilter)}
                  className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors", showDetailMonthFilter ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
                >
                  {showDetailMonthFilter ? 'Mês' : 'Todos'}
                </button>
                {showDetailMonthFilter && (
                  <div className="flex items-center gap-1 pl-1 border-l border-border">
                    <button onClick={() => setDetailDate(subMonths(detailDate, 1))} className="hover:text-foreground text-muted-foreground"><ChevronLeft size={14} /></button>
                    <span className="text-xs font-bold text-foreground uppercase w-20 text-center select-none">
                      {format(detailDate, 'MMMM', { locale: ptBR })}
                    </span>
                    <button onClick={() => setDetailDate(addMonths(detailDate, 1))} className="hover:text-foreground text-muted-foreground"><ChevronRight size={14} /></button>
                  </div>
                )}
              </div>

              {/* Status */}
              <select
                className="bg-card border border-input text-foreground text-xs rounded-lg px-2 py-1.5 outline-none"
                value={detailFilterStatus}
                onChange={(e) => setDetailFilterStatus(e.target.value)}
              >
                <option value="all">Status: Todos</option>
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Progresso</option>
                <option value="review">Revisão</option>
                <option value="done">Concluído</option>
              </select>

              {/* Priority */}
              <select
                className="bg-card border border-input text-foreground text-xs rounded-lg px-2 py-1.5 outline-none"
                value={detailFilterPriority}
                onChange={(e) => setDetailFilterPriority(e.target.value)}
              >
                <option value="all">Prioridade: Todas</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>

              {/* Assignee Filter */}
              <select
                className="bg-card border border-input text-foreground text-xs rounded-lg px-2 py-1.5 outline-none"
                value={detailFilterAssignee}
                onChange={(e) => setDetailFilterAssignee(e.target.value)}
              >
                <option value="all">Membro: Todos</option>
                {selectedTeam.memberIds.map(memberId => {
                  const member = users.find(u => u.id === memberId);
                  return member ? <option key={member.id} value={member.id}>{member.name}</option> : null;
                })}
              </select>

              {/* View Toggle */}
              <div className="flex bg-card rounded-lg border border-border p-0.5">
                <button
                  onClick={() => setDetailViewMode('list')}
                  className={cn("p-1.5 rounded transition-all", detailViewMode === 'list' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setDetailViewMode('board')}
                  className={cn("p-1.5 rounded transition-all", detailViewMode === 'board' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  <Kanban size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 bg-transparent rounded-xl">
          {detailViewMode === 'board' ? (
            <KanbanProvider module="tasks" entityTable="tasks" singleBoardMode={true} onEntityMove={() => loadData(false)}>
              <TeamTasksKanban
                tasks={teamTasks}
                users={users}
                onDelete={handleDeleteTask}
                onTaskClick={setSelectedTask}
                canMove={true}
              />
            </KanbanProvider>
          ) : (
            <div className="overflow-y-auto h-full custom-scrollbar pr-2">
              <TaskTableView
                tasks={teamTasks}
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
          initialData={{ teamId: selectedTeam.id }}
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

        <TeamModal
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          onSuccess={loadData}
          users={users}
          initialData={editingTeam}
        />
      </div>
    );
  }

  // --- Teams Grid View ---
  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">

      {/* Standardized Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Equipes</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas equipes e membros</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative mr-auto">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Filter size={14} />
            </div>
            <input
              type="text"
              placeholder="Buscar equipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border border-input text-foreground pl-9 pr-4 py-1.5 rounded-lg text-sm w-48 focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>



          <Button className="gap-2 whitespace-nowrap bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-[34px]" onClick={handleCreate}>
            <Plus size={16} /> <span className="hidden sm:inline">Nova</span>
          </Button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="flex-1 min-h-0 overflow-x-auto bg-transparent rounded-xl">
          <KanbanProvider module="teams" entityTable="teams" singleBoardMode={true} onEntityMove={() => loadData(false)}>
            <TeamKanbanWithContext
              teams={filteredTeams}
              users={users}
              onDelete={(id, e) => handleDeleteTeam(e, id)}
              onEdit={(team, e) => {
                e.stopPropagation();
                setEditingTeam(team);
                setIsTeamModalOpen(true);
              }}
              onClick={setSelectedTeam}
              canMove={['admin', 'owner', 'super_admin'].includes(user?.role || '')}
              valETarget={null}
              isAdmin={['admin', 'owner', 'super_admin'].includes(user?.role || '')}
            />
          </KanbanProvider>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">

          {teams.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
              Nenhuma equipe encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTeams.map(team => (
                <Card
                  key={team.id}
                  className="p-5 flex flex-col gap-4 hover:bg-accent group cursor-pointer transition-all border border-border hover:border-border/80"
                  onClick={() => setSelectedTeam(team)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {team.name}
                      </h2>
                      <p className="text-muted-foreground text-sm line-clamp-2 mt-1">{team.description}</p>
                    </div>
                    {['admin', 'owner', 'super_admin'].includes(user?.role || '') && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTeam(team);
                            setIsTeamModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title="Editar Equipe"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTeam(e, team.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                          title="Excluir Equipe"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-border">
                    <div className="flex -space-x-2 overflow-hidden py-1">
                      {team.memberIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Sem membros</span>
                      ) : (
                        <>
                          {team.memberIds.slice(0, 5).map(memberId => {
                            const u = users.find(user => user.id === memberId);
                            if (!u) return null;
                            const isLead = team.leadId === u.id;
                            return (
                              <div key={u.id} className={cn("ring-2 ring-card rounded-full", isLead ? 'ring-primary/50' : '')} title={`${u.name}${isLead ? ' (Líder)' : ''}`}>
                                <Avatar size="sm" src={u.avatarUrl} name={u.name} />
                              </div>
                            );
                          })}
                          {team.memberIds.length > 5 && (
                            <div className="h-8 w-8 rounded-full bg-secondary ring-2 ring-card flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                              +{team.memberIds.length - 5}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs ml-auto">
                      {team.memberIds.length} membros
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <TeamModal
            isOpen={isTeamModalOpen}
            onClose={() => setIsTeamModalOpen(false)}
            onSuccess={loadData}
            users={users}
            initialData={editingTeam}
          />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-secondary/20 text-foreground font-medium uppercase text-xs">
              <tr>
                <th className="p-4">Equipe</th>
                <th className="p-4">Líder</th>
                <th className="p-4">Membros</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTeams.map(team => {
                const lead = users.find(u => u.id === team.leadId);
                return (
                  <tr key={team.id} onClick={() => setSelectedTeam(team)} className="hover:bg-muted/10 cursor-pointer transition-colors">
                    <td className="p-4">
                      <span className="font-medium text-foreground block">{team.name}</span>
                      <span className="text-xs text-muted-foreground">{team.description}</span>
                    </td>
                    <td className="p-4">
                      {lead ? (
                        <div className="flex items-center gap-2">
                          <Avatar size="xs" src={lead.avatarUrl} name={lead.name} />
                          <span className="text-foreground">{lead.name}</span>
                        </div>
                      ) : <span className="text-muted-foreground">N/A</span>}
                    </td>
                    <td className="p-4">
                      <div className="flex -space-x-2">
                        {team.memberIds.slice(0, 5).map(memberId => {
                          const u = users.find(user => user.id === memberId);
                          return u ? (
                            <div key={u.id} className="ring-2 ring-card rounded-full">
                              <Avatar size="sm" src={u.avatarUrl} name={u.name} />
                            </div>
                          ) : null;
                        })}
                        {team.memberIds.length > 5 && (
                          <div className="h-6 w-6 rounded-full bg-secondary ring-2 ring-card flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                            +{team.memberIds.length - 5}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button className="p-2 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"><ChevronRight size={16} /></button>
                    </td>
                  </tr>
                );
              })}
              {filteredTeams.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma equipe encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        onSuccess={loadData}
        users={users}
        initialData={editingTeam}
        onDuplicate={(team) => {
          setEditingTeam({
            ...team,
            id: undefined,
            name: `${team.name} (Cópia)`,
            // Reset fields
            members: team.members || [] // Keep members or reset? User said "Campos Duplicados: ... Responsável (Task), Projeto...". For Teams: "Campos Duplicados: (Implied same approach)". I'll keep members.
          });
        }}
      />
    </div>
  );
};
