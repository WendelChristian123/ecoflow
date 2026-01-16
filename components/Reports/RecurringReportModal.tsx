import React, { useState, useMemo } from 'react';
import { RecurringService } from '../../types';
import { Button, Select, Badge } from '../Shared';
import { X, Printer, RefreshCw, Calendar, DollarSign } from 'lucide-react';
import { format, parseISO, addMonths } from 'date-fns';
import { translateFrequency } from '../../utils/i18n';

interface RecurringReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    services: RecurringService[];
}

export const RecurringReportModal: React.FC<RecurringReportModalProps> = ({ isOpen, onClose, services }) => {
    if (!isOpen) return null;

    const [statusFilter, setStatusFilter] = useState('all');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [endFilterStart, setEndFilterStart] = useState('');
    const [endFilterEnd, setEndFilterEnd] = useState('');

    const filteredData = useMemo(() => {
        return services.filter(s => {
            // 1. Filter by Status
            if (statusFilter === 'active' && !s.active) return false;
            if (statusFilter === 'inactive' && s.active) return false;

            // 2. Filter by Start Date
            if (dateStart && s.startDate < dateStart) return false;
            if (dateEnd && s.startDate > dateEnd) return false;

            // 3. Filter by End Date
            if (endFilterStart || endFilterEnd) {
                const contractEndDate = s.contractMonths ? addMonths(parseISO(s.startDate), s.contractMonths) : null;
                const endDateStr = contractEndDate ? format(contractEndDate, 'yyyy-MM-dd') : null;

                if (!endDateStr) return false; // Exclude indeterminate contracts if filtering by end date
                if (endFilterStart && endDateStr < endFilterStart) return false;
                if (endFilterEnd && endDateStr > endFilterEnd) return false;
            }

            return true;
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()); // Sort by Date Ascending
    }, [services, statusFilter, dateStart, dateEnd, endFilterStart, endFilterEnd]);

    const calculateTotals = () => {
        const totalContracts = filteredData.length;
        const totalMRR = filteredData.reduce((acc, s) => acc + s.recurringAmount, 0);
        const activeContracts = filteredData.filter(s => s.active).length;
        const avgTicket = totalContracts > 0 ? totalMRR / totalContracts : 0;
        return { totalContracts, totalMRR, activeContracts, avgTicket };
    };

    const totals = calculateTotals();
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Contratos - EcoFlow</title>
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
                    @media print { body { padding: 0; } button { display: none; } }
                </style>
            </head>
            <body>
                 <div class="header">
                    <div><h1>Relatório de Contratos</h1><div class="meta"><strong>EcoFlow Systems</strong></div></div>
                    <div class="meta" style="text-align: right;">
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Filtro:</strong> ${statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Ativos' : 'Inativos'}</div>
                        <div><strong>Início Contrato:</strong> ${dateStart ? format(parseISO(dateStart), 'dd/MM/yyyy') : 'Início'} até ${dateEnd ? format(parseISO(dateEnd), 'dd/MM/yyyy') : 'Fim'}</div>
                        <div><strong>Fim Contrato:</strong> ${endFilterStart ? format(parseISO(endFilterStart), 'dd/MM/yyyy') : 'Início'} até ${endFilterEnd ? format(parseISO(endFilterEnd), 'dd/MM/yyyy') : 'Fim'}</div>
                    </div>
                </div>

                <div class="section-title">Resumo Financeiro (MRR)</div>
                 <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
                     <div style="background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Contratos</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${totals.totalContracts}</div>
                     </div>
                     <div style="background: #eff6ff; padding: 15px; border: 1px solid #dbeafe; border-radius: 8px;">
                        <div style="font-size: 10px; color: #1d4ed8; text-transform: uppercase; font-weight: 700;">Receita Mensal (MRR)</div>
                        <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${fmt(totals.totalMRR)}</div>
                     </div>
                     <div style="background: #f0fdf4; padding: 15px; border: 1px solid #dcfce7; border-radius: 8px;">
                        <div style="font-size: 10px; color: #15803d; text-transform: uppercase; font-weight: 700;">Contratos Ativos</div>
                        <div style="font-size: 20px; font-weight: 700; color: #166534;">${totals.activeContracts}</div>
                     </div>
                     <div style="background: #fff7ed; padding: 15px; border: 1px solid #ffedd5; border-radius: 8px;">
                        <div style="font-size: 10px; color: #c2410c; text-transform: uppercase; font-weight: 700;">Ticket Médio</div>
                        <div style="font-size: 20px; font-weight: 700; color: #9a3412;">${fmt(totals.avgTicket)}</div>
                     </div>
                </div>

                <div class="section-title">Detalhamento dos Contratos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Início</th>
                            <th>Fim</th>
                            <th>Frequência</th>
                            <th>Status</th>
                            <th class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(s => `
                            <tr>
                                <td><strong>${s.contactName || s.contact?.name || '---'}</strong><br/><span style="color:#64748b; font-size:10px;">${s.description}</span></td>
                                <td>${s.startDate ? format(parseISO(s.startDate), 'dd/MM/yyyy') : '-'}</td>
                                <td>${s.startDate && s.contractMonths ? format(addMonths(parseISO(s.startDate), s.contractMonths), 'dd/MM/yyyy') : '-'}</td>
                                <td>${translateFrequency(s.frequency).toUpperCase()}</td>
                                <td><span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; color: ${s.active ? '#15803d' : '#94a3b8'};">${s.active ? 'ATIVO' : 'INATIVO'}</span></td>
                                <td class="text-right" style="font-weight: 700;">${fmt(s.recurringAmount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                 <script>window.onload = () => { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><RefreshCw className="text-emerald-500" /> Relatório de Contratos</h2>
                        <p className="text-slate-400 text-sm mt-1">Análise de receita recorrente e status de contratos.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                </div>

                <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex items-end gap-3">
                    <div className="flex flex-col gap-1 w-48">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar Status</label>
                        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-[34px] text-xs">
                            <option value="all">Todos</option>
                            <option value="active">Somente Ativos</option>
                            <option value="inactive">Somente Inativos</option>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1 w-40">
                        <label className="text-[10px] font-bold uppercase text-slate-500">De (Início)</label>
                        <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-[34px] bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1 w-40">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Até (Início)</label>
                        <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-[34px] bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                </div>
                <div className="p-4 bg-slate-900/50 border-b border-t border-slate-800 flex items-end gap-3">
                    <div className="flex flex-col gap-1 w-48">
                        <span className="text-xs text-slate-400 italic">Filtro por Data de Fim:</span>
                    </div>
                    <div className="flex flex-col gap-1 w-40">
                        <label className="text-[10px] font-bold uppercase text-slate-500">De (Fim)</label>
                        <input type="date" value={endFilterStart} onChange={e => setEndFilterStart(e.target.value)} className="h-[34px] bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1 w-40">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Até (Fim)</label>
                        <input type="date" value={endFilterEnd} onChange={e => setEndFilterEnd(e.target.value)} className="h-[34px] bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 font-bold uppercase">Total Contratos</div>
                            <div className="text-2xl font-bold text-white mt-1">{totals.totalContracts}</div>
                        </div>
                        <div className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
                            <div className="text-xs text-indigo-400 font-bold uppercase">Receita Mensal (MRR)</div>
                            <div className="text-2xl font-bold text-indigo-500 mt-1">{fmt(totals.totalMRR)}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                            <div className="text-xs text-emerald-400 font-bold uppercase">Ativos</div>
                            <div className="text-2xl font-bold text-emerald-500 mt-1">{totals.activeContracts}</div>
                        </div>
                        <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/20">
                            <div className="text-xs text-orange-400 font-bold uppercase">Ticket Médio</div>
                            <div className="text-2xl font-bold text-orange-500 mt-1">{fmt(totals.avgTicket)}</div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Listagem de Contratos</h3>
                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Início</th>
                                        <th className="px-4 py-3">Fim (Previsto)</th>
                                        <th className="px-4 py-3">Frequência</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    {filteredData.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{s.contactName || s.contact?.name || '---'}</div>
                                                <div className="text-[10px] text-slate-500">{s.description}</div>
                                            </td>
                                            <td className="px-4 py-3">{s.startDate ? format(parseISO(s.startDate), 'dd/MM/yyyy') : '-'}</td>
                                            <td className="px-4 py-3">{s.startDate && s.contractMonths ? format(addMonths(parseISO(s.startDate), s.contractMonths), 'dd/MM/yyyy') : 'Indeterminado'}</td>
                                            <td className="px-4 py-3 capitalize">{translateFrequency(s.frequency)}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={s.active ? 'success' : 'neutral'}>
                                                    {s.active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-200">
                                                {fmt(s.recurringAmount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

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
