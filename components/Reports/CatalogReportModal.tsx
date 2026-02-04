import React, { useState, useMemo } from 'react';
import { CatalogItem } from '../../types';
import { Button, Badge } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { X, Printer, ShoppingBag, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { translateCatalogType } from '../../utils/i18n';

interface CatalogReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: CatalogItem[];
}

export const CatalogReportModal: React.FC<CatalogReportModalProps> = ({ isOpen, onClose, items }) => {
    if (!isOpen) return null;

    const [typeFilter, setTypeFilter] = useState('all');

    const filteredData = useMemo(() => {
        return items.filter(i => {
            if (typeFilter === 'all') return true;
            return i.type === typeFilter;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [items, typeFilter]);

    const calculateTotals = () => {
        const totalItems = filteredData.length;
        const products = filteredData.filter(i => i.type === 'product').length;
        const services = filteredData.filter(i => i.type === 'service').length;
        const avgPrice = totalItems > 0 ? filteredData.reduce((acc, i) => acc + i.price, 0) / totalItems : 0;
        return { totalItems, products, services, avgPrice };
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
                <title>Relatório do Catálogo - EcoFlow</title>
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
                    <div><h1>Relatório de Catálogo</h1><div class="meta"><strong>EcoFlow Systems</strong></div></div>
                    <div class="meta" style="text-align: right;">
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Filtro:</strong> ${typeFilter === 'all' ? 'Todos' : typeFilter === 'product' ? 'Produtos' : 'Serviços'}</div>
                    </div>
                </div>

                <div class="section-title">Resumo do Catálogo</div>
                 <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
                     <div style="background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Itens</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${totals.totalItems}</div>
                     </div>
                     <div style="background: #eff6ff; padding: 15px; border: 1px solid #dbeafe; border-radius: 8px;">
                        <div style="font-size: 10px; color: #1d4ed8; text-transform: uppercase; font-weight: 700;">Produtos</div>
                        <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${totals.products}</div>
                     </div>
                     <div style="background: #f0fdf4; padding: 15px; border: 1px solid #dcfce7; border-radius: 8px;">
                        <div style="font-size: 10px; color: #15803d; text-transform: uppercase; font-weight: 700;">Serviços</div>
                        <div style="font-size: 20px; font-weight: 700; color: #166534;">${totals.services}</div>
                     </div>
                     <div style="background: #fff7ed; padding: 15px; border: 1px solid #ffedd5; border-radius: 8px;">
                        <div style="font-size: 10px; color: #c2410c; text-transform: uppercase; font-weight: 700;">Preço Médio</div>
                        <div style="font-size: 20px; font-weight: 700; color: #9a3412;">${fmt(totals.avgPrice)}</div>
                     </div>
                </div>

                <div class="section-title">Detalhamento dos Itens</div>
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Descrição</th>
                            <th>Tipo</th>
                            <th>Status</th>
                            <th class="text-right">Preço</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(i => `
                            <tr>
                                <td><strong>${i.name}</strong></td>
                                <td>${i.description || '-'}</td>
                                <td>${translateCatalogType(i.type).toUpperCase()}</td>
                                <td><span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; color: ${i.active ? '#15803d' : '#94a3b8'};">${i.active ? 'ATIVO' : 'INATIVO'}</span></td>
                                <td class="text-right" style="font-weight: 700;">${fmt(i.price)}</td>
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-[95vw] lg:max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingBag className="text-emerald-500" /> Relatório de Catálogo</h2>
                        <p className="text-slate-400 text-sm mt-1">Listagem de produtos e serviços disponíveis.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                </div>

                <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                    <div className="flex flex-col gap-1 w-48">
                        <FilterSelect
                            inlineLabel="Tipo:"
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={[
                                { value: 'all', label: 'Todos' },
                                { value: 'product', label: 'Produtos' },
                                { value: 'service', label: 'Serviços' },
                                { value: 'combo', label: 'Combos' },
                                { value: 'package', label: 'Pacotes' }
                            ]}
                            darkMode={true}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 font-bold uppercase">Total Itens</div>
                            <div className="text-2xl font-bold text-white mt-1">{totals.totalItems}</div>
                        </div>
                        <div className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
                            <div className="text-xs text-indigo-400 font-bold uppercase">Produtos</div>
                            <div className="text-2xl font-bold text-indigo-500 mt-1">{totals.products}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                            <div className="text-xs text-emerald-400 font-bold uppercase">Serviços</div>
                            <div className="text-2xl font-bold text-emerald-500 mt-1">{totals.services}</div>
                        </div>
                        <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/20">
                            <div className="text-xs text-orange-400 font-bold uppercase">Preço Médio</div>
                            <div className="text-2xl font-bold text-orange-500 mt-1">{fmt(totals.avgPrice)}</div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhamento</h3>
                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Nome</th>
                                        <th className="px-4 py-3">Descrição</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Preço</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    {filteredData.map(i => (
                                        <tr key={i.id} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3 font-medium text-white">{i.name}</td>
                                            <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{i.description || '-'}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={i.type === 'service' ? 'purple' : 'blue'}>
                                                    {i.type === 'service' ? 'Serviço' : 'Produto'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={i.active ? 'success' : 'neutral'}>
                                                    {i.active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-200">
                                                {fmt(i.price)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>Fechar</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={handlePrint}>
                        <Printer size={18} /> Imprimir / PDF
                    </Button>
                </div>
            </div>
        </div>
    );
};
