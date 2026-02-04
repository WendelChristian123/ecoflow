import React, { useState, useMemo } from 'react';
import { Contact } from '../../types';
import { Button, Badge } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { X, Printer, User, Building, Users } from 'lucide-react';
import { format } from 'date-fns';

interface ContactsReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    contacts: Contact[];
}

export const ContactsReportModal: React.FC<ContactsReportModalProps> = ({ isOpen, onClose, contacts }) => {
    if (!isOpen) return null;

    const [typeFilter, setTypeFilter] = useState('all');

    const filteredData = useMemo(() => {
        return contacts.filter(c => {
            if (typeFilter === 'all') return true;
            if (typeFilter === 'client') return c.scope === 'client' || c.scope === 'both';
            if (typeFilter === 'supplier') return c.scope === 'supplier' || c.scope === 'both';
            return true;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [contacts, typeFilter]);

    const calculateTotals = () => {
        const total = filteredData.length;
        const clients = filteredData.filter(c => c.scope === 'client' || c.scope === 'both').length;
        const suppliers = filteredData.filter(c => c.scope === 'supplier' || c.scope === 'both').length;
        return { total, clients, suppliers };
    };

    const totals = calculateTotals();

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Contatos - EcoFlow</title>
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
                    @media print { body { padding: 0; } button { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div><h1>Relatório de Contatos</h1><div class="meta"><strong>EcoFlow Systems</strong></div></div>
                    <div class="meta" style="text-align: right;">
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Filtro:</strong> ${typeFilter === 'all' ? 'Todos' : typeFilter === 'client' ? 'Clientes' : 'Fornecedores'}</div>
                    </div>
                </div>

                <div class="section-title">Resumo</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
                     <div style="background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Listado</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${totals.total}</div>
                     </div>
                     <div style="background: #f0fdf4; padding: 15px; border: 1px solid #dcfce7; border-radius: 8px;">
                        <div style="font-size: 10px; color: #15803d; text-transform: uppercase; font-weight: 700;">Clientes</div>
                        <div style="font-size: 20px; font-weight: 700; color: #166534;">${totals.clients}</div>
                     </div>
                     <div style="background: #eff6ff; padding: 15px; border: 1px solid #dbeafe; border-radius: 8px;">
                         <div style="font-size: 10px; color: #1d4ed8; text-transform: uppercase; font-weight: 700;">Fornecedores</div>
                         <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${totals.suppliers}</div>
                     </div>
                </div>

                <div class="section-title">Lista de Contatos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Tipo</th>
                            <th>Telefone</th>
                            <th>Email</th>
                            <th>Perfil</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(c => `
                            <tr>
                                <td><strong>${c.name}</strong><br/><span style="color:#64748b; font-size:10px;">${c.fantasyName || ''}</span></td>
                                <td>${c.type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</td>
                                <td>${c.phone || '-'}</td>
                                <td>${c.email || '-'}</td>
                                <td><span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">${c.scope === 'both' ? 'AMBOS' : c.scope === 'client' ? 'CLIENTE' : 'FORNECEDOR'}</span></td>
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
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="text-emerald-500" /> Relatório de Contatos</h2>
                        <p className="text-slate-400 text-sm mt-1">Listagem geral de clientes e fornecedores.</p>
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
                                { value: 'customer', label: 'Clientes' },
                                { value: 'supplier', label: 'Fornecedores' },
                                { value: 'partner', label: 'Parceiros' },
                                { value: 'lead', label: 'Leads' }
                            ]}
                            darkMode={true}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 font-bold uppercase">Total Listado</div>
                            <div className="text-2xl font-bold text-white mt-1">{totals.total}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                            <div className="text-xs text-emerald-400 font-bold uppercase">Clientes</div>
                            <div className="text-2xl font-bold text-emerald-500 mt-1">{totals.clients}</div>
                        </div>
                        <div className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
                            <div className="text-xs text-indigo-400 font-bold uppercase">Fornecedores</div>
                            <div className="text-2xl font-bold text-indigo-500 mt-1">{totals.suppliers}</div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhamento</h3>
                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Nome</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Contato</th>
                                        <th className="px-4 py-3">Perfil</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    {filteredData.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{c.name}</div>
                                                <div className="text-[10px] text-slate-500">{c.fantasyName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400">{c.type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</td>
                                            <td className="px-4 py-3">
                                                <div>{c.phone}</div>
                                                <div className="text-slate-500 text-[10px]">{c.email}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={c.scope === 'client' ? 'success' : c.scope === 'supplier' ? 'default' : 'neutral'}>
                                                    {c.scope === 'both' ? 'Ambos' : c.scope === 'client' ? 'Cliente' : 'Fornecedor'}
                                                </Badge>
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
