import React, { createContext, useContext, useState, useEffect } from 'react';
import { Kanban, KanbanStage } from '../../types';
import { kanbanService } from '../../services/kanbanService';

interface KanbanContextType {
    currentKanban: Kanban | null;
    kanbans: Kanban[];
    isLoading: boolean;
    singleBoardMode?: boolean;
    refreshKanbans: () => Promise<void>;
    setCurrentKanban: (kanban: Kanban) => void;
    createKanban: (name: string) => Promise<void>;
    updateKanban: (id: string, updates: Partial<Kanban>) => Promise<void>;
    deleteKanban: (id: string) => Promise<void>;
    // Stage operations
    addStage: (name: string) => Promise<void>;
    updateStage: (id: string, updates: Partial<KanbanStage>) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;
    reorderStages: (stages: { id: string; position: number }[]) => Promise<void>;
    moveEntity: (entityId: string, stageId: string) => Promise<void>;
}

const KanbanContext = createContext<KanbanContextType | undefined>(undefined);

export const KanbanProvider: React.FC<{
    module: 'crm' | 'tasks' | 'projects' | 'teams';
    entityTable: 'quotes' | 'tasks' | 'projects' | 'teams';
    singleBoardMode?: boolean;
    onEntityMove?: (entityId: string, stageId: string) => void;
    children: React.ReactNode
}> = ({ module, entityTable, singleBoardMode = false, onEntityMove, children }) => {
    const [kanbans, setKanbans] = useState<Kanban[]>([]);
    const [currentKanban, setCurrentKanban] = useState<Kanban | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshKanbans = async () => {
        setIsLoading(true);
        try {
            const data = await kanbanService.listKanbans(module);
            setKanbans(data);

            if (singleBoardMode) {
                // Single Mode: Always force selection of the default board
                const defaultK = data.find(k => k.isDefault) || data[0];
                if (defaultK) {
                    setCurrentKanban(defaultK);
                } else {
                    // Auto-initialize Default Board if missing in single mode
                    try {
                        const tenantId = localStorage.getItem('ecoflow-tenant-id') || undefined;
                        console.log(`Auto-initializing default Kanban for module: ${module}, Tenant: ${tenantId}`);
                        const newBoard = await kanbanService.createKanban({
                            name: 'Quadro Principal',
                            module,
                            isDefault: true,
                            tenantId: tenantId
                        });

                        // Wait for board creation before adding stages
                        if (newBoard && newBoard.id) {
                            const stages = [
                                { name: 'A Fazer', color: 'bg-slate-500', system_status: 'todo', position: 0 },
                                { name: 'Em Progresso', color: 'bg-blue-500', system_status: 'in_progress', position: 1 },
                                { name: 'Revisão', color: 'bg-amber-500', system_status: 'review', position: 2 },
                                { name: 'Concluído', color: 'bg-emerald-500', system_status: 'done', position: 3 }
                            ];

                            // Create stages sequentially to ensure order (or parallel if safe)
                            for (const s of stages) {
                                await kanbanService.createStage({ ...s, kanban_id: newBoard.id } as any);
                            }

                            // Refresh to get full object
                            const updatedData = await kanbanService.listKanbans(module);
                            setKanbans(updatedData);
                            setCurrentKanban(updatedData[0]);
                        }
                    } catch (err) {
                        console.error("Failed to auto-initialize default board", err);
                    }
                }
            } else {
                // Multi Mode: Keep current selection if valid, else default
                if (data.length > 0 && !currentKanban) {
                    const defaultK = data.find(k => k.isDefault) || data[0];
                    setCurrentKanban(defaultK);
                } else if (currentKanban) {
                    const updatedCurrent = data.find(k => k.id === currentKanban.id);
                    if (updatedCurrent) setCurrentKanban(updatedCurrent);
                    else setCurrentKanban(data[0] || null); // Fallback if current deleted
                }
            }
        } catch (error) {
            console.error('Failed to load kanbans', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshKanbans();
    }, [module]);

    const createKanban = async (name: string) => {
        if (singleBoardMode && kanbans.length > 0) {
            alert("Modo de painel único: não é possível criar múltiplos painéis.");
            return;
        }
        const tenantId = localStorage.getItem('ecoflow-tenant-id') || undefined;
        await kanbanService.createKanban({
            name,
            module,
            isDefault: kanbans.length === 0,
            tenantId
        });
        await refreshKanbans();
    };

    const updateKanban = async (id: string, updates: Partial<Kanban>) => {
        await kanbanService.updateKanban(id, updates);
        await refreshKanbans();
    };

    const deleteKanban = async (id: string) => {
        if (singleBoardMode) {
            alert("Não é possível excluir o painel padrão.");
            return;
        }
        await kanbanService.deleteKanban(id);
        if (currentKanban?.id === id) {
            setCurrentKanban(null);
        }
        await refreshKanbans();
    };

    const addStage = async (name: string) => {
        if (!currentKanban) return;
        const position = currentKanban.stages.length;
        await kanbanService.createStage({
            kanban_id: currentKanban.id,
            name,
            position,
            color: 'bg-slate-500'
        } as any);
        await refreshKanbans();
    };

    const updateStage = async (id: string, updates: Partial<KanbanStage>) => {
        await kanbanService.updateStage(id, updates);
        await refreshKanbans();
    };

    const deleteStage = async (id: string) => {
        await kanbanService.deleteStage(id);
        await refreshKanbans();
    };

    const reorderStages = async (stages: { id: string; position: number }[]) => {
        await kanbanService.reorderStages(stages);
        await refreshKanbans();
    };

    const moveEntity = async (entityId: string, stageId: string) => {
        if (!currentKanban) return;
        // Optimistic UI update could happen here, but for now we wait
        await kanbanService.moveEntity(entityTable, entityId, currentKanban.id, stageId);
        if (onEntityMove) onEntityMove(entityId, stageId);
        // We don't necessarily refresh kanbans here, but the parent component should refresh entities
    };

    return (
        <KanbanContext.Provider value={{
            currentKanban,
            kanbans,
            isLoading,
            singleBoardMode,
            refreshKanbans,
            setCurrentKanban,
            createKanban,
            updateKanban,
            deleteKanban,
            addStage,
            updateStage,
            deleteStage,
            reorderStages,
            moveEntity
        }}>
            {children}
        </KanbanContext.Provider>
    );
};

export const useKanban = () => {
    const context = useContext(KanbanContext);
    if (context === undefined) {
        throw new Error('useKanban must be used within a KanbanProvider');
    }
    return context;
};
