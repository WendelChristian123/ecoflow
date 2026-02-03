import React from 'react';
import { Quote } from '../../types';
import { cn } from '../Shared';
import { Calendar } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { KanbanProvider, useKanban } from '../Kanban/KanbanContext';
import { KanbanBoard } from '../Kanban/KanbanBoard';
import { KanbanHeader } from '../Kanban/KanbanHeader';
import { KanbanCard } from '../Kanban/KanbanCard';

interface QuoteKanbanProps {
    quotes: Quote[];
    onStatusChange: (quoteId: string, newStatus: string) => void;
    onQuoteClick: (quote: Quote) => void;
    onMove?: () => void;
}

const QuoteKanbanContent: React.FC<QuoteKanbanProps> = ({ quotes, onQuoteClick }) => {
    const { currentKanban } = useKanban();

    const groupByStage = (entities: Quote[], stageId: string) => {
        if (!currentKanban) return [];
        const stage = currentKanban.stages.find(s => s.id === stageId);
        return entities.filter(q => {
            if (q.kanbanStageId === stageId) return true;
            // Fallback for legacy items or items created outside Kanban
            if (!q.kanbanStageId && stage?.systemStatus && q.status === stage.systemStatus) return true;
            return false;
        });
    };

    const calculateTotal = (entities: Quote[]) => entities.reduce((acc, q) => acc + q.totalValue, 0);

    return (
        <div className="flex flex-col h-full">
            <KanbanHeader />
            <div className="flex-1 min-h-0">
                <KanbanBoard
                    entities={quotes}
                    groupByStage={groupByStage}
                    calculateTotal={calculateTotal}
                    renderCard={(quote: Quote) => (
                        <QuoteCard key={quote.id} quote={quote} onClick={() => onQuoteClick(quote)} />
                    )}
                />
            </div>
        </div>
    );
};

export const QuoteKanban: React.FC<QuoteKanbanProps> = (props) => {
    return (
        <KanbanProvider
            module="crm"
            entityTable="quotes"
            onEntityMove={(id, stageId) => {
                // Determine status change for parent callback if needed
                // But props.onStatusChange expects a status string, not stageId
                // We might rely on the context to handle the DB update
                console.log('Moved', id, stageId);
                if (props.onMove) props.onMove();
            }}
        >
            <QuoteKanbanContent {...props} />
        </KanbanProvider>
    );
};

const QuoteCard: React.FC<{ quote: Quote; onClick: () => void }> = ({ quote, onClick }) => {
    const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();

    return (
        <KanbanCard id={quote.id} onClick={onClick}>
            <div className="bg-card border border-border rounded-lg shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all group overflow-hidden">
                <div className="p-3">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">#{quote.id.substring(0, 4)}</span>
                            <h4 className="text-sm font-semibold text-foreground line-clamp-1" title={quote.contact?.name || quote.customerName}>
                                {quote.contact?.name || quote.customerName || 'Cliente Desconhecido'}
                            </h4>
                        </div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.totalValue)}
                        </div>
                    </div>
                </div>

                {/* Barra de Vencimento com Data Integrada */}
                <div className={cn(
                    "px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors",
                    isExpired
                        ? "bg-rose-500 text-white"
                        : "bg-emerald-500 text-white"
                )}>
                    <Calendar size={14} />
                    <span>{quote.validUntil ? formatDate(quote.validUntil) : 'Sem validade'}</span>
                </div>
            </div>
        </KanbanCard>
    );
};
