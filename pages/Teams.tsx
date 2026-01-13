
import React, { useEffect, useState } from 'react';
import { Mail, Shield, ArrowLeft, Plus, Search, LayoutList, Kanban, Edit2, Trash2, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card, Avatar, Loader, Badge, Button, TaskTableView } from '../components/Shared';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanBoard } from '../components/Kanban';
import { TaskModal, TeamModal, TaskDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { Team, User, Task, Project, Status } from '../types';
import { useAuth } from '../context/AuthContext';

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
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

  const loadData = async () => {
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
                  <button onClick={handleEdit} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                    <Edit2 size={16} />
                  </button>
                  {['admin', 'owner', 'super_admin'].includes(user?.role || '') && (
                    <button
                      onClick={(e) => handleDeleteTeam(e, selectedTeam.id)}
                      className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Excluir Equipe"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </h2>
                <p className="text-slate-400 text-sm">Líder: {teamLead?.name || 'Não atribuído'}</p>
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

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Month Toggle & Selector */}
              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setShowDetailMonthFilter(!showDetailMonthFilter)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${showDetailMonthFilter ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                >
                  {showDetailMonthFilter ? 'Mês' : 'Todos'}
                </button>
                {showDetailMonthFilter && (
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
                    <button onClick={() => setDetailDate(subMonths(detailDate, 1))} className="hover:text-white text-slate-400"><ChevronLeft size={14} /></button>
                    <span className="text-xs font-bold text-white uppercase w-20 text-center select-none">
                      {format(detailDate, 'MMMM', { locale: ptBR })}
                    </span>
                    <button onClick={() => setDetailDate(addMonths(detailDate, 1))} className="hover:text-white text-slate-400"><ChevronRight size={14} /></button>
                  </div>
                )}
              </div>

              {/* Status */}
              <select
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 outline-none"
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
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 outline-none"
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
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 outline-none"
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
              tasks={teamTasks}
              users={users}
              onDrop={handleDropTask}
              onDragStart={handleDragStartTask}
              onDelete={handleDeleteTask}
              onTaskClick={setSelectedTask}
            />
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Equipes</h1>
          <p className="text-slate-400 mt-1">Gerencie suas equipes e membros</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Filter size={14} />
            </div>
            <input
              type="text"
              placeholder="Buscar equipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-1.5 rounded-lg text-sm w-48 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
            />
          </div>

          {/* Member */}
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-emerald-500 outline-none max-w-[140px]"
          >
            <option value="all">Membro: Todos</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <LayoutList size={16} />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <Kanban size={16} />
            </button>
          </div>

          <Button className="gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-[34px]" onClick={handleCreate}>
            <Plus size={16} /> <span className="hidden sm:inline">Nova</span>
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="space-y-4">

          {teams.length === 0 ? (
            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
              Nenhuma equipe encontrada.
            </div>
          ) : (
            teams.map(team => (
              <div key={team.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h2
                      className="text-xl font-bold text-white hover:text-emerald-400 cursor-pointer transition-colors"
                      onClick={() => setSelectedTeam(team)}
                    >
                      {team.name}
                    </h2>
                    <p className="text-slate-400 text-sm">{team.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(team)}>
                      Ver Tarefas da Equipe
                    </Button>
                    <Badge variant="neutral">{team.memberIds.length} membros</Badge>
                    {['admin', 'owner', 'super_admin'].includes(user?.role || '') && (
                      <div className="flex items-center gap-1 border-l border-slate-700 pl-3 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTeam(team);
                            setIsTeamModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                          title="Editar Equipe"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTeam(e, team.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-700"
                          title="Excluir Equipe"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                  {team.memberIds.map(memberId => {
                    const member = users.find(u => u.id === memberId);
                    if (!member) return null;
                    const isLead = team.leadId === member.id;

                    return (
                      <Card key={member.id} className="p-4 flex items-center gap-4 hover:bg-slate-800/80 group">
                        <Avatar size="lg" src={member.avatarUrl} name={member.name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h3 className="font-medium text-slate-200 truncate pr-2">{member.name}</h3>
                            {isLead && <span title="Líder da Equipe"><Shield size={14} className="text-amber-400 shrink-0" /></span>}
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{member.role}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Mail size={12} />
                            <span className="truncate">{member.email}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-200 font-medium uppercase text-xs">
              <tr>
                <th className="p-4">Equipe</th>
                <th className="p-4">Líder</th>
                <th className="p-4">Membros</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTeams.map(team => {
                const lead = users.find(u => u.id === team.leadId);
                return (
                  <tr key={team.id} onClick={() => setSelectedTeam(team)} className="hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <td className="p-4">
                      <span className="font-medium text-white block">{team.name}</span>
                      <span className="text-xs text-slate-500">{team.description}</span>
                    </td>
                    <td className="p-4">
                      {lead ? (
                        <div className="flex items-center gap-2">
                          <Avatar size="xs" src={lead.avatarUrl} name={lead.name} />
                          <span className="text-white">{lead.name}</span>
                        </div>
                      ) : <span className="text-slate-600">N/A</span>}
                    </td>
                    <td className="p-4">
                      <div className="flex -space-x-2">
                        {team.memberIds.slice(0, 5).map(memberId => {
                          const u = users.find(user => user.id === memberId);
                          return u ? (
                            <div key={u.id} className="ring-2 ring-slate-900 rounded-full">
                              <Avatar size="sm" src={u.avatarUrl} name={u.name} />
                            </div>
                          ) : null;
                        })}
                        {team.memberIds.length > 5 && (
                          <div className="h-6 w-6 rounded-full bg-slate-700 ring-2 ring-slate-900 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                            +{team.memberIds.length - 5}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ChevronRight size={16} /></button>
                    </td>
                  </tr>
                );
              })}
              {filteredTeams.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhuma equipe encontrada.</td></tr>
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
      />
    </div>
  );
};
