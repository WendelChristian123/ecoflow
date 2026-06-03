import React, { useState } from 'react';
import { useKanban } from './KanbanContext';
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react';
import { cn, Modal, Button, Input } from '../Shared';

// Simple colors for stages
const COLORS = [
    { name: 'Cinza', value: 'bg-slate-500' },
    { name: 'Azul', value: 'bg-blue-500' },
    { name: 'Verde', value: 'bg-emerald-500' },
    { name: 'Amarelo', value: 'bg-amber-500' },
    { name: 'Laranja', value: 'bg-orange-500' },
    { name: 'Vermelho', value: 'bg-rose-500' },
    { name: 'Roxo', value: 'bg-purple-500' },
    { name: 'Rosa', value: 'bg-pink-500' },
];

interface StageManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const StageManagerModal: React.FC<StageManagerModalProps> = ({ isOpen, onClose }) => {
    const { currentKanban, addStage, updateStage, deleteStage, reorderStages, deleteKanban } = useKanban();
    const [newStageName, setNewStageName] = useState('');
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    if (!isOpen || !currentKanban) return null;

    const handleAddStage = async () => {
        if (!newStageName.trim()) return;
        await addStage(newStageName);
        setNewStageName('');
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggingId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggingId || draggingId === targetId) return;

        const stages = [...currentKanban.stages];
        const sourceIndex = stages.findIndex(s => s.id === draggingId);
        const targetIndex = stages.findIndex(s => s.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        const [removed] = stages.splice(sourceIndex, 1);
        stages.splice(targetIndex, 0, removed);

        // Update local optimism? For now just call service
        const updates = stages.map((s, idx) => ({ id: s.id, position: idx }));
        await reorderStages(updates);
        setDraggingId(null);
    };

    const handleMarkAsCompletion = async (stageId: string) => {
        // Encontra a etapa atual de conclusão se houver
        const currentCompletionStage = currentKanban.stages.find(s => s.systemStatus === 'done');
        
        // Se já é a etapa de conclusão, não faz nada
        if (currentCompletionStage?.id === stageId) return;

        // Se havia uma anterior, remove o status dela
        if (currentCompletionStage) {
            await updateStage(currentCompletionStage.id, { systemStatus: null } as any);
        }

        // Define a nova como conclusão
        await updateStage(stageId, { systemStatus: 'done' });
    };

    const startEditing = (stage: any) => {
        setEditingId(stage.id);
        setEditName(stage.name);
    };

    const saveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        await updateStage(editingId, { name: editName });
        setEditingId(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Etapas" width="max-w-lg">
            <div className="flex flex-col max-h-[70vh]">
                <div className="overflow-y-auto flex-1 pb-4">
                    {/* Add New */}
                    <div className="flex gap-2 mb-4 items-center">
                        <input
                            type="text"
                            placeholder="Nova etapa..."
                            className="flex-1 bg-background border border-input rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                            value={newStageName}
                            onChange={e => setNewStageName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                        />
                        <Button
                            onClick={handleAddStage}
                            disabled={!newStageName.trim()}
                        >
                            Adicionar
                        </Button>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {currentKanban.stages.map(stage => (
                            <div
                                key={stage.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, stage.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.id)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border border-border bg-background group hover:border-primary/50 transition-colors shadow-sm",
                                    draggingId === stage.id && "opacity-50"
                                )}
                            >
                                <GripVertical size={16} className="text-muted-foreground cursor-grab active:cursor-grabbing" />

                                <div className="flex-1">
                                    {editingId === stage.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                className="flex-1 bg-secondary px-2 py-1.5 border border-input rounded-md text-sm outline-none focus:border-primary"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                                disabled={stage.isLocked}
                                            />
                                            {!stage.isLocked && (
                                                <button onClick={saveEdit} className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors">
                                                    <Check size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-500 transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={cn("font-medium text-sm cursor-pointer hover:underline", stage.isLocked && "cursor-default hover:no-underline text-muted-foreground")}
                                                onClick={() => !stage.isLocked && startEditing(stage)}
                                            >
                                                {stage.name}
                                                {stage.isLocked && <span className="ml-2 text-[10px] border border-border px-1 rounded uppercase bg-secondary">Fixo</span>}
                                                {stage.systemStatus === 'done' && (
                                                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500 ring-1 ring-inset ring-emerald-500/20 uppercase" title="Etapa de Conclusão">
                                                        <Check size={10} className="mr-0.5" /> Conclusão
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Color Picker */}
                                <div className="flex gap-1">
                                    {!stage.isLocked && COLORS.map(c => (
                                        <button
                                            key={c.value}
                                            className={cn(
                                                "w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer",
                                                c.value,
                                                stage.color === c.value && "ring-2 ring-white ring-offset-1 ring-offset-background"
                                            )}
                                            onClick={() => updateStage(stage.id, { color: c.value })}
                                            title={c.name}
                                        />
                                    ))}
                                    {stage.isLocked && (
                                        <div className={cn("w-4 h-4 rounded-full opacity-50", stage.color)} />
                                    )}
                                </div>

                                {!stage.isLocked ? (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        {stage.systemStatus !== 'done' && (
                                            <button
                                                onClick={() => handleMarkAsCompletion(stage.id)}
                                                className="p-1.5 rounded text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-500"
                                                title="Marcar como Etapa de Conclusão"
                                            >
                                                <Check size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteStage(stage.id)}
                                            className="p-1.5 rounded text-muted-foreground hover:bg-rose-500/20 hover:text-rose-500"
                                            title="Excluir etapa"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-14 h-7" /> // Spacer for fixed stages
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-border mt-2 flex justify-between items-center bg-card">
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                            if (confirm(`ATENÇÃO: Isso excluirá todo o funil "${currentKanban.name}" e todas as etapas.\n\nSe estiver no modo único (Commercial), um novo funil padrão será criado.\n\nDeseja continuar?`)) {
                                onClose();
                                await deleteKanban(currentKanban.id);
                            }
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <Trash2 size={14} />
                        Apagar Funil
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Arraste para reordenar.
                    </p>
                </div>
            </div>
        </Modal>
    );
};
