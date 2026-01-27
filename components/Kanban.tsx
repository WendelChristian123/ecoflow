
import React, { useState } from 'react';
import { Plus, MoreHorizontal, Calendar as CalendarIcon, Trash2, Clock, User as UserIcon } from 'lucide-react';
import { Card, Badge, Avatar, cn } from './Shared';
import { Task, User, Status, Priority } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  onDrop: (e: React.DragEvent, status: Status) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDelete: (id: string) => void;
  onTaskClick?: (task: Task) => void;
  canMove?: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, users, onDrop, onDragStart, onDelete, onTaskClick, canMove = true }) => {
  return (
    <div className="flex gap-4 md:gap-6 w-full h-full">
      <KanbanColumn title="A Fazer" status="todo" tasks={tasks} users={users} onDrop={onDrop} onDragStart={onDragStart} onDelete={onDelete} onTaskClick={onTaskClick} canMove={canMove} />
      <KanbanColumn title="Em Progresso" status="in_progress" tasks={tasks} users={users} onDrop={onDrop} onDragStart={onDragStart} onDelete={onDelete} onTaskClick={onTaskClick} canMove={canMove} />
      <KanbanColumn title="Revisão" status="review" tasks={tasks} users={users} onDrop={onDrop} onDragStart={onDragStart} onDelete={onDelete} onTaskClick={onTaskClick} canMove={canMove} />
      <KanbanColumn title="Concluído" status="done" tasks={tasks} users={users} onDrop={onDrop} onDragStart={onDragStart} onDelete={onDelete} onTaskClick={onTaskClick} canMove={canMove} />
    </div>
  );
};

interface KanbanColumnProps {
  title: string;
  status: Status;
  tasks: Task[];
  users: User[];
  onDrop: (e: React.DragEvent, status: Status) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDelete: (id: string) => void;
  onTaskClick?: (task: Task) => void;
  canMove: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, status, tasks, users, onDrop, onDragStart, onDelete, onTaskClick, canMove }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const filteredTasks = tasks.filter(t => t.status === status);

  const translatePriority = (p: Priority) => {
    switch (p) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      case 'urgent': return 'Urgente';
      default: return p;
    }
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'neutral';
      case 'low': return 'success';
      default: return 'neutral';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canMove) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!canMove) return;
    e.preventDefault();
    setIsDragOver(false);
    onDrop(e, status);
  };

  return (
    <div
      className={cn(
        "flex-1 min-w-[280px] rounded-xl border flex flex-col h-full transition-colors duration-200",
        isDragOver ? "bg-secondary border-primary/50" : "bg-muted/50 border-border/50"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Column Header */}
      <div className={cn(
        "p-4 flex items-center justify-between sticky top-0 backdrop-blur-sm rounded-t-xl z-10 border-b transition-colors shrink-0",
        isDragOver ? "bg-secondary/90 border-primary/30" : "bg-muted/50 border-border/50"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full",
            status === 'todo' ? 'bg-muted-foreground' :
              status === 'in_progress' ? 'bg-secondary' :
                status === 'review' ? 'bg-secondary/70' : 'bg-primary'
          )}></div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <span className="bg-card text-muted-foreground text-xs px-2 py-0.5 rounded-full border border-border">{filteredTasks.length}</span>
        </div>
      </div>

      {/* Cards Area */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
        {filteredTasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg min-h-[100px]">
            <span className="text-xs">Vazio</span>
          </div>
        )}
        {filteredTasks.map(task => {
          const assignee = users.find(u => u.id === task.assigneeId);
          return (
            <Card
              key={task.id}
              draggable={canMove}
              onDragStart={(e: React.DragEvent) => {
                if (canMove) onDragStart(e, task.id);
              }}
              onClick={() => onTaskClick && onTaskClick(task)}
              className={cn(
                "p-4 hover:border-primary/30 cursor-pointer group bg-card shadow-sm hover:shadow-md transition-all border-border",
                canMove ? "active:cursor-grabbing hover:-translate-y-0.5" : "cursor-default"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <Badge variant={getPriorityColor(task.priority)}>
                  {translatePriority(task.priority)}
                </Badge>
                <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>

              <h4 className={`text-sm font-medium text-foreground mb-1 ${task.status === 'done' ? 'line-through opacity-70' : ''}`}>{task.title}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon size={12} />
                    <span>{new Date(task.dueDate).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}</span>
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
          );
        })}
      </div>
    </div>
  );
};
