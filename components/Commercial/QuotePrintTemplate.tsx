
import React from 'react';
import { Quote, Company } from '../../types';
import { format } from 'date-fns';

interface QuotePrintTemplateProps {
    quote: Quote;
    company: Company; // Used for Company Info
    contact?: { name: string; document?: string; address?: string; email?: string; phone?: string }; // Enriched contact info
}

export const QuotePrintTemplate: React.FC<QuotePrintTemplateProps> = ({ quote, company, contact }) => {
    return (
        <div className="print:block bg-white text-slate-900 p-8 font-sans max-w-[210mm] mx-auto min-h-[297mm] relative shadow-2xl print:shadow-none" id="quote-print-template">
            {/* Header - Changed to Grid for Print Safety */}
            <div className="grid grid-cols-2 gap-8 border-b-2 border-slate-800 pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tighter mb-2">{company.name}</h1>
                    <div className="text-sm text-slate-600 space-y-0.5">
                        {company.cnpj && <p>CNPJ: {company.cnpj}</p>}
                        {company.phone && <p>Tel: {company.phone}</p>}
                        {company.ownerEmail && <p>Email: {company.ownerEmail}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-light text-slate-400">ORÇAMENTO</h2>
                    <p className="text-xl font-bold text-slate-900">#{quote.id.slice(0, 8).toUpperCase()}</p>
                    <div className="mt-4 text-sm">
                        <p><span className="font-semibold">Data:</span> {format(new Date(quote.date), 'dd/MM/yyyy')}</p>
                        {quote.validUntil && <p><span className="font-semibold">Válido até:</span> {format(new Date(quote.validUntil), 'dd/MM/yyyy')}</p>}
                    </div>
                </div>
            </div>

            {/* Client Info */}
            <section className="mb-10 bg-slate-50 p-6 rounded-lg border border-slate-200 print:bg-slate-50 print:border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Dados do Cliente</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-lg font-bold text-slate-900">{customerName(quote, contact)}</p>
                        {contact?.document && <p className="text-sm text-slate-600">CPF/CNPJ: {contact.document}</p>}
                    </div>
                    <div className="text-sm text-slate-600">
                        {contact?.email && <p>{contact.email}</p>}
                        {customerPhone(quote, contact) && <p>{customerPhone(quote, contact)}</p>}
                        {contact?.address && <p>{contact.address}</p>}
                    </div>
                </div>
            </section>

            {/* Items Table */}
            <section className="mb-8">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600">
                            <th className="py-3 pr-4">Descrição</th>
                            <th className="py-3 px-4 text-center w-24">Qtd</th>
                            <th className="py-3 px-4 text-right w-32">Unitário</th>
                            <th className="py-3 pl-4 text-right w-32">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {(quote.items || []).map((item, idx) => (
                            <tr key={idx} className="text-sm text-slate-800">
                                <td className="py-3 pr-4 font-medium">{item.description}</td>
                                <td className="py-3 px-4 text-center text-slate-600">{item.quantity}</td>
                                <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(item.unitPrice || 0)}</td>
                                <td className="py-3 pl-4 text-right font-bold">{formatCurrency(item.total || 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-800">
                        <tr>
                            <td colSpan={3} className="pt-4 text-right font-bold uppercase text-xs text-slate-500">Subtotal</td>
                            <td className="pt-4 text-right font-bold text-slate-900">{formatCurrency(quote.totalValue)}</td>
                        </tr>
                        <tr className="text-xl">
                            <td colSpan={3} className="pt-4 text-right font-black uppercase text-slate-900">Total Final</td>
                            <td className="pt-4 text-right font-black text-emerald-600">{formatCurrency(quote.totalValue)}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>

            {/* Notes / Terms */}
            {quote.notes && (
                <section className="mb-12">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Observações / Termos</h3>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded border border-slate-200 print:bg-slate-50">
                        {quote.notes}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="absolute bottom-8 left-8 right-8 text-center border-t border-slate-200 pt-6">
                <p className="text-xs text-slate-400">
                    Documento gerado eletronicamente em {format(new Date(), 'dd/MM/yyyy HH:mm')} por {company.name}.
                </p>
            </footer>
        </div>
    );
};

// Helpers
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const customerName = (q: Quote, c?: any) => c?.name || q.customerName || 'Cliente Consumidor';
const customerPhone = (q: Quote, c?: any) => c?.phone || q.customerPhone || '';
