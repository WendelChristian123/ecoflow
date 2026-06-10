import React, { useMemo } from 'react';
import { Button } from '../Shared';
import { X, Printer, Landmark, FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';

interface LoansReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    loans: any[];
}

export const LoansReportModal: React.FC<LoansReportModalProps> = ({ isOpen, onClose, loans }) => {
    if (!isOpen) return null;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const totals = useMemo(() => {
        let totalPayable = 0;
        let totalReceivable = 0;
        let totalPaidPayable = 0;
        let totalPaidReceivable = 0;
        let remainingPayable = 0;
        let remainingReceivable = 0;

        loans.forEach(l => {
            if (l.type === 'payable') {
                totalPayable += l.totalAmount;
                totalPaidPayable += l.totalPaid;
                remainingPayable += l.remainingAmount;
            } else {
                totalReceivable += l.totalAmount;
                totalPaidReceivable += l.totalPaid;
                remainingReceivable += l.remainingAmount;
            }
        });

        return {
            totalPayable,
            totalReceivable,
            totalPaidPayable,
            totalPaidReceivable,
            remainingPayable,
            remainingReceivable
        };
    }, [loans]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Dívidas e Empréstimos - Contazze</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #0f172a; max-width: 1200px; margin: 0 auto; }
                    h1 { color: #0f172a; font-size: 24px; margin-bottom: 5px; }
                    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .meta { color: #64748b; font-size: 12px; line-height: 1.5; }
                    
                    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
                    .kpi-card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .kpi-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
                    .kpi-value { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 5px; }
                    
                    .text-emerald { color: #059669; }
                    .text-rose { color: #e11d48; }
                    
                    .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 30px 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { text-align: left; padding: 8px; background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                    tr:nth-child(even) { background: #f8fafc; }
                    
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="/modo-claro.svg" alt="Contazze" style="height: 50px;" />
                </div>
                <div class="header">
                    <div>
                        <h1>Relatório de Dívidas e Empréstimos</h1>
                        <div class="meta"><strong style="color: #10b981;">Contazze</strong></div>
                    </div>
                    <div class="meta text-right">
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Total de Registros:</strong> ${loans.length}</div>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-title text-rose">Total Dívidas (A Pagar)</div>
                        <div class="kpi-value">${fmt(totals.totalPayable)}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Restante: <strong style="color: #e11d48;">${fmt(totals.remainingPayable)}</strong></div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title text-emerald">Total Empréstimos (A Receber)</div>
                        <div class="kpi-value">${fmt(totals.totalReceivable)}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Restante: <strong style="color: #059669;">${fmt(totals.remainingReceivable)}</strong></div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title" style="color: #3b82f6;">Saldo Restante Líquido</div>
                        <div class="kpi-value" style="color: ${totals.remainingReceivable - totals.remainingPayable >= 0 ? '#059669' : '#e11d48'};">${fmt(totals.remainingReceivable - totals.remainingPayable)}</div>
                    </div>
                </div>

                <div class="section-title">Detalhamento por Contrato</div>
                <table>
                    <thead>
                        <tr>
                            <th>Contrato</th>
                            <th>Parte</th>
                            <th class="text-center">Tipo</th>
                            <th class="text-center">Parcelas</th>
                            <th class="text-right">Capital</th>
                            <th class="text-right">Juros</th>
                            <th class="text-right">Valor Total</th>
                            <th class="text-right">Valor Pago</th>
                            <th class="text-right">Resta Pagar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${loans.map(l => {
                            const isPayable = l.type === 'payable';
                            const rowClass = isPayable ? 'text-rose' : 'text-emerald';
                            return `
                                <tr>
                                    <td>
                                        <strong>${l.name}</strong>
                                        <div style="font-size: 9px; color: #64748b;">Início: ${l.firstDueDate ? format(new Date(l.firstDueDate), 'dd/MM/yyyy') : '-'}</div>
                                    </td>
                                    <td>${l.contact?.name || 'Não informado'}</td>
                                    <td class="text-center">
                                        <span style="font-weight: bold; color: ${isPayable ? '#e11d48' : '#059669'}">${isPayable ? 'Dívida' : 'Empréstimo'}</span>
                                    </td>
                                    <td class="text-center">
                                        ${l.paidInstallmentsCount} / ${l.installmentsCount}
                                    </td>
                                    <td class="text-right">${fmt(l.principalAmount)}</td>
                                    <td class="text-right">${fmt(l.interestAmount)}</td>
                                    <td class="text-right font-bold ${rowClass}">${fmt(l.totalAmount)}</td>
                                    <td class="text-right" style="color: #3b82f6; font-weight: bold;">${fmt(l.totalPaid)}</td>
                                    <td class="text-right" style="color: #d97706; font-weight: bold;">${fmt(l.remainingAmount)}</td>
                                </tr>
                            `;
                        }).join('')}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <FileText className="text-emerald-500" size={24} /> Relatório de Dívidas
                        </h2>
                        <p className="text-slate-400 text-sm mt-2 ml-1">Exporte a visão completa dos contratos.</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors">
                        <X size={24} />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <p className="text-slate-300">
                        Este relatório irá gerar um documento formatado para impressão contendo todos os <strong>{loans.length}</strong> contratos listados atualmente na tela (aplicando os filtros selecionados).
                    </p>
                    <p className="text-slate-300">
                        O relatório incluirá:
                    </p>
                    <ul className="list-disc pl-5 text-slate-400 space-y-1 text-sm">
                        <li>Totais de Dívidas e Empréstimos</li>
                        <li>Detalhamento por Contrato (Capital, Juros, Total)</li>
                        <li>Andamento dos Pagamentos (Parcelas pagas, Valor Pago e Restante)</li>
                    </ul>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => { handlePrint(); onClose(); }}>
                        <Printer size={18} /> Gerar Relatório
                    </Button>
                </div>
            </div>
        </div>
    );
};
