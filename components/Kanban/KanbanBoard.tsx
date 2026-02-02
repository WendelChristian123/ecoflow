import React from 'react';
import { useKanban } from './KanbanContext';
import { KanbanColumn } from './KanbanColumn';
import { Loader2 } from 'lucide-react';

interface KanbanBoardProps {
    renderCard: (entity: any) => React.ReactNode;
    entities: any[];
    groupByStage: (entities: any[], stageId: string) => any[];
    calculateTotal?: (entities: any[]) => number;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ renderCard, entities, groupByStage, calculateTotal }) => {
    const { currentKanban, isLoading, moveEntity } = useKanban();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (!currentKanban) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Selecione ou crie um Kanban para começar.
            </div>
        );
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
            {currentKanban.stages.map(stage => {
                const stageEntities = groupByStage(entities, stage.id);
                return (
                    <KanbanColumn
                        key={stage.id}
                        stage={stage}
                        count={stageEntities.length}
                        totalValue={calculateTotal ? calculateTotal(stageEntities) : undefined}
                        onDrop={(entityId) => moveEntity(entityId, stage.id)}
                    >
                        {stageEntities.map(entity => renderCard(entity))}
                    </KanbanColumn>
                );
            })}
        </div>
    );
};
