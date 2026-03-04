import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X, ClipboardList, Calendar } from 'lucide-react';

interface FABAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

interface FABButtonProps {
    onCreateTransaction?: () => void;
    onCreateQuote?: () => void;
    onCreateTask?: () => void;
    onCreateEvent?: () => void;
}

export const FABButton: React.FC<FABButtonProps> = ({
    onCreateTransaction,
    onCreateQuote,
    onCreateTask,
    onCreateEvent,
}) => {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useState(false);
    const path = location.pathname;

    // Determine context based on current route
    const getContext = (): 'dashboard' | 'commercial' | 'routines' | 'finance' | 'settings' | 'unknown' => {
        if (path.startsWith('/dashboard')) return 'dashboard';
        if (path.startsWith('/commercial')) return 'commercial';
        if (path.startsWith('/tasks') || path.startsWith('/agenda')) return 'routines';
        if (path.startsWith('/finance')) return 'finance';
        if (path.startsWith('/settings')) return 'settings';
        return 'unknown';
    };

    const context = getContext();

    // Hide FAB on settings
    if (context === 'settings' || context === 'unknown') return null;

    // For routines: show action sheet with 2 options
    if (context === 'routines') {
        const actions: FABAction[] = [
            {
                label: 'Nova Tarefa',
                icon: <ClipboardList size={18} />,
                onClick: () => { onCreateTask?.(); setIsExpanded(false); },
            },
            {
                label: 'Novo Compromisso',
                icon: <Calendar size={18} />,
                onClick: () => { onCreateEvent?.(); setIsExpanded(false); },
            },
        ];

        return (
            <>
                {/* Backdrop */}
                {isExpanded && (
                    <div
                        className="fixed inset-0 bg-black/40 z-[70] backdrop-blur-sm"
                        onClick={() => setIsExpanded(false)}
                    />
                )}

                {/* Action items */}
                <div className="fixed right-5 bottom-24 z-[75] flex flex-col items-end gap-3">
                    {isExpanded && actions.map((action, index) => (
                        <button
                            key={index}
                            onClick={action.onClick}
                            className="flex items-center gap-3 bg-slate-800 border border-slate-700 text-white pl-4 pr-5 py-3 rounded-full shadow-lg shadow-black/30 animate-in slide-in-from-bottom-2 fade-in duration-200"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="text-emerald-400">{action.icon}</div>
                            <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
                        </button>
                    ))}
                </div>

                {/* Main FAB */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`
            fixed right-5 bottom-20 z-[75] w-14 h-14 rounded-full
            flex items-center justify-center
            shadow-lg shadow-emerald-500/30
            transition-all duration-300 active:scale-90
            ${isExpanded
                            ? 'bg-slate-700 rotate-45'
                            : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                        }
          `}
                >
                    {isExpanded ? <X size={24} className="text-white" /> : <Plus size={24} className="text-white" />}
                </button>
            </>
        );
    }

    // For single-action contexts
    const handleClick = () => {
        switch (context) {
            case 'dashboard':
            case 'finance':
                onCreateTransaction?.();
                break;
            case 'commercial':
                onCreateQuote?.();
                break;
        }
    };

    return (
        <button
            onClick={handleClick}
            className="
        fixed right-5 bottom-20 z-[75] w-14 h-14 rounded-full
        bg-gradient-to-br from-emerald-500 to-emerald-600
        flex items-center justify-center
        shadow-lg shadow-emerald-500/30
        transition-all duration-200 active:scale-90
        hover:shadow-xl hover:shadow-emerald-500/40
      "
        >
            <Plus size={24} className="text-white" />
        </button>
    );
};
