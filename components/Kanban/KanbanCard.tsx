import React from 'react';
import { cn } from '../Shared';

interface KanbanCardProps {
    id: string;
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
    isDraggable?: boolean;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ id, onClick, className, children, isDraggable = true }) => {
    const handleDragStart = (e: React.DragEvent) => {
        if (!isDraggable) return;
        e.dataTransfer.setData('entityId', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onClick={onClick}
            className={cn(
                "cursor-grab active:cursor-grabbing transition-all group overflow-hidden",
                className
            )}
        >
            {children}
        </div>
    );
};
