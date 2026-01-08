import React, { useState } from 'react';
import { Quote } from '../../types';
import { Card, Badge, cn } from '../Shared';
import { Calendar, AlertCircle } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface QuoteKanbanProps {
    quotes: Quote[];
    onStatusChange: (quoteId: string, newStatus: string) => void;
    onQuoteClick: (quote: Quote) => void;
}

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';

const COLUMNS: { id: QuoteStatus; title: string; color: string }[] = [
    { id: 'draft', title: 'Rascunho', color: 'bg-slate-500' },
    { id: 'sent', title: 'Enviado', color: 'bg-amber-500' },
    { id: 'approved', title: 'Aprovado', color: 'bg-emerald-500' },
    { id: 'rejected', title: 'Rejeitado', color: 'bg-rose-500' }
];

export const QuoteKanban: React.FC<QuoteKanbanProps> = ({ quotes, onStatusChange, onQuoteClick }) => {
    return (
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
            {COLUMNS.map(col => (
                <KanbanColumn
                    key={col.id}
                    column={col}
                    quotes={quotes.filter(q => q.status === col.id)}
                    onStatusChange={onStatusChange}
                    onQuoteClick={onQuoteClick}
                />
            ))}
        </div>
    );
};

const KanbanColumn: React.FC<{
    column: typeof COLUMNS[0];
    quotes: Quote[];
    onStatusChange: (id: string, status: string) => void;
    onQuoteClick: (quote: Quote) => void;
}> = ({ column, quotes, onStatusChange, onQuoteClick }) => {
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
        const quoteId = e.dataTransfer.getData('quoteId');
        if (quoteId) {
            onStatusChange(quoteId, column.id);
        }
    };

    const totalValue = quotes.reduce((acc, q) => acc + q.totalValue, 0);

    return (
        <div
            className={cn(
                "flex-1 min-w-[300px] flex flex-col bg-slate-900/30 rounded-xl border transition-colors h-full",
                isDragOver ? "border-emerald-500/50 bg-slate-800/50" : "border-slate-800"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Header */}
            <div className="p-3 border-b border-slate-800 flex flex-col gap-1 sticky top-0 bg-slate-900/90 backdrop-blur rounded-t-xl z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                        <span className="font-bold text-slate-200 text-sm uppercase">{column.title}</span>
                        <span className="bg-slate-800 text-slate-500 text-xs px-2 py-0.5 rounded-full border border-slate-700">{quotes.length}</span>
                    </div>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                </div>
            </div>

            {/* List */}
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {quotes.length === 0 && (
                    <div className="h-24 flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-800/50 rounded-lg text-xs">
                        Vazio
                    </div>
                )}
                {quotes.map(q => (
                    <QuoteCard key={q.id} quote={q} onClick={() => onQuoteClick(q)} />
                ))}
            </div>
        </div>
    );
};

const QuoteCard: React.FC<{ quote: Quote; onClick: () => void }> = ({ quote, onClick }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('quoteId', quote.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onClick={onClick}
            className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-sm hover:border-emerald-500/50 hover:shadow-md cursor-grab active:cursor-grabbing transition-all group"
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">#{quote.id.substring(0, 4)}</span>
                    <h4 className="text-sm font-semibold text-white line-clamp-1" title={quote.contact?.name || quote.customerName}>
                        {quote.contact?.name || quote.customerName || 'Cliente Desconhecido'}
                    </h4>
                </div>
                <div className="text-xs font-bold text-emerald-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.totalValue)}
                </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar size={12} />
                    <span>{formatDate(quote.date)}</span>
                </div>

                {new Date(quote.validUntil) < new Date() && quote.status !== 'approved' && quote.status !== 'rejected' && (
                    <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                        <AlertCircle size={10} /> Expira
                    </div>
                )}
            </div>
        </div>
    );
};
