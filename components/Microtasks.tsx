import React, { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Microtask } from '../types';
import { cn } from './Shared';

interface MicrotasksProps {
    microtasks: Microtask[];
    onChange: (microtasks: Microtask[]) => void;
    darkMode?: boolean;
}

export const Microtasks: React.FC<MicrotasksProps> = ({ microtasks, onChange, darkMode }) => {
    const [inputValue, setInputValue] = useState('');

    const handleAdd = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        const newTask: Microtask = {
            id: `temp-${Date.now()}`,
            parent_type: 'task', // will be overridden by backend or sync
            parent_id: '',
            title: trimmed,
            is_completed: false,
            sort_order: microtasks.length
        };

        onChange([...microtasks, newTask]);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const toggleComplete = (id: string) => {
        onChange(microtasks.map(m => 
            m.id === id ? { ...m, is_completed: !m.is_completed } : m
        ));
    };

    const handleRemove = (id: string) => {
        onChange(microtasks.filter(m => m.id !== id));
    };

    return (
        <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Microtarefas</h4>
            
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Adicionar microtarefa e pressionar Enter"
                    className={cn(
                        "w-full h-10 px-3 pr-9 text-sm rounded-lg border focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-muted-foreground",
                        darkMode 
                            ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-slate-600" 
                            : "bg-card border-border text-foreground"
                    )}
                />
                <button 
                    type="button"
                    onClick={handleAdd}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                    title="Adicionar"
                >
                    <Plus size={16} />
                </button>
            </div>

            {microtasks.length > 0 && (
                <div className="space-y-1 mt-2">
                    {microtasks.map((task) => (
                        <div 
                            key={task.id} 
                            className={cn(
                                "group flex items-start gap-3 p-2 rounded-lg transition-colors border border-transparent",
                                darkMode ? "hover:bg-slate-800 hover:border-slate-700" : "hover:bg-muted/50 hover:border-border/50"
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => toggleComplete(task.id)}
                                className={cn(
                                    "mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors shadow-sm",
                                    task.is_completed 
                                        ? "bg-primary border-primary text-primary-foreground" 
                                        : darkMode ? "border-slate-600 hover:border-primary" : "border-slate-300 hover:border-primary bg-background"
                                )}
                            >
                                {task.is_completed && <Check size={12} strokeWidth={3} />}
                            </button>
                            
                            <span 
                                className={cn(
                                    "flex-1 text-sm transition-all select-none cursor-pointer",
                                    task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                                )}
                                onClick={() => toggleComplete(task.id)}
                            >
                                {task.title}
                            </span>

                            <button
                                type="button"
                                onClick={() => handleRemove(task.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 -m-1 rounded hover:bg-muted"
                                title="Remover"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
