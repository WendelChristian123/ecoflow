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

    const initializeDefaultStages = async (boardId: string, moduleType: string) => {
        let stages: any[] = [];
        if (moduleType === 'crm') {
            stages = [
                { name: 'Em Negociação', color: 'bg-amber-500', isLocked: true, isDefault: true, affectsDashboard: true, position: 0 },
                { name: 'Negócio Fechado', color: 'bg-emerald-500', systemStatus: 'approved', isLocked: true, isDefault: true, affectsDashboard: true, position: 1 },
                { name: 'Negócio Perdido', color: 'bg-rose-500', systemStatus: 'rejected', isLocked: true, isDefault: true, affectsDashboard: true, position: 2 },
                { name: 'Vencidos', color: 'bg-slate-500', systemStatus: 'expired', isLocked: true, isDefault: true, affectsDashboard: false, position: 3 }
            ];
        } else {
            stages = [
                { name: 'A Fazer', color: 'bg-slate-500', systemStatus: 'todo', position: 0 },
                { name: 'Em Progresso', color: 'bg-blue-500', systemStatus: 'in_progress', position: 1 },
                { name: 'Revisão', color: 'bg-amber-500', systemStatus: 'review', position: 2 },
                { name: 'Concluído', color: 'bg-emerald-500', systemStatus: 'done', position: 3 }
            ];
        }

        for (const s of stages) {
            await kanbanService.createStage({ ...s, kanban_id: boardId } as any);
        }
    };

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
                    // Self-healing: If CRM board exists but has NO stages, inject them
                    if (module === 'crm' && defaultK.stages && defaultK.stages.length === 0) {
                        console.log("Repairing empty CRM board...");
                        await initializeDefaultStages(defaultK.id, 'crm');
                        // Refresh again to show stages
                        const repaireData = await kanbanService.listKanbans(module);
                        setKanbans(repaireData);
                        setCurrentKanban(repaireData.find(k => k.id === defaultK.id) || repaireData[0]);
                    }
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

                        if (newBoard && newBoard.id) {
                            await initializeDefaultStages(newBoard.id, module);

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
        const newBoard = await kanbanService.createKanban({
            name,
            module,
            isDefault: kanbans.length === 0,
            tenantId
        });

        if (newBoard && newBoard.id) {
            await initializeDefaultStages(newBoard.id, module);
        }

        await refreshKanbans();
    };

    const updateKanban = async (id: string, updates: Partial<Kanban>) => {
        await kanbanService.updateKanban(id, updates);
        await refreshKanbans();
    };

    const deleteKanban = async (id: string) => {
        // In single mode, deleting means "Reseting" effectively, as refresh will recreate it.
        // We allow it but maybe the UI should warn "Isso irá resetar o quadro".
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
