import React, { useState } from 'react';
import { useKanban } from './KanbanContext';
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react';
import { cn } from '../Shared';

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
    const { currentKanban, addStage, updateStage, deleteStage, reorderStages } = useKanban();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-bold text-lg">Gerenciar Etapas</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {/* Add New */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Nova etapa..."
                            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={newStageName}
                            onChange={e => setNewStageName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                        />
                        <button
                            onClick={handleAddStage}
                            disabled={!newStageName.trim()}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                        >
                            Adicionar
                        </button>
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
                                    "flex items-center gap-3 p-3 rounded-lg border border-border bg-background group hover:border-primary/50 transition-colors",
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
                                                className="flex-1 bg-secondary px-2 py-1 rounded text-sm"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                            />
                                            <button onClick={saveEdit} className="text-emerald-500"><Check size={16} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-rose-500"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span
                                                className="font-medium text-sm cursor-pointer hover:underline"
                                                onClick={() => startEditing(stage)}
                                            >
                                                {stage.name}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Color Picker - Simplified */}
                                <div className="flex gap-1">
                                    {COLORS.map(c => (
                                        <button
                                            key={c.value}
                                            className={cn(
                                                "w-4 h-4 rounded-full transition-transform hover:scale-125",
                                                c.value,
                                                stage.color === c.value && "ring-2 ring-white ring-offset-1 ring-offset-background"
                                            )}
                                            onClick={() => updateStage(stage.id, { color: c.value })}
                                            title={c.name}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={() => deleteStage(stage.id)}
                                    className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-secondary/30 rounded-b-xl">
                    <p className="text-xs text-muted-foreground text-center">
                        Arraste para reordenar. Clique no nome para editar.
                    </p>
                </div>
            </div>
        </div>
    );
};
