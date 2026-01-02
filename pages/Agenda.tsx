import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, Users as UsersIcon, Calendar as CalendarIcon, CheckCircle2, AlertCircle, DollarSign, CreditCard, FileText, CheckSquare, Search, Filter } from 'lucide-react';
import { Card, Loader, Button, Badge, Avatar, Input } from '../components/Shared';
import { EventModal, EventDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { CalendarEvent, User, CalendarSettings, Task, FinancialTransaction, Quote, CreditCard as ICreditCard, Project, Team } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, parseISO, isValid, getHours, getMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';

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
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // State for Navigation vs Selection
  const [viewDate, setViewDate] = useState(new Date()); // Controls the Month displayed
  const [selectedDate, setSelectedDate] = useState(new Date()); // Controls the sidebar

  // UI State
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
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
      // 1. Fetch Settings & Users (Always needed)
      const [settings, u, p, t] = await Promise.all([
        api.getTenantSettings(),
        api.getUsers(),
        api.getProjects(),
        api.getTeams()
      ]);
      setUsers(u);
      setProjects(p);
      setTeams(t);

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
              startDate: t.dueDate,
              endDate: t.dueDate,
              status: t.status === 'done' ? 'completed' : 'scheduled',
              type: 'deadline',
              isTeamEvent: false,
              participants: t.assigneeId ? [t.assigneeId] : [],
              links: t.links,
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
                status: 'scheduled',
                type: 'deadline',
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

        // Receivables & Payables (Transactions)
        if (fin?.receivable !== false || fin?.payable !== false) {
          promises.push(api.getFinancialTransactions().then(transactions => {
            transactions.forEach(tr => {
              if (tr.isPaid) return;
              if (tr.originType === 'credit_card' || tr.creditCardId) return;

              // Receivables
              if (tr.type === 'income' && fin?.receivable !== false) {
                newEvents.push({
                  id: `fin-inc-${tr.id}`,
                  title: `Receber: ${tr.description}`,
                  description: `Categoria: ${tr.category?.name || 'Geral'}`,
                  startDate: tr.date,
                  endDate: tr.date,
                  status: 'scheduled',
                  type: 'deadline',
                  isTeamEvent: false,
                  participants: [],
                  links: tr.links,
                  origin: 'finance_receivable',
                  metadata: tr,
                  color: 'bg-emerald-500/20 text-emerald-300 border-l-4 border-emerald-500',
                  icon: <DollarSign size={14} />
                });
              }
              // Payables
              if (tr.type === 'expense' && fin?.payable !== false) {
                newEvents.push({
                  id: `fin-exp-${tr.id}`,
                  title: `Pagar: ${tr.description}`,
                  description: `Categoria: ${tr.category?.name || 'Geral'}`,
                  startDate: tr.date,
                  endDate: tr.date,
                  status: 'scheduled',
                  type: 'deadline',
                  isTeamEvent: false,
                  participants: [],
                  links: tr.links,
                  origin: 'finance_payable',
                  metadata: tr,
                  color: 'bg-rose-500/20 text-rose-300 border-l-4 border-rose-500',
                  icon: <AlertCircle size={14} />
                });
              }
            });
          }));
        }

        // Credit Cards
        if (fin?.credit_card !== false) {
          promises.push(api.getCreditCards().then(cards => {
            [-1, 0, 1].forEach(offset => {
              const monthDate = addMonths(viewDate, offset);
              cards.forEach(card => {
                // Closing Date - Removed as requested
                // const closingDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), card.closingDay);

                // Due Date
                const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), card.dueDay);
                if (isValid(dueDate)) {
                  newEvents.push({
                    id: `card-due-${card.id}-${offset}`,
                    title: `Vencimento: ${card.name}`,
                    description: `Dia de vencimento`,
                    startDate: dueDate.toISOString(),
                    endDate: dueDate.toISOString(),
                    status: 'scheduled',
                    type: 'deadline',
                    isTeamEvent: false,
                    participants: [],
                    links: [],
                    origin: 'finance_card',
                    metadata: card,
                    color: 'bg-rose-500/20 text-rose-300 border-l-4 border-rose-500',
                    icon: <CreditCard size={14} />
                  });
                }
              });
            });
          }));
        }
      }

      await Promise.all(promises);
      setEvents(newEvents);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

    return filtered;
  };

  const filteredEvents = getFilteredEvents();
  const selectedDayEvents = filteredEvents
    .filter(e => isSameDay(new Date(e.startDate), selectedDate))
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
        <div className="flex bg-slate-800 rounded-full p-0.5 border border-slate-700/50">
          {[
            { id: 'all', label: 'Todos', icon: CheckCircle2 },
            { id: 'agenda', label: 'Compromissos', icon: CalendarIcon },
            { id: 'task', label: 'Tarefas', icon: CheckSquare },
            { id: 'finance', label: 'Financeiro', icon: DollarSign },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as FilterType)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${activeFilter === filter.id ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
            >
              {filter.id === activeFilter && <filter.icon size={12} />}
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <Input
            placeholder="Buscar..."
            className="pl-8 py-1 text-xs bg-slate-800 border-slate-700 rounded-full focus:ring-emerald-500/50 h-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

        {/* LEFT: CALENDAR GRID */}
        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {/* Header Month/Nav - Compacted */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-900/50">
            <h2 className="text-lg font-bold text-white capitalize flex items-center gap-2">
              <CalendarIcon size={16} className="text-emerald-500" />
              {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handlePrevMonth} className="rounded-full w-6 h-6 p-0 border-slate-700 hover:bg-slate-800 text-slate-400"><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" onClick={handleToday} className="rounded-full px-2 h-6 border-slate-700 hover:bg-slate-800 text-slate-300 text-[9px] uppercase tracking-wider font-bold">Hoje</Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth} className="rounded-full w-6 h-6 p-0 border-slate-700 hover:bg-slate-800 text-slate-400"><ChevronRight size={14} /></Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-800/30 shrink-0">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                {day}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 grid-rows-6 h-full min-h-0 divide-x divide-y divide-slate-800 border-l border-t border-slate-800 bg-slate-900">
            {eachDayOfInterval({
              start: startOfWeek(startOfMonth(viewDate)),
              end: endOfWeek(endOfMonth(viewDate))
            }).map((day, idx) => {
              const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.startDate), day));
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
                                        ${!isCurrentMonth ? 'bg-slate-900/40 text-slate-700' : 'bg-slate-900'}
                                        ${isSelected ? 'bg-slate-800/80 shadow-[inset_0_0_0_2px_rgba(16,185,129,0.5)]' : 'hover:bg-slate-800/20'}
                                    `}
                >
                  <div className="flex justify-start items-start mb-0.5">
                    <span className={`text-[10px] h-5 w-5 flex items-center justify-center rounded-full shrink-0 transition-colors font-bold
                                            ${isTodayDate ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : (isSelected ? 'text-emerald-400' : (isCurrentMonth ? 'text-slate-300' : 'text-slate-600'))}
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
                                                      ${isCompleted ? 'line-through opacity-60 decoration-slate-400' : ''}
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
                        <span className="text-[8px] leading-none text-slate-500 font-medium hover:text-slate-300 transition-colors">+ {hiddenCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: SIDEBAR - Ultra Compacted */}
        <div className="w-72 flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50">
            <div>
              <h3 className="text-sm font-bold text-white capitalize leading-tight">
                {format(selectedDate, 'EEEE, d', { locale: ptBR })}
              </h3>
              <p className="text-[10px] text-slate-400 capitalize">
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
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Agenda do Dia</span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
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
                                          ${event.color || 'bg-slate-800/40 hover:bg-slate-800 border-l-[3px] border-slate-500'}
                                      `}
                  >
                    {/* Header: Time */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-80 text-white">
                        {event.icon}
                        {format(new Date(event.startDate), 'HH:mm')}
                      </div>
                    </div>

                    {/* Content */}
                    <h4 className={`font-bold text-xs text-white mb-1 leading-snug ${event.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                      {event.title}
                    </h4>

                    {isFinance && event.metadata?.amount && (
                      <div className="text-[10px] font-medium text-slate-300 mb-0.5">
                        Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.metadata.amount)}
                      </div>
                    )}

                    {event.description && (
                      <p className="text-[9px] text-slate-500 line-clamp-1 mb-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-auto">
                      <span className="text-[8px] uppercase tracking-wider font-bold opacity-50 flex items-center gap-1">
                        {event.origin === 'agenda' ? 'AGENDA' :
                          isPayable ? 'PAYABLE' :
                            isReceivable ? 'RECEIVABLE' :
                              event.origin.replace('finance_', '').replace('task', 'TASK').toUpperCase()}
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
              className="py-1.5 rounded-lg border border-dashed border-slate-800 text-center opacity-20 hover:opacity-60 transition-opacity cursor-pointer group"
            >
              <div className="flex items-center justify-center gap-1 text-[9px] text-slate-500 group-hover:text-slate-300">
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
