import React, { useRef } from 'react';
import { cn } from '../Shared';

interface KanbanCardProps {
    id: string;
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
    isDraggable?: boolean;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ id, onClick, className, children, isDraggable = true }) => {
    const isDraggingRef = useRef(false);

    const handleDragStart = (e: React.DragEvent) => {
        if (!isDraggable) return;
        isDraggingRef.current = true;
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        // Use a short timeout to allow the click event to be blocked if it fires immediately after drop
        setTimeout(() => {
            isDraggingRef.current = false;
        }, 50);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isDraggingRef.current) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        if (onClick) onClick();
    };

    return (
        <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            className={cn(
                "cursor-grab active:cursor-grabbing transition-all group overflow-hidden",
                className
            )}
        >
            {children}
        </div>
    );
};
