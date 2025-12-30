
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, Users, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { Card, Loader, Button, Badge, Avatar } from '../components/Shared';
import { EventModal, EventDetailModal } from '../components/Modals';
import { api } from '../services/api';
import { CalendarEvent, User } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';

type ViewMode = 'month' | 'week' | 'day';

export const AgendaPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);

  const location = useLocation();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && events.length > 0 && location.state?.eventId) {
        const targetEvent = events.find(e => e.id === location.state.eventId);
        if (targetEvent) {
            setSelectedEvent(targetEvent);
            setCurrentDate(new Date(targetEvent.startDate));
        }
    }
  }, [loading, events, location.state]);

  const loadData = async () => {
    try {
        const [e, u] = await Promise.all([api.getEvents(), api.getUsers()]);
        setEvents(e);
        setUsers(u);
    } catch(e) {
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
      if (selectedEvent) {
          setEditingEvent(selectedEvent);
          setSelectedEvent(null); 
          setIsCreateModalOpen(true);
      }
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const getDateLabel = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    if (viewMode === 'week') {
       const start = startOfWeek(currentDate);
       const end = endOfWeek(currentDate);
       return `${format(start, 'd MMM', { locale: ptBR })} - ${format(end, 'd MMM', { locale: ptBR })}`;
    }
    return format(currentDate, 'd ' + 'MMMM yyyy', { locale: ptBR });
  };

  if (loading) return <Loader />;

  return (
    // Fixed height layout
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
           <h2 className="text-2xl font-bold text-white capitalize min-w-[200px]">
             {getDateLabel()}
           </h2>
           <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button onClick={() => setViewMode('day')} className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === 'day' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Dia</button>
             <button onClick={() => setViewMode('week')} className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === 'week' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Semana</button>
             <button onClick={() => setViewMode('month')} className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === 'month' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Mês</button>
           </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrev}><ChevronLeft size={18} /></Button>
          <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="secondary" size="sm" onClick={handleNext}><ChevronRight size={18} /></Button>
          <Button className="ml-2 gap-2" onClick={handleCreate}>
             <Plus size={16} /> Novo Compromisso
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col min-h-0">
        
        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <>
            <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-900/50 shrink-0">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="py-3 text-center text-xs font-semibold uppercase text-slate-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-1 h-full">
              {eachDayOfInterval({ 
                  start: startOfWeek(startOfMonth(currentDate)), 
                  end: endOfWeek(endOfMonth(currentDate)) 
              }).map((day) => {
                 const dayEvents = events.filter(e => isSameDay(new Date(e.startDate), day));
                 return (
                   <div 
                     key={day.toISOString()} 
                     className={`border-b border-r border-slate-700/50 p-2 hover:bg-slate-700/20 transition-colors flex flex-col gap-1 overflow-hidden ${!isSameMonth(day, currentDate) ? 'bg-slate-900/30' : ''}`}
                   >
                     <span className={`text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full shrink-0 ${isToday(day) ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>
                       {format(day, 'd')}
                     </span>
                     <div className="space-y-1 mt-1 overflow-y-auto custom-scrollbar">
                       {dayEvents.map(event => (
                         <div 
                           key={event.id} 
                           onClick={() => setSelectedEvent(event)}
                           className={`px-2 py-1 rounded text-xs truncate border cursor-pointer hover:opacity-80 flex items-center justify-between ${
                             event.status === 'completed'
                               ? 'bg-slate-600/30 border-slate-600 text-slate-400 line-through'
                               : event.isTeamEvent 
                                 ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' 
                                 : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                           }`}
                         >
                           <span className="truncate">{event.title}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 );
              })}
            </div>
          </>
        )}

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
           <div className="flex flex-col h-full overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-900/50 sticky top-0 z-10 shrink-0">
                 {eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }).map(day => (
                    <div key={day.toString()} className="py-3 text-center border-r border-slate-800 last:border-0">
                       <div className="text-xs font-semibold uppercase text-slate-500 mb-1">{format(day, 'EEE', {locale: ptBR})}</div>
                       <div className={`text-sm font-bold ${isToday(day) ? 'text-emerald-400' : 'text-slate-200'}`}>{format(day, 'd')}</div>
                    </div>
                 ))}
              </div>
              <div className="grid grid-cols-7 flex-1 overflow-y-auto min-h-0">
                 {eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }).map(day => {
                    const dayEvents = events.filter(e => isSameDay(new Date(e.startDate), day));
                    return (
                       <div key={day.toString()} className="border-r border-slate-700/50 p-2 space-y-2 last:border-0 h-full">
                          {dayEvents.map(event => (
                             <Card 
                               key={event.id} 
                               onClick={() => setSelectedEvent(event)}
                               className={`p-2 text-xs border-l-4 bg-slate-700/50 cursor-pointer hover:bg-slate-700 transition-colors ${
                                 event.status === 'completed' ? 'border-l-slate-500 opacity-60' : 'border-l-emerald-500'
                               }`}
                             >
                                <div className={`font-semibold text-slate-200 truncate ${event.status === 'completed' ? 'line-through' : ''}`}>{event.title}</div>
                                <div className="text-slate-400 mt-1 flex items-center gap-1">
                                   <Clock size={10} />
                                   {format(new Date(event.startDate), 'HH:mm')}
                                </div>
                             </Card>
                          ))}
                       </div>
                    );
                 })}
              </div>
           </div>
        )}

        {/* DAY VIEW */}
        {viewMode === 'day' && (
           <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
              {events.filter(e => isSameDay(new Date(e.startDate), currentDate)).length === 0 ? (
                 <div className="text-center text-slate-500 py-10">Nenhum compromisso para hoje.</div>
              ) : (
                 events
                  .filter(e => isSameDay(new Date(e.startDate), currentDate))
                  .sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .map(event => (
                    <Card 
                      key={event.id} 
                      onClick={() => setSelectedEvent(event)}
                      className={`flex flex-col sm:flex-row gap-4 p-4 border-l-4 cursor-pointer hover:bg-slate-800/80 transition-colors ${
                        event.status === 'completed' ? 'border-l-slate-500 opacity-60' : 'border-l-emerald-500'
                      }`}
                    >
                       <div className="min-w-[120px] text-slate-400 flex flex-col justify-center border-r border-slate-700/50 pr-4">
                          <div className="text-lg font-bold text-white">{format(new Date(event.startDate), 'HH:mm')}</div>
                          <div className="text-xs">até {format(new Date(event.endDate), 'HH:mm')}</div>
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                             <h3 className={`text-lg font-semibold text-white ${event.status === 'completed' ? 'line-through' : ''}`}>{event.title}</h3>
                             <div className="flex gap-2">
                               {event.status === 'completed' && <Badge variant="success"><CheckCircle2 size={12} className="mr-1"/> Concluído</Badge>}
                               <Badge variant={event.isTeamEvent ? 'default' : 'neutral'}>
                                  {event.isTeamEvent ? 'Equipe' : 'Individual'}
                               </Badge>
                             </div>
                          </div>
                          <p className="text-slate-400 text-sm mb-3">{event.description}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                             {event.participants.length > 0 && (
                                <div className="flex items-center gap-1">
                                   <Users size={14} />
                                   {event.participants.length} participantes
                                </div>
                             )}
                             {event.links && event.links.length > 0 && (
                                <div className="text-emerald-400">
                                   {event.links.length} links anexados
                                </div>
                             )}
                          </div>
                       </div>
                    </Card>
                  ))
              )}
           </div>
        )}
      </div>

      <EventModal 
         isOpen={isCreateModalOpen}
         onClose={() => setIsCreateModalOpen(false)}
         onSuccess={loadData}
         users={users}
         initialData={editingEvent}
      />

      <EventDetailModal 
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSuccess={loadData}
        event={selectedEvent}
        users={users}
        onEdit={handleEdit}
      />
    </div>
  );
};
