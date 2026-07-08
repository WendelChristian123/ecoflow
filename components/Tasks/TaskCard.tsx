import React from 'react';
import { Task, User } from '../../types';
import { KanbanCard } from '../Kanban/KanbanCard';
import { Card, Avatar, cn } from '../Shared';
import { Calendar, Trash2, User as UserIcon } from 'lucide-react';
import { getSystemNow, getZonedDate, formatDateOnlyForDisplay } from '../../utils/timezone';

interface TaskCardProps {
    task: Task;
    users: User[];
    onClick: (task: Task) => void;
    onDelete: (id: string) => void;
    canMove: boolean;
    isReference?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, users, onClick, onDelete, isReference = false, canMove = true }) => {
    const assignee = users.find(u => u.id === task.assigneeId);

    const translatePriority = (p: string) => {
        switch (p) {
            case 'urgent': return 'Urgente';
            case 'high': return 'Alta';
            case 'medium': return 'Média';
            case 'low': return 'Baixa';
            default: return 'Normal';
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'urgent': return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20';
            case 'high': return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20';
            case 'medium': return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20';
            case 'low': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
            default: return 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/20';
        }
    };

    // Check if Overdue
    const getTaskStylesAndStatus = (t: Task) => {
        if (!t.dueDate) return { styles: '', isOverdue: false };
        const today = getSystemNow();
        today.setHours(0, 0, 0, 0);
        const due = getZonedDate(t.dueDate);
        due.setHours(0, 0, 0, 0);
        
        const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const overdue = t.status !== 'done' && diff < 0;

        let styles = 'border-l-2 border-l-emerald-500'; // Futuro
        if (overdue) styles = 'border-l-4 border-l-rose-500 bg-rose-500/10 dark:bg-rose-950/20'; // Vencido
        else if (diff === 0) styles = 'border-l-4 border-l-amber-500'; // Hoje
        else if (diff === 1) styles = 'border-l-4 border-l-amber-500'; // Amanhã - Mantendo amber para "atenção"

        return { styles, isOverdue: overdue };
    };

    const { styles, isOverdue } = getTaskStylesAndStatus(task);

    return (
        <KanbanCard id={task.id} onClick={() => onClick(task)} isDraggable={canMove}>
            <Card
                noPadding
                className={cn(
                    "p-2.5 hover:border-border/80 cursor-pointer group bg-card shadow-sm hover:shadow-md transition-all border-border",
                    canMove ? "active:cursor-grabbing hover:-translate-y-0.5" : "cursor-default",
                    styles
                )}
            >
                <div className="flex justify-between items-start mb-1.5">
                    <span className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        getPriorityColor(task.priority)
                    )}>
                        {translatePriority(task.priority)}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-500">
                        <Trash2 size={14} />
                    </button>
                </div>

                <h4 className={`text-xs font-semibold text-foreground mb-0.5 leading-tight ${task.status === 'done' ? 'line-through opacity-70' : ''}`}>
                    {task.title}
                    {isReference && <span className="ml-2 inline-flex items-center rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[8px] font-medium text-indigo-500 ring-1 ring-inset ring-indigo-500/20 uppercase">Da Equipe</span>}
                </h4>
                {task.description && <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">{task.description}</p>}

                <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border/50">
                    <div className="flex flex-col gap-1">
                        <div className={cn("flex items-center gap-1.5 text-xs", isOverdue ? "text-rose-600 font-bold" : "text-muted-foreground")}>
                            <Calendar size={12} />
                            <span>{task.dueDate ? formatDateOnlyForDisplay(task.dueDate, "d 'de' MMM") : 'S/ Data'}</span>
                            {isOverdue && <span className="text-[9px] bg-rose-500 text-white px-1 py-0.5 rounded ml-1 uppercase">Vencido</span>}
                        </div>
                    </div>
                    {assignee ? (
                        <Avatar size="sm" src={assignee.avatarUrl} name={assignee.name} />
                    ) : (
                        <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                            <UserIcon size={12} />
                        </div>
                    )}
                </div>
            </Card>
        </KanbanCard>
    );
};
