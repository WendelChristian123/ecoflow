import React, { useEffect, useState } from 'react';
import { processTransactions } from '../services/financeLogic';
import { ChevronLeft, ChevronRight, Clock, Plus, Users as UsersIcon, Calendar as CalendarIcon, CheckCircle2, AlertCircle, DollarSign, CreditCard, FileText, CheckSquare, Search, Filter } from 'lucide-react';
import { Card, Loader, Button, Badge, Avatar, Input, Select } from '../components/Shared';
import { EventModal, EventDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { CalendarEvent, User, CalendarSettings, Task, FinancialTransaction, Quote, CreditCard as ICreditCard, Project, Team } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, parseISO, isValid, getHours, getMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type ViewMode = 'month' | 'week' | 'day';
type FilterType = 'all' | 'agenda' | 'task' | 'finance';

// Extended Event Type for UI
interface UnifiedEvent extends CalendarEvent {
  origin: 'agenda' | 'task' | 'finance_payable' | 'finance_receivable' | 'finance_budget' | 'finance_card';
  metadata?: any; // Original object
  color?: string;
  icon?: React.ReactNode;
}

export const AgendaPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  console.log('[Agenda] Component Rendering');
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // STRICT:
  const [assignableTaskUsers, setAssignableTaskUsers] = useState<User[]>([]);
  const [assignableEventUsers, setAssignableEventUsers] = useState<User[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // State for Navigation vs Selection
  const [viewDate, setViewDate] = useState(new Date()); // Controls the Month displayed
  const [selectedDate, setSelectedDate] = useState(new Date()); // Controls the sidebar

  // UI State
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);

  const location = useLocation();

  useEffect(() => {
    loadData();
  }, [viewDate]); // Reload date range changes

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[Agenda] loadData started');
      // 1. Fetch Settings & Users (Always needed)
      // Also fetch Delegators strictly
      const [settings, u, p, t, taskDelegators, agendaDelegators] = await Promise.all([
        api.getTenantSettings(),
        api.getUsers(),
        api.getProjects(),
        api.getTeams(),
        api.getDelegators('tasks'),
        api.getDelegators('agenda')
      ]);
      setUsers(u);
      setProjects(p);
      setTeams(t);

      if (user) {
        if (user.role === 'admin' || user.role === 'owner' || user.role === 'super_admin') {
          setAssignableTaskUsers(u);
          setAssignableEventUsers(u);
        } else {
          const taskAllowed = [user.id, ...taskDelegators];
          setAssignableTaskUsers(u.filter(x => taskAllowed.includes(x.id)));

          const agendaAllowed = [user.id, ...agendaDelegators];
          setAssignableEventUsers(u.filter(x => agendaAllowed.includes(x.id)));
        }
      } else {
        setAssignableTaskUsers([]);
        setAssignableEventUsers([]);
      }

      console.log('[Agenda] Basic data loaded');

      const calSettings: CalendarSettings = settings?.calendar || {
        commitments: true,
        tasks: true,
        financial: { enabled: true, budgets: true, receivable: true, payable: true, credit_card: true }
      };

      const promises: Promise<any>[] = [];
      const newEvents: UnifiedEvent[] = [];

      // 2. Commitments (Level 1)
      if (calSettings.commitments !== false) {
        promises.push(api.getEvents().then(data => {
          data.forEach(e => newEvents.push({
            ...e,
            origin: 'agenda',
            color: e.isTeamEvent ? 'bg-indigo-500/20 text-indigo-300 border-l-4 border-indigo-500' : 'bg-emerald-500/20 text-emerald-300 border-l-4 border-emerald-500',
            icon: <UsersIcon size={14} />
          }));
        }));
      }

      // 3. Tasks (Level 2)
      if (calSettings.tasks !== false) {
        promises.push(api.getTasks().then(data => {
          data.forEach(t => {
            if (!t.dueDate) return;
            newEvents.push({
              id: `task-${t.id}`,
              title: t.title,
              description: t.description,
              startDate: t.dueDate, // Use full ISO to preserve timezone
              endDate: t.dueDate,
              status: t.status === 'done' ? 'completed' : 'pending',
              type: 'task',
              isTeamEvent: false,
              participants: t.assigneeId ? [t.assigneeId] : [],
              links: t.links?.map(l => ({ title: 'Link', url: l })) || [],
              origin: 'task',
              metadata: t,
              color: 'bg-blue-500/20 text-blue-300 border-l-4 border-blue-500',
              icon: <CheckSquare size={14} />
            });
          });
        }));
      }

      // 4. Finance (Level 3)
      if (calSettings.financial?.enabled !== false) {
        const fin = calSettings.financial;

        // Budgets/Quotes
        if (fin?.budgets !== false) {
          promises.push(api.getQuotes().then(data => {
            data.forEach(q => {
              if (!q.validUntil || q.status === 'approved' || q.status === 'rejected') return;
              newEvents.push({
                id: `quote-${q.id}`,
                title: `Venc. Orçamento: ${q.customerName || 'Cliente'}`,
                description: `Valor: R$ ${q.totalValue}`,
                startDate: q.validUntil,
                endDate: q.validUntil,
                status: 'pending',
                type: 'reminder',
                isTeamEvent: false,
                participants: [],
                links: [],
                origin: 'finance_budget',
                metadata: q,
                color: 'bg-amber-500/20 text-amber-300 border-l-4 border-amber-500',
                icon: <FileText size={14} />
              });
            });
          }));
        }

        // Unified Finance Data Fetching & Processing
        // We fetch everything if ANY finance module is active to ensure correct calculations (linked transactions etc)
        if (fin?.receivable !== false || fin?.payable !== false || fin?.credit_card !== false) {
          const [transactions, cards] = await Promise.all([
            api.getFinancialTransactions(),
            api.getCreditCards()
          ]);

          // Process using Cash Mode logic to get Virtual Invoices and filtered views
          // Use 'cash' mode to generate Virtual Invoices for Credit Cards
          const processed = processTransactions(transactions, cards, 'cash');

          processed.forEach(t => {
            // Filter out internal/technical if needed, or keeping them?
            // Usually we want to show what the logic returned.

            // 1. Credit Card Invoices (Virtual)
            if (t.isVirtual && fin?.credit_card !== false) {
              // Extract Card Name from description "Fatura – [Name]" or use ID mapping if possible.
              // Logic usually sets description. Let's use it or metadata if available.
              // Actually, t.description is "Fatura – [CardName]" from logic.
              newEvents.push({
                id: t.id, // e.g. virtual-invoice-cardId-date
                title: `Vencimento: ${t.description.replace('Fatura – ', '')}`,
                description: `Valor da Fatura`, // Will be shown as metadata amount too
                startDate: t.date,
                endDate: t.date,
                status: 'pending',
                type: 'reminder',
                isTeamEvent: false,
                participants: [],
                links: [],
                origin: 'finance_card',
                metadata: {
                  ...t,
                  amount: t.amount // Ensure amount is passed for Card component to render
                },
                color: 'bg-rose-500/20 text-rose-300 border-l-4 border-rose-500',
                icon: <CreditCard size={14} />
              });
            }
            // 2. Real Transactions (Receivables / Payables)
            else if (!t.isVirtual && !t.isPaid) {
              // Exclude Credit Card individual purchases if they are hidden (which processTransactions 'cash' mode often does? 
              // Wait, 'cash' mode HIDES individual card expenses. So we are good.
              // We only see "Direct" expenses/incomes.

              // Receivables
              if (t.type === 'income' && fin?.receivable !== false) {
                newEvents.push({
                  id: `fin-inc-${t.id}`,
                  title: `Receber: ${t.description}`,
                  description: `Categoria: ${t.category?.name || 'Geral'}`,
                  startDate: t.date.split('T')[0],
                  endDate: t.date.split('T')[0],
                  status: 'pending',
                  type: 'reminder',
                  isTeamEvent: false,
                  participants: [],
                  links: t.links?.map(l => ({ title: 'Link', url: l })) || [],
                  origin: 'finance_receivable',
                  metadata: t,
                  color: 'bg-emerald-500/20 text-emerald-300 border-l-4 border-emerald-500',
                  icon: <DollarSign size={14} />
                });
              }
              // Payables
              if (t.type === 'expense' && fin?.payable !== false) {
                newEvents.push({
                  id: `fin-exp-${t.id}`,
                  title: `Pagar: ${t.description}`,
                  description: `Categoria: ${t.category?.name || 'Geral'}`,
                  startDate: t.date.split('T')[0],
                  endDate: t.date.split('T')[0],
                  status: 'pending',
                  type: 'reminder',
                  isTeamEvent: false,
                  participants: [],
                  links: t.links?.map(l => ({ title: 'Link', url: l })) || [],
                  origin: 'finance_payable',
                  metadata: t,
                  color: 'bg-rose-500/20 text-rose-300 border-l-4 border-rose-500',
                  icon: <AlertCircle size={14} />
                });
              }
            }
          });
        }
      }

      await Promise.all(promises);
      setEvents(newEvents);
      console.log('[Agenda] Events set:', newEvents.length);

    } catch (e) {
      console.error('[Agenda] loadData Error:', e);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // UI Handlers
  const handleCreate = () => {
    setEditingEvent(undefined);
    setIsCreateModalOpen(true);
  };

  const handleEdit = () => {
    if (selectedEvent && selectedEvent.origin === 'agenda') {
      setEditingEvent(selectedEvent);
      setSelectedEvent(null);
      setIsCreateModalOpen(true);
    } else {
      alert("Este evento é gerenciado em outro módulo.");
    }
  };

  const handlePrevMonth = () => setViewDate(subMonths(viewDate, 1));
  const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));
  const handleToday = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDate(now);
  };

  const getFilteredEvents = () => {
    let filtered = events;

    // Filter Type
    if (activeFilter === 'agenda') filtered = filtered.filter(e => e.origin === 'agenda');
    if (activeFilter === 'task') filtered = filtered.filter(e => e.origin === 'task');
    if (activeFilter === 'finance') filtered = filtered.filter(e => e.origin.startsWith('finance'));

    // Filter Search
    if (searchTerm) {
      const lowerString = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(lowerString) ||
        e.description?.toLowerCase().includes(lowerString)
      );
    }

    // Filter Assignee (Strict)
    if (assigneeFilter !== 'all') {
      filtered = filtered.filter(e => {
        // Check participants array (which includes task assignee)
        return e.participants && e.participants.includes(assigneeFilter);
      });
    }

    return filtered;
  };

  const filteredEvents = getFilteredEvents();
  const selectedDayEvents = filteredEvents
    .filter(e => isSameDay(parseISO(e.startDate), selectedDate))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  if (loading) return <Loader />;

  // Helper to get solid colors for grid text pills based on event type/color
  const getEventPillClass = (event: UnifiedEvent) => {
    if (event.origin === 'agenda') {
      return event.isTeamEvent ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white';
    }
    if (event.origin === 'task') return 'bg-blue-600 text-white';
    if (event.origin === 'finance_budget') return 'bg-amber-600 text-white';
    if (event.origin === 'finance_payable') return 'bg-rose-600 text-white';
    if (event.origin === 'finance_receivable') return 'bg-emerald-600 text-white';
    if (event.origin === 'finance_card') return event.id.includes('close') ? 'bg-purple-600 text-white' : 'bg-rose-500 text-white';
    return 'bg-slate-700 text-slate-300';
  };

  return (
    <div className="h-full flex flex-col space-y-3">
      {/* TOP BAR: FILTERS & SEARCH - Compacted */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex bg-secondary/50 rounded-full p-0.5 border border-border/50">
          {[
            { id: 'all', label: 'Todos', icon: CheckCircle2 },
            { id: 'agenda', label: 'Compromissos', icon: CalendarIcon },
            { id: 'task', label: 'Tarefas', icon: CheckSquare },
            { id: 'finance', label: 'Financeiro', icon: DollarSign },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as FilterType)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${activeFilter === filter.id ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
            >
              {filter.id === activeFilter && <filter.icon size={12} />}
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-96">


          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Buscar..."
              className="pl-8 py-1 text-xs bg-card border-border rounded-full focus:ring-emerald-500/50 h-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

        {/* LEFT: CALENDAR GRID */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-lg">
          {/* Header Month/Nav - Compacted */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 bg-secondary/30">
            <h2 className="text-lg font-bold text-foreground capitalize flex items-center gap-2">
              <CalendarIcon size={16} className="text-emerald-500" />
              {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <Select
                value={assigneeFilter}
                onChange={e => setAssigneeFilter(e.target.value)}
                className="h-7 text-xs py-1 rounded-md bg-secondary border-border w-32 focus:ring-emerald-500/50"
              >
                <option value="all">Todos</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handlePrevMonth} className="rounded-full w-6 h-6 p-0 text-muted-foreground"><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" onClick={handleToday} className="rounded-full px-2 h-6 text-muted-foreground hover:text-foreground text-[9px] uppercase tracking-wider font-bold">Hoje</Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth} className="rounded-full w-6 h-6 p-0 text-muted-foreground"><ChevronRight size={14} /></Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-secondary/30 shrink-0">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                {day}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 grid-rows-6 h-full min-h-0 divide-x divide-y divide-border border-l border-t border-border bg-card">
            {eachDayOfInterval({
              start: startOfWeek(startOfMonth(viewDate)),
              end: endOfWeek(endOfMonth(viewDate))
            }).map((day, idx) => {
              const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.startDate), day));
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isTodayDate = isToday(day);

              // Show more events, but visually smaller
              const visibleEvents = dayEvents.slice(0, 5);
              const hiddenCount = dayEvents.length - 5;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`relative p-1 transition-all cursor-pointer group flex flex-col gap-0.5 overflow-hidden 
                                        ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-card'}
                                        ${isSelected ? 'bg-secondary/80 shadow-[inset_0_0_0_2px_rgba(16,185,129,0.5)]' : 'hover:bg-secondary/20'}
                                    `}
                >
                  <div className="flex justify-start items-start mb-0.5">
                    <span className={`text-[10px] h-5 w-5 flex items-center justify-center rounded-full shrink-0 transition-colors font-bold
                                            ${isTodayDate ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : (isSelected ? 'text-emerald-500' : (isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'))}
                                        `}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-0.5 overflow-hidden w-full px-0.5">
                    {visibleEvents.map(event => {
                      const isCompleted = event.status === 'completed' || event.status === 'done' || event.metadata?.isPaid === true;
                      return (
                        <div
                          key={event.id}
                          className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-medium truncate w-full shadow-sm leading-tight
                                                      ${getEventPillClass(event)}
                                                      ${isCompleted ? 'line-through opacity-60 decoration-muted-foreground' : ''}
                                                  `}
                          title={event.title}
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <div className="px-1 text-center">
                        <span className="text-[8px] leading-none text-muted-foreground font-medium hover:text-foreground transition-colors">+ {hiddenCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: SIDEBAR - Ultra Compacted */}
        <div className="w-72 flex flex-col bg-card border border-border rounded-xl shadow-xl overflow-hidden shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-secondary/30">
            <div>
              <h3 className="text-sm font-bold text-foreground capitalize leading-tight">
                {format(selectedDate, 'EEEE, d', { locale: ptBR })}
              </h3>
              <p className="text-[10px] text-muted-foreground capitalize">
                {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
              </p>
            </div>

            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 h-7 px-2.5 text-[10px] font-bold rounded-lg uppercase tracking-wide"
              onClick={handleCreate}
            >
              <Plus size={12} className="mr-1" /> Novo
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar relative">
            {/* Current Time Indicator only if Today */}
            {isToday(selectedDate) && (
              <div
                className="absolute left-0 w-full border-t border-emerald-500/50 flex items-center pl-1 z-10 pointer-events-none"
                style={{ top: `${Math.max(2, Math.min(98, (getHours(new Date()) * 60 + getMinutes(new Date())) / 1440 * 100))}%` }}
              >
                <span className="text-[8px] bg-emerald-500 text-white px-1 py-0.5 rounded uppercase font-bold tracking-wider">Agora</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 mb-1 opacity-70">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Agenda do Dia</span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border border-dashed border-border rounded-lg bg-secondary/30">
                <Clock size={20} className="mb-1 opacity-50" />
                <p className="text-[10px]">Nada agendado</p>
              </div>
            ) : (
              selectedDayEvents.map(event => {
                const isFinance = event.origin.startsWith('finance');
                const isPayable = event.origin === 'finance_payable';
                const isReceivable = event.origin === 'finance_receivable';

                return (
                  <Card
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`relative p-3 border-0 cursor-pointer hover:translate-x-1 transition-transform group
                                          ${event.color || 'bg-secondary/40 hover:bg-secondary border-l-[3px] border-muted-foreground'}
                                      `}
                  >
                    {/* Header: Time */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-80 text-foreground">
                        {event.icon}
                        {format(parseISO(event.startDate), 'HH:mm')}
                      </div>

                      {/* Assignees / Participants */}
                      {event.participants && event.participants.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {event.participants.slice(0, 3).map(pid => {
                            const u = users.find(x => x.id === pid);
                            if (!u) return null;
                            const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                            return (
                              <div key={pid} className="w-5 h-5 rounded-full border border-background bg-secondary flex items-center justify-center overflow-hidden text-[8px] text-muted-foreground font-bold" title={u.name}>
                                {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : initials}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <h4 className={`font-bold text-xs text-foreground mb-1 leading-snug ${event.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                      {event.title}
                    </h4>

                    {isFinance && event.metadata?.amount && (
                      <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                        Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.metadata.amount)}
                      </div>
                    )}

                    {event.description && (
                      <p className="text-[9px] text-muted-foreground line-clamp-1 mb-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/10 mt-auto">
                      <span className="text-[8px] uppercase tracking-wider font-bold opacity-50 flex items-center gap-1 text-muted-foreground">
                        {event.origin === 'agenda' ? 'AGENDA' :
                          isPayable ? 'A PAGAR' :
                            isReceivable ? 'A RECEBER' :
                              event.origin.replace('finance_', '').replace('task', 'TAREFA').toUpperCase()}
                      </span>

                      {isFinance && (
                        <Badge variant={event.metadata?.isPaid ? 'success' : 'warning'} className="text-[8px] px-1.5 h-4 rounded-md">
                          {event.metadata?.isPaid ? 'Pago' : 'Pendente'}
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })
            )}

            {/* Quick Add Placeholder */}
            <div
              onClick={handleCreate}
              className="py-1.5 rounded-lg border border-dashed border-border text-center opacity-20 hover:opacity-60 transition-opacity cursor-pointer group"
            >
              <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground group-hover:text-foreground">
                <Plus size={8} /> Adicionar
              </div>
            </div>

          </div>
        </div>

      </div>

      <EventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
        users={users}
        assignableTaskUsers={assignableTaskUsers}
        assignableEventUsers={assignableEventUsers}
        projects={projects}
        teams={teams}
        initialData={editingEvent}
      />

      {selectedEvent && (
        <EventDetailModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSuccess={loadData}
          event={selectedEvent}
          users={users}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
};
