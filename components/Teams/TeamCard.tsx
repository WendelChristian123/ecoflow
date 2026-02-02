import React from 'react';
import { Team, User } from '../../types';
import { KanbanCard } from '../Kanban/KanbanCard';
import { Card, Avatar, cn } from '../Shared';
import { Trash2, Edit2, Users } from 'lucide-react';

interface TeamCardProps {
    team: Team;
    users: User[];
    onClick: (team: Team) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onEdit: (team: Team, e: React.MouseEvent) => void;
    canMove: boolean;
    isAdmin: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, users, onClick, onDelete, onEdit, canMove, isAdmin }) => {
    // Determine leader
    const lead = users.find(u => u.id === team.leadId);

    return (
        <KanbanCard id={team.id} onClick={() => onClick(team)} isDraggable={canMove}>
            <Card
                noPadding
                className={cn(
                    "p-4 hover:border-primary/30 cursor-pointer group bg-card shadow-sm hover:shadow-md transition-all border-border flex flex-col gap-3",
                    canMove ? "active:cursor-grabbing hover:-translate-y-0.5" : "cursor-default"
                )}
            >
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Equipe</span>
                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">{team.name}</h4>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => onEdit(team, e)} className="text-muted-foreground hover:text-foreground">
                                <Edit2 size={14} />
                            </button>
                            <button onClick={(e) => onDelete(team.id, e)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {team.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{team.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        {lead ? (
                            <div className="flex items-center gap-1.5" title={`Líder: ${lead.name}`}>
                                <Avatar size="sm" src={lead.avatarUrl} name={lead.name} />
                                <span className="text-xs text-muted-foreground truncate max-w-[80px]">{lead.name}</span>
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">Sem líder</span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        <Users size={12} />
                        <span>{team.memberIds.length}</span>
                    </div>
                </div>
            </Card>
        </KanbanCard>
    );
};
