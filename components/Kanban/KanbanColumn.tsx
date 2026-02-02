import React, { useState } from 'react';
import { KanbanStage } from '../../types';
import { cn } from '../Shared';
import { MoreHorizontal, Plus } from 'lucide-react';

interface KanbanColumnProps {
    stage: KanbanStage;
    count: number;
    totalValue?: number;
    onDrop: (entityId: string) => void;
    children: React.ReactNode;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ stage, count, totalValue, onDrop, children }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const entityId = e.dataTransfer.getData('entityId');
        if (entityId) {
            onDrop(entityId);
        }
    };

    return (
        <div
            className={cn(
                "flex-1 min-w-[300px] flex flex-col rounded-xl border transition-colors h-full overflow-hidden",
                isDragOver ? "border-emerald-500/50 bg-secondary/50" : "border-border bg-card"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Header */}
            <div className={cn(
                "px-4 py-3 border-b border-white/10 flex flex-col gap-1 sticky top-0 backdrop-blur z-10",
                stage.color
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs uppercase tracking-widest">{stage.name}</span>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">{count}</span>
                    </div>
                </div>
                {totalValue !== undefined && (
                    <div className="text-xs text-white/90 font-mono font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {count === 0 && (
                    <div className="h-24 flex items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-lg text-xs">
                        Vazio
                    </div>
                )}
                {children}
            </div>
        </div>
    );
};
