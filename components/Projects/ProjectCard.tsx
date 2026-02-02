import React from 'react';
import { Project, User } from '../../types';
import { KanbanCard } from '../Kanban/KanbanCard';
import { Card, Avatar, cn, ProgressBar } from '../Shared'; // Assuming Shared has ProgressBar
import { Calendar, Trash2, User as UserIcon, ListChecks } from 'lucide-react';

interface ProjectCardProps {
    project: Project;
    users: User[]; // If needed for owner display
    onClick: (project: Project) => void;
    onDelete: (id: string) => void;
    canMove: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, users, onClick, onDelete, canMove }) => {
    // Determine status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planning': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'on_hold': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'completed': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'cancelled': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const translateStatus = (s: string) => {
        switch (s) {
            case 'planning': return 'Planejamento';
            case 'active': return 'Em Andamento';
            case 'on_hold': return 'Pausado';
            case 'completed': return 'Concluído';
            case 'cancelled': return 'Cancelado';
            default: return s;
        }
    };

    const progress = project.progress || 0;

    return (
        <KanbanCard id={project.id} onClick={() => onClick(project)} isDraggable={canMove}>
            <Card
                noPadding
                className={cn(
                    "p-4 hover:border-primary/30 cursor-pointer group bg-card shadow-sm hover:shadow-md transition-all border-border flex flex-col gap-3",
                    canMove ? "active:cursor-grabbing hover:-translate-y-0.5" : "cursor-default"
                )}
            >
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Projeto</span>
                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">{project.name}</h4>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
                        <Trash2 size={16} />
                    </button>
                </div>

                {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                )}

                {/* Progress */}
                <div className="w-full">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Progresso</span>
                        <span>{progress}%</span>
                    </div>
                    <ProgressBar progress={progress} />
                </div>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", getStatusColor(project.status))}>
                            {translateStatus(project.status)}
                        </span>
                    </div>

                    {project.endDate && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Data de término">
                            <Calendar size={12} />
                            <span>{new Date(project.endDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                    )}
                </div>
            </Card>
        </KanbanCard>
    );
};
