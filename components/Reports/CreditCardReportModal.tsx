import React, { useState, useMemo, useEffect } from 'react';
import { FinancialTransaction, CreditCard, FinancialAccount, FinancialCategory } from '../../types';
import { Modal, Button } from '../Shared';
import { X, Printer, ChevronLeft, ChevronRight, CreditCard as CardIcon, Calendar } from 'lucide-react';
import { format, addMonths, startOfDay, endOfDay, isWithinInterval, parseISO, addDays, getYear, getMonth, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '../../utils/formatters';

interface CreditCardReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    card: CreditCard | null;
    transactions: FinancialTransaction[];
    stats?: { used: number; available: number; percent: number };
    categories: FinancialCategory[];
}

export const CreditCardReportModal: React.FC<CreditCardReportModalProps> = ({ isOpen, onClose, card, transactions, stats, categories }) => {
    // State for the reference date (determines which invoice month we are viewing)
    // Default to today, or if we want to default to the "current open invoice", we might need logic.
    // For now, defaulting to today is reasonable as it usually lands in the current or next invoice.
    const [referenceDate, setReferenceDate] = useState(new Date());

    useEffect(() => {
        if (isOpen) {
            setReferenceDate(new Date());
        }
    }, [isOpen]);

    // Remove early return check
    // if (!isOpen || !card) return null;

    // --- Helpers ---
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Calculate Invoice Period based on Reference Date
    // Helpers moved outside or safe-guarded
    const cardDefaults = { closingDay: 1, dueDay: 10, id: '' };
    const activeCard = card || cardDefaults as CreditCard;

    const getInvoicePeriod = (refDate: Date) => {
        const closingDay = Number(activeCard.closingDay || 1);

        let targetClosingDate = new Date(refDate);
        targetClosingDate.setDate(closingDay);

        // If refDate is ON or AFTER the closing day, we are in the NEXT invoice period
        // Example: Closing 9th. Today 9th. 9th belongs to Next Invoice.
        if (refDate.getDate() >= closingDay) {
            targetClosingDate = addMonths(targetClosingDate, 1);
        }

        // User Rule:
        // Start: Closing Day of Previous Month
        // End: Closing Day - 1 of Current Month

        const startDate = addMonths(targetClosingDate, -1); // Previous Closing Day
        const endDate = addDays(targetClosingDate, -1);     // Day before Closing Day

        // Due Date (Reference)
        const dueDate = new Date(targetClosingDate);
        const dueDay = Number(activeCard.dueDay || 10);
        dueDate.setDate(dueDay);
        if (dueDay < closingDay) {
            dueDate.setMonth(dueDate.getMonth() + 1);
        }

        return { startDate, endDate, dueDate };
    };

    const { startDate, endDate, dueDate } = getInvoicePeriod(referenceDate);

    // Filter Transactions
    const filteredData = useMemo(() => {
        if (!card) return [];
        return transactions.filter(t => {
            if (t.creditCardId !== card.id) return false;
            // Exclude purely technical transactions if they are internal markers, 
            // but user might want to see them if they are relevant. 
            // Usually "Payment of Invoice" is an expense on the Bank Account, not the Card.
            // But "Pagamento Fatura (Crédito Local)" is the credit on the card.
            // Let's exclude the credit payment to show only expenses/refunds?
            // "lancamentos da fatura" usually IMPLIES expenses. 
            // If we include payments, the total might look weird (approaching zero).
            // Let's exclude the "Pagamento Fatura (Crédito Local)" income to show just the SPENDING.
            if (t.description.includes('Pagamento Fatura (Crédito Local)')) return false;

            const tDate = parseDateLocal(t.date);
            // Use startOfDay/endOfDay to ensure full coverage
            return isWithinInterval(tDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
        }).sort((a, b) => parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime());
    }, [transactions, card?.id, startDate, endDate]);

    // Calculate Invoice Total (Sum of expenses - refunds)
    const invoiceTotal = filteredData.reduce((acc, t) => {
        if (t.type === 'expense') return acc + t.amount;
        if (t.type === 'income') return acc - t.amount; // Refund reduces invoice
        return acc;
    }, 0);

    // Group by Date for Display
    const groupedData = useMemo(() => {
        const groups: { [key: string]: FinancialTransaction[] } = {};
        filteredData.forEach(t => {
            const dateKey = t.date; // YYYY-MM-DD
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(t);
        });
        return groups;
    }, [filteredData]);

    // Print Logic (Consistent with FinancialReportModal)
    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Fatura - ${card.name}</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #0f172a; max-width: 1200px; margin: 0 auto; }
                    h1 { color: #0f172a; font-size: 24px; margin-bottom: 5px; }
                    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .meta { color: #64748b; font-size: 12px; line-height: 1.5; }
                    .text-right { text-align: right; }
                    
                    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                    .kpi-card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .kpi-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
                    .kpi-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                    th { text-align: left; padding: 8px; background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                    
                    .date-row { background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
                    .transaction-row:nth-child(even) { background: #f8fafc; }
                    
                    .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; display: inline-block; background: #e2e8f0; color: #475569; }
                    
                    .text-emerald { color: #059669; }
                    .text-rose { color: #e11d48; }
                    .text-indigo { color: #4f46e5; }
                    
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                 <div class="header">
                    <div>
                        <h1>Relatório de Fatura</h1>
                        <div class="meta"><strong>${card.name}</strong> • Cartão Final ****</div>
                    </div>
                    <div class="meta text-right">
                        <div><strong>Período:</strong> ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}</div>
                        <div><strong>Vencimento:</strong> ${format(dueDate, 'dd/MM/yyyy')}</div>
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-title">Limite Total</div>
                        <div class="kpi-value">${fmt(card.limitAmount)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Em Uso (Total)</div>
                        <div class="kpi-value text-rose">${stats ? fmt(stats.used) : '-'}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Disponível</div>
                        <div class="kpi-value text-emerald">${stats ? fmt(stats.available) : '-'}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Valor da Fatura</div>
                        <div class="kpi-value text-indigo">${fmt(invoiceTotal)}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Descrição</th>
                            <th style="width: 30%;">Categoria</th>
                            <th class="text-right" style="width: 20%;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(groupedData).sort().map(date => `
                            <tr>
                                <td colspan="3" class="date-row">
                                    ${format(parseDateLocal(date), "dd 'de' MMMM, EEEE", { locale: ptBR })}
                                </td>
                            </tr>
                            ${groupedData[date].map(t => `
                                <tr class="transaction-row">
                                    <td>
                                        <strong>${t.description}</strong>
                                        ${t.observation ? `<div style="font-size: 9px; color: #64748b;">${t.observation}</div>` : ''}
                                    </td>
                                    <td><span class="badge">${categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria'}</span></td>
                                    <td class="text-right">
                                        <span class="${t.type === 'expense' ? 'text-rose' : 'text-emerald'}" style="font-weight: 700;">
                                            ${t.type === 'expense' ? '- ' : '+ '}${fmt(t.amount)}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 20px; text-align: right;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total da Fatura</div>
                    <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${fmt(invoiceTotal)}</div>
                </div>

                 <script>
                    window.onload = () => { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    if (!isOpen || !card) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-2xl w-full max-w-[95vw] lg:max-w-5xl h-[85vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden">

                {/* Header (Screen Only) */}
                <div className="flex justify-between items-center p-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <CardIcon size={20} className="text-emerald-500" /> Relatório de Fatura
                        </h2>
                        <p className="text-slate-400 text-xs">Extrato detalhado do cartão de crédito</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" className="text-xs h-8" onClick={onClose} icon={X}>Fechar</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={handlePrint} icon={Printer}>Imprimir / PDF</Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="space-y-6">

                        {/* Report Header Info */}
                        <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-1">{card.name}</h1>
                                <div className="text-slate-400 text-xs space-y-0.5">
                                    <p>Cartão de Crédito • Final ****</p>
                                    <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Período da Fatura</div>
                                <div className="text-lg font-bold text-white">
                                    {format(startDate, 'dd/MM/yyyy')} até {format(endDate, 'dd/MM/yyyy')}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    Vencimento: <strong>{format(dueDate, 'dd/MM/yyyy')}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Card Limits & Stats - Compact */}
                        <div className="grid grid-cols-4 gap-3 mb-6">
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <div className="text-slate-400 text-[10px] uppercase font-bold mb-1">Limite Total</div>
                                <div className="text-xl font-bold text-white">{fmt(card.limitAmount)}</div>
                            </div>
                            <div className="bg-rose-950/20 p-3 rounded-lg border border-rose-900/30">
                                <div className="text-rose-400 text-[10px] uppercase font-bold mb-1">Limite Em Uso (Total)</div>
                                <div className="text-xl font-bold text-rose-400">{stats ? fmt(stats.used) : '-'}</div>
                            </div>
                            <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/30">
                                <div className="text-emerald-400 text-[10px] uppercase font-bold mb-1">Limite Disponível</div>
                                <div className="text-xl font-bold text-emerald-400">{stats ? fmt(stats.available) : '-'}</div>
                            </div>
                            <div className="bg-indigo-950/20 p-3 rounded-lg border border-indigo-900/30">
                                <div className="text-indigo-400 text-[10px] uppercase font-bold mb-1">Valor da Fatura</div>
                                <div className="text-xl font-bold text-indigo-400">{fmt(invoiceTotal)}</div>
                            </div>
                        </div>

                        {/* Month Navigation */}
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <button
                                onClick={() => setReferenceDate(addMonths(referenceDate, -1))}
                                className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Fatura de</div>
                                <div className="text-lg font-bold text-white flex items-center gap-2">
                                    <Calendar size={16} className="text-indigo-400" />
                                    {format(dueDate, 'MMMM yyyy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                                </div>
                            </div>
                            <button
                                onClick={() => setReferenceDate(addMonths(referenceDate, 1))}
                                className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Transactions List (Single Table for Alignment) */}
                        <div className="space-y-4">
                            {Object.keys(groupedData).length > 0 ? (
                                <div className="bg-slate-800/30 rounded-lg overflow-hidden border border-slate-700/50">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-800/80 text-slate-400 font-medium border-b border-slate-700">
                                            <tr>
                                                <th className="px-4 py-2 w-[50%]">Descrição</th>
                                                <th className="px-4 py-2 w-[30%]">Categoria</th>
                                                <th className="px-4 py-2 text-right w-[20%]">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {Object.keys(groupedData).sort().map(date => (
                                                <React.Fragment key={date}>
                                                    {/* Date Header Row */}
                                                    <tr className="bg-slate-800/50 border-b border-slate-700/50">
                                                        <td colSpan={3} className="px-4 py-2 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                                            {format(parseDateLocal(date), "dd 'de' MMMM, EEEE", { locale: ptBR })}
                                                        </td>
                                                    </tr>
                                                    {/* Transaction Rows */}
                                                    {groupedData[date].map(t => (
                                                        <tr key={t.id} className="hover:bg-slate-800/50 transition-colors group">
                                                            <td className="px-4 py-2 text-slate-200">
                                                                <div className="font-medium group-hover:text-white transition-colors">{t.description}</div>
                                                                {t.observation && <div className="text-[10px] text-slate-500 mt-0.5">{t.observation}</div>}
                                                            </td>
                                                            <td className="px-4 py-2 text-slate-400">
                                                                <span className="bg-slate-800 rounded px-1.5 py-0.5 text-[10px] border border-slate-700">
                                                                    {categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <span className={t.type === 'expense' ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
                                                                    {t.type === 'expense' ? '- ' : '+ '}{fmt(t.amount)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500 text-sm">
                                    Nenhum lançamento encontrado para esta fatura.
                                </div>
                            )}
                        </div>

                        {/* Invoice Footer Total */}
                        <div className="mt-6 border-t border-slate-700 pt-4 flex justify-end">
                            <div className="text-right">
                                <div className="text-slate-400 text-xs uppercase mb-1">Total da Fatura</div>
                                <div className="text-2xl font-bold text-white">{fmt(invoiceTotal)}</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
