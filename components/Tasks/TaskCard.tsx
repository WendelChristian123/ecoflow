import React from 'react';
import { Task, User } from '../../types';
import { KanbanCard } from '../Kanban/KanbanCard';
import { Card, Avatar, cn } from '../Shared';
import { Calendar, Trash2, User as UserIcon } from 'lucide-react';

interface TaskCardProps {
    task: Task;
    users: User[];
    onClick: (task: Task) => void;
    onDelete: (id: string) => void;
    canMove: boolean;
}

// ... imports
export const TaskCard: React.FC<TaskCardProps> = ({ task, users, onClick, onDelete, canMove }) => {
    const assignee = users.find(u => u.id === task.assigneeId);

    const translatePriority = (p: string) => {
        switch (p) {
            case 'low': return 'Baixa';
            case 'medium': return 'Média';
            case 'high': return 'Alta';
            case 'urgent': return 'Urgente';
            default: return p;
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'urgent': return 'bg-rose-500 text-white border-0'; // Vermelho
            case 'high': return 'bg-orange-500 text-white border-0'; // Laranja
            case 'medium': return 'bg-blue-500 text-white border-0'; // Azul
            case 'low': return 'bg-emerald-500 text-white border-0'; // Verde
            default: return 'bg-slate-500 text-white border-0';
        }
    };

    // Check if Overdue
    const isOverdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

    const getTaskStyles = (task: Task) => {
        if (!task.dueDate) return '';
        const today = new Date().setHours(0, 0, 0, 0);
        const due = new Date(task.dueDate).setHours(0, 0, 0, 0);
        const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));

        if (isOverdue) return 'border-l-4 border-l-rose-500 bg-rose-500/10 dark:bg-rose-950/20'; // Vencido
        if (diff === 0) return 'border-l-4 border-l-amber-500'; // Hoje
        if (diff === 1) return 'border-l-4 border-l-amber-500'; // Amanhã - Mantendo amber para "atenção"
        return 'border-l-2 border-l-emerald-500'; // Futuro
    };

    return (
        <KanbanCard id={task.id} onClick={() => onClick(task)} isDraggable={canMove}>
            <Card
                noPadding
                className={cn(
                    "p-4 hover:border-primary/30 cursor-pointer group bg-card shadow-sm hover:shadow-md transition-all border-border",
                    canMove ? "active:cursor-grabbing hover:-translate-y-0.5" : "cursor-default",
                    getTaskStyles(task)
                )}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                        "inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                        getPriorityColor(task.priority)
                    )}>
                        {translatePriority(task.priority)}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
                        <Trash2 size={16} />
                    </button>
                </div>

                <h4 className={`text-sm font-medium text-foreground mb-1 ${task.status === 'done' ? 'line-through opacity-70' : ''}`}>{task.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <div className="flex flex-col gap-1">
                        <div className={cn("flex items-center gap-1.5 text-xs", isOverdue ? "text-rose-600 font-bold" : "text-muted-foreground")}>
                            <Calendar size={12} />
                            <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }) : 'S/ Data'}</span>
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
