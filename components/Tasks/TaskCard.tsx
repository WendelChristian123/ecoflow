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
            case 'urgent': return 'bg-[hsl(var(--priority-urgent))] text-white border-0';
            case 'high': return 'bg-[hsl(var(--priority-high))] text-white border-0';
            case 'medium': return 'bg-[hsl(var(--priority-medium))] text-gray-900 border-0';
            case 'low': return 'bg-[hsl(var(--priority-low))] text-white border-0';
            default: return 'neutral';
        }
    };

    const getTaskBorderColor = (task: Task) => {
        if (!task.dueDate) return '';
        const today = new Date().setHours(0, 0, 0, 0);
        const due = new Date(task.dueDate).setHours(0, 0, 0, 0);
        const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));

        if (diff < 0) return 'border-l-4 border-l-[hsl(var(--status-overdue))]'; // Vencido
        if (diff === 0) return 'border-l-4 border-l-[hsl(var(--status-today))]'; // Hoje
        if (diff === 1) return 'border-l-4 border-l-[hsl(var(--status-tomorrow))]'; // Amanhã
        return 'border-l-2 border-l-[hsl(var(--status-upcoming))]'; // Futuro
    };

    return (
        <KanbanCard id={task.id} onClick={() => onClick(task)} isDraggable={canMove}>
            <Card
                noPadding
                className={cn(
                    "p-4 hover:border-primary/30 cursor-pointer group bg-card shadow-sm hover:shadow-md transition-all border-border",
                    canMove ? "active:cursor-grabbing hover:-translate-y-0.5" : "cursor-default",
                    getTaskBorderColor(task)
                )}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold",
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
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar size={12} />
                            <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }) : 'S/ Data'}</span>
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
