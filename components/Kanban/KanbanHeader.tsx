import React, { useState } from 'react';
import { useKanban } from './KanbanContext';
import { Button, Select, Modal } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { Plus, Settings, Kanban as KanbanIcon, Trash2, GripVertical } from 'lucide-react';
import { StageManagerModal } from './StageManagerModal';

export const KanbanHeader: React.FC = () => {
    const { kanbans, currentKanban, setCurrentKanban, createKanban, deleteKanban, singleBoardMode } = useKanban();
    const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
    const [isNewKanbanOpen, setIsNewKanbanOpen] = useState(false);
    const [newKanbanName, setNewKanbanName] = useState('');

    const handleCreateKanban = async () => {
        if (!newKanbanName.trim()) return;
        await createKanban(newKanbanName);
        setNewKanbanName('');
        setIsNewKanbanOpen(false);
    };

    const handleDeleteKanban = async () => {
        if (!currentKanban) return;
        if (confirm(`Tem certeza que deseja excluir o kanban "${currentKanban.name}"?`)) {
            await deleteKanban(currentKanban.id);
        }
    };

    return (
        <div className="flex items-center gap-4 mb-4 bg-card p-2 rounded-lg border border-border shadow-sm">
            {/* Create New Kanban & Selector (Multi Mode Only) */}
            {!singleBoardMode && (
                <>
                    <div className="flex items-center gap-2">
                        {isNewKanbanOpen ? (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Nome do Kanban..."
                                    className="bg-background border border-border rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={newKanbanName}
                                    onChange={e => setNewKanbanName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateKanban()}
                                />
                                <button onClick={handleCreateKanban} className="text-emerald-500 hover:text-emerald-600"><Plus size={18} /></button>
                                <button onClick={() => setIsNewKanbanOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsNewKanbanOpen(true)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 px-3 py-1.5 rounded transition-colors"
                            >
                                <Plus size={14} />
                                Novo Kanban
                            </button>
                        )}
                    </div>

                    <div className="h-4 w-px bg-border mx-2" />

                    {/* Kanban Selector */}
                    <div className="flex-1 max-w-xs">
                        {kanbans.length > 0 ? (
                            <FilterSelect
                                value={currentKanban?.id || ''}
                                onChange={(val) => {
                                    const found = kanbans.find(k => k.id === val);
                                    if (found) setCurrentKanban(found);
                                }}
                                options={kanbans.map(k => ({ value: k.id, label: k.name }))}
                                className="w-full"
                                triggerClassName="w-full justify-between"
                                placeholder="Selecione um Kanban"
                            />
                        ) : (
                            <span className="text-sm text-muted-foreground italic">Nenhum kanban criado</span>
                        )}
                    </div>
                </>
            )}

            {/* Actions for Current Kanban */}
            {
                currentKanban && (
                    <div className="flex items-center gap-2 ml-auto">
                        {/* In Single Mode, we might want to show the current board name for context if needed, but Page Header usually does that.
                        We just show Manage Stages.
                    */}

                        <button
                            onClick={() => setIsStageManagerOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-secondary transition-colors"
                        >
                            <Settings size={14} />
                            Gerenciar Etapas
                        </button>

                        {/* Delete only allowed in Multi Mode and if not default (though single mode implies default) */}
                        {!singleBoardMode && !currentKanban.isDefault && (
                            <button
                                onClick={handleDeleteKanban}
                                className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 px-2 py-1.5 rounded hover:bg-rose-500/10 transition-colors"
                                title="Excluir Kanban atual"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )
            }

            {/* Modals */}
            {
                isStageManagerOpen && (
                    <StageManagerModal
                        isOpen={isStageManagerOpen}
                        onClose={() => setIsStageManagerOpen(false)}
                    />
                )
            }
        </div >
    );
};
