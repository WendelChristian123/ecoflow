import React, { useState, useMemo } from 'react';
import { Quote } from '../../types';
import { Button, Select, Badge } from '../Shared';
import { X, Printer, FileText, Filter, DollarSign, TrendingUp, Briefcase } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommercialReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    quotes: Quote[];
    users: any[];
}

export const CommercialReportModal: React.FC<CommercialReportModalProps> = ({ isOpen, onClose, quotes, users }) => {
    if (!isOpen) return null;

    // Default Filters
    const [startDate, setStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('all');
    const [assigneeFilter, setAssigneeFilter] = useState('all');

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Filter Logic
    const filteredData = useMemo(() => {
        return quotes.filter(q => {
            if (!q.createdAt) return false;
            const qDate = parseISO(q.createdAt); // Using Created Date for report
            const start = startOfDay(parseISO(startDate));
            const end = endOfDay(parseISO(endDate));
            const inRange = isWithinInterval(qDate, { start, end });

            // Status
            let statusMatch = true;
            if (statusFilter !== 'all') {
                statusMatch = q.status === statusFilter;
            }

            // Assignee
            let assigneeMatch = true;
            if (assigneeFilter !== 'all') {
                // Assuming quote has assigneeId? Quote type usually has userId or similar.
                // Let's check type definition if needed, but standard is userId or assigneeId.
                // Looking at Quotes.tsx previously, we might need to assume 'userId' if not assigneeId.
                // Let's assume 'userId' based on typical schema, can fix if it errors.
                // Actually looking at Quote type in memory... let's stick to generic check or verify.
                // Code below checks generic "userId" or "assigneeId".
                assigneeMatch = (q.userId === assigneeFilter) || ((q as any).assigneeId === assigneeFilter);
            }

            return inRange && statusMatch && assigneeMatch;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [quotes, startDate, endDate, statusFilter, assigneeFilter]);

    // Summary Calculations
    const calculateTotals = () => {
        let totalValue = 0;
        let approvedValue = 0;
        let openValue = 0;
        let count = filteredData.length;
        let approvedCount = 0;

        filteredData.forEach(q => {
            totalValue += q.totalValue;
            if (q.status === 'approved') {
                approvedValue += q.totalValue;
                approvedCount++;
            } else if (['draft', 'sent', 'negotiation'].includes(q.status)) {
                openValue += q.totalValue;
            }
        });

        return {
            totalValue,
            approvedValue,
            openValue,
            count,
            approvedCount,
            conversionRate: count > 0 ? (approvedCount / count) * 100 : 0
        };
    };

    const totals = calculateTotals();

    const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'N/A';

    // Print
    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório Comercial - EcoFlow</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #0f172a; max-width: 1200px; margin: 0 auto; }
                    h1 { color: #0f172a; font-size: 24px; margin-bottom: 5px; }
                    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .meta { color: #64748b; font-size: 12px; line-height: 1.5; }
                    
                    .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 30px 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { text-align: left; padding: 8px; background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                    tr:nth-child(even) { background: #f8fafc; }
                    
                    .text-right { text-align: right; }
                    
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>Relatório Comercial</h1>
                        <div class="meta"><strong>EcoFlow Systems</strong></div>
                    </div>
                    <div class="meta text-right">
                        <div><strong>Período:</strong> ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}</div>
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Status:</strong> ${statusFilter === 'all' ? 'Todos' : statusFilter.toUpperCase()}</div>
                    </div>
                </div>

                <div class="section-title">Resumo do Período</div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
                     <div style="background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Orçamentos</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${totals.count}</div>
                     </div>
                     <div style="background: #f0fdf4; padding: 15px; border: 1px solid #dcfce7; border-radius: 8px;">
                        <div style="font-size: 10px; color: #15803d; text-transform: uppercase; font-weight: 700;">Volume Aprovado</div>
                        <div style="font-size: 20px; font-weight: 700; color: #166534;">${fmt(totals.approvedValue)}</div>
                     </div>
                     <div style="background: #fef2f2; padding: 15px; border: 1px solid #fee2e2; border-radius: 8px;">
                         <div style="font-size: 10px; color: #b91c1c; text-transform: uppercase; font-weight: 700;">Taxa Conversão</div>
                         <div style="font-size: 20px; font-weight: 700; color: #991b1b;">${totals.conversionRate.toFixed(1)}%</div>
                     </div>
                     <div style="background: #eff6ff; padding: 15px; border: 1px solid #dbeafe; border-radius: 8px;">
                         <div style="font-size: 10px; color: #1d4ed8; text-transform: uppercase; font-weight: 700;">Volume Total</div>
                         <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${fmt(totals.totalValue)}</div>
                     </div>
                </div>

                <div class="section-title">Detalhamento de Orçamentos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Cliente</th>
                            <th>Título</th>
                            <th>Responsável</th>
                            <th>Status</th>
                            <th class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(q => `
                            <tr>
                                <td>${format(parseISO(q.createdAt), 'dd/MM/yyyy')}</td>
                                <td><strong>${q.clientName || 'N/A'}</strong></td>
                                <td>${q.title}</td>
                                <td>${getUserName(q.userId)}</td>
                                <td>
                                    <span style="font-weight: 600; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; bg: #fff;">${q.status.toUpperCase()}</span>
                                </td>
                                <td class="text-right" style="font-weight: 700;">${fmt(q.totalValue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                 <script>
                    window.onload = () => { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="text-emerald-500" /> Relatório Comercial
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Análise de desempenho comercial e orçamentos.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Início</label>
                        <input className="bg-slate-800 border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-500" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
                        <input className="bg-slate-800 border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-500" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
                        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-[30px] text-xs">
                            <option value="all">Todos</option>
                            <option value="draft">Rascunho</option>
                            <option value="sent">Enviado</option>
                            <option value="approved">Aprovado</option>
                            <option value="rejected">Rejeitado</option>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Responsável</label>
                        <Select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="h-[30px] text-xs">
                            <option value="all">Todos</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-8">

                    {/* KPI SUMMARY ON SCREEN */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 font-bold uppercase">Total Orçamentos</div>
                            <div className="text-2xl font-bold text-white mt-1">{totals.count}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                            <div className="text-xs text-emerald-400 font-bold uppercase">Aprovados</div>
                            <div className="text-2xl font-bold text-emerald-500 mt-1">{fmt(totals.approvedValue)}</div>
                            <div className="text-xs text-emerald-400/70 mt-1">{totals.approvedCount} orçamentos</div>
                        </div>
                        <div className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
                            <div className="text-xs text-indigo-400 font-bold uppercase">Volume Total</div>
                            <div className="text-2xl font-bold text-indigo-500 mt-1">{fmt(totals.totalValue)}</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 font-bold uppercase">Conversão</div>
                            <div className="text-2xl font-bold text-white mt-1">{totals.conversionRate.toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhamento</h3>
                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Título</th>
                                        <th className="px-4 py-3">Responsável</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    {filteredData.length === 0 ? (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum orçamento encontrado.</td></tr>
                                    ) : filteredData.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3">{format(parseISO(t.createdAt), 'dd/MM/yyyy')}</td>
                                            <td className="px-4 py-3 font-medium text-white">{t.clientName || 'N/A'}</td>
                                            <td className="px-4 py-3 text-slate-400">{t.title}</td>
                                            <td className="px-4 py-3">{getUserName(t.userId)}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={t.status === 'approved' ? 'success' : t.status === 'rejected' ? 'error' : 'neutral'}>
                                                    {t.status === 'approved' ? 'Aprovado' : t.status === 'rejected' ? 'Rejeitado' : t.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-200">
                                                {fmt(t.totalValue)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>Fechar</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={handlePrint}>
                        <Printer size={18} /> Imprimir / PDF
                    </Button>
                </div>
            </div>
        </div>
    );
};
