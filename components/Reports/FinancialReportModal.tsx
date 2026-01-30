import React, { useState, useMemo } from 'react';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, Contact } from '../../types';
import { Button, Select, Badge } from '../Shared';
import { DateRangePicker } from '../DateRangePicker';
import { DateRange } from 'react-day-picker';
import { X, Printer, FileText, Filter, DollarSign, TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '../../utils/formatters';

interface FinancialReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: FinancialTransaction[];
    accounts: FinancialAccount[];
    categories: FinancialCategory[];
    cards: CreditCard[];
    contacts: Contact[];
    initialFilters?: {
        startDate?: string;
        endDate?: string;
        accountId?: string;
    }
}

export const FinancialReportModal: React.FC<FinancialReportModalProps> = ({ isOpen, onClose, transactions, accounts, categories, cards, contacts, initialFilters }) => {
    if (!isOpen) return null;

    // Default Filters
    // Default Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialFilters?.startDate ? parseDateLocal(initialFilters.startDate) : startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
        to: initialFilters?.endDate ? parseDateLocal(initialFilters.endDate) : endOfDay(new Date())
    });
    const [statusFilter, setStatusFilter] = useState('all'); // all, paid, pending, overdue
    const [accountFilter, setAccountFilter] = useState(initialFilters?.accountId || 'all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all'); // all, income, expense
    const [contactFilter, setContactFilter] = useState('all');

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Filter Logic
    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            // Technical filters
            if (t.originType === 'technical' || t.description.includes('Pagamento Fatura (Crédito Local)')) return false;

            if (!dateRange?.from || !dateRange?.to) return false;

            const tDate = parseDateLocal(t.date);
            const start = startOfDay(dateRange.from);
            const end = endOfDay(dateRange.to);
            const inRange = isWithinInterval(tDate, { start, end });

            // Account / Card Filter
            let accountMatch = true;
            if (accountFilter !== 'all') {
                const isCard = cards.some(c => c.id === accountFilter);
                if (isCard) {
                    accountMatch = t.creditCardId === accountFilter;
                } else {
                    accountMatch = t.accountId === accountFilter && !t.creditCardId;
                }
            }

            // Category
            let categoryMatch = true;
            if (categoryFilter !== 'all') {
                categoryMatch = t.categoryId === categoryFilter;
            }

            // Type
            let typeMatch = true;
            if (typeFilter !== 'all') {
                typeMatch = t.type === typeFilter;
            }

            // Contact
            let contactMatch = true;
            if (contactFilter !== 'all') {
                contactMatch = t.contactId === contactFilter;
            }

            // Status
            let statusMatch = true;
            const today = startOfDay(new Date());
            if (statusFilter === 'paid') statusMatch = t.isPaid;
            else if (statusFilter === 'pending') statusMatch = !t.isPaid && !isBefore(tDate, today);
            else if (statusFilter === 'overdue') statusMatch = !t.isPaid && isBefore(tDate, today);

            return inRange && accountMatch && categoryMatch && typeMatch && statusMatch && contactMatch;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange, statusFilter, accountFilter, categoryFilter, typeFilter, contactFilter]);

    // Summary Calculations
    const calculateTotals = () => {
        let incomeReceived = 0;
        let incomeToReceive = 0;
        let expensePaid = 0;
        let expenseToPay = 0;

        let transfersTotal = 0;
        let cardPaymentsTotal = 0;

        filteredData.forEach(t => {
            if (t.type === 'income') {
                if (t.isPaid) incomeReceived += t.amount;
                else incomeToReceive += t.amount;
            } else if (t.type === 'expense') {
                if (t.description.toLowerCase().includes('fatura')) {
                    cardPaymentsTotal += t.amount;
                } else {
                    if (t.isPaid) expensePaid += t.amount;
                    else expenseToPay += t.amount;
                }
            } else if (t.type === 'transfer') {
                transfersTotal += t.amount;
            }
        });

        return {
            incomeReceived,
            incomeToReceive,
            totalIncome: incomeReceived + incomeToReceive,
            expensePaid,
            expenseToPay,
            totalExpense: expensePaid + expenseToPay,
            transfersTotal,
            cardPaymentsTotal,
            result: (incomeReceived + incomeToReceive) - (expensePaid + expenseToPay)
        };
    };

    const totals = calculateTotals();

    // Global Balance
    const currentBalance = useMemo(() => {
        return 0;
    }, [accounts, transactions, accountFilter]);


    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '-';

    // Updated to handle Cards and Transfers logic for display
    const renderAccountInfo = (t: FinancialTransaction) => {
        if (t.type === 'transfer' && t.toAccountId) {
            const source = accounts.find(a => a.id === t.accountId)?.name || '...';
            const dest = accounts.find(a => a.id === t.toAccountId)?.name || '...';
            return (
                <div className="flex items-center gap-1">
                    <span>{source}</span>
                    <TrendingUp size={10} className="rotate-90 text-slate-500" />
                    <span>{dest}</span>
                </div>
            );
        }
        if (t.creditCardId) {
            const card = cards.find(c => c.id === t.creditCardId);
            return card ? `Cartão: ${card.name}` : 'Cartão';
        }
        return accounts.find(a => a.id === t.accountId)?.name || '-';
    };

    // Print
    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório Financeiro - EcoFlow</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #0f172a; max-width: 1200px; margin: 0 auto; }
                    h1 { color: #0f172a; font-size: 24px; margin-bottom: 5px; }
                    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .meta { color: #64748b; font-size: 12px; line-height: 1.5; }
                    
                    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                    .kpi-card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .kpi-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
                    .kpi-value { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 5px; }
                    .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
                    
                    .text-emerald { color: #059669; }
                    .text-rose { color: #e11d48; }
                    .text-blue { color: #2563eb; }
                    .text-yellow { color: #d97706; }
                    
                    .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 30px 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { text-align: left; padding: 8px; background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                    tr:nth-child(even) { background: #f8fafc; }
                    
                    .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; display: inline-block; }
                    
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
                        <h1>Relatório Financeiro</h1>
                        <div class="meta"><strong>EcoFlow Systems</strong></div>
                    </div>
                    <div class="meta text-right">
                        <div><strong>Período:</strong> ${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : '...'} a ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : '...'}</div>
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Filtros:</strong> ${accountFilter !== 'all' ? 'Conta Específica' : 'Todas Contas'} • ${categoryFilter !== 'all' ? 'Categoria Específica' : 'Todas Categorias'} • ${contactFilter !== 'all' ? 'Contato Específico' : 'Todos Contatos'}</div>
                    </div>
                </div>

                <div class="section-title">Detalhamento de Lançamentos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Descrição</th>
                            <th>Categoria</th>
                            <th>Conta</th>
                            <th>Status</th>
                            <th class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(t => {
            const transactionDate = parseDateLocal(t.date);
            let accountDisplay = t.creditCardId
                ? `Cartão: ${cards.find(c => c.id === t.creditCardId)?.name || ''}`
                : accounts.find(a => a.id === t.accountId)?.name || '-';

            if (t.type === 'transfer' && t.toAccountId) {
                const source = accounts.find(a => a.id === t.accountId)?.name || '...';
                const dest = accounts.find(a => a.id === t.toAccountId)?.name || '...';
                accountDisplay = `${source} -> ${dest}`;
            }

            const isCardPayment = t.type === 'expense' && t.description.toLowerCase().includes('fatura');
            const rowClass = t.type === 'transfer' ? 'text-blue' : isCardPayment ? 'text-yellow' : t.type === 'income' ? 'text-emerald' : 'text-rose';

            return `
                            <tr>
                                <td>${format(transactionDate, 'dd/MM/yyyy')}</td>
                                <td>
                                    <strong>${t.description}</strong>
                                    <div style="font-size: 9px; color: #64748b;">${t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : 'Despesa'}</div>
                                </td>
                                <td>${getCategoryName(t.categoryId)}</td>
                                <td>${accountDisplay}</td>
                                <td>
                                    ${t.isPaid
                    ? '<span style="color: #10b981; font-weight: bold;">Realizado</span>'
                    : isBefore(transactionDate, startOfDay(new Date()))
                        ? '<span style="color: #ef4444; font-weight: bold;">Atrasado</span>'
                        : '<span style="color: #f59e0b; font-weight: bold;">Pendente</span>'
                }
                                </td>
                                <td class="text-right">
                                    <span class="${rowClass}" style="font-weight: 700;">
                                        ${t.type === 'expense' || t.type === 'transfer' ? '-' : ''}${fmt(t.amount)}
                                    </span>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 20px;">
                    <div style="display: flex; justify-content: flex-end; gap: 30px;">
                        <div style="text-align: right;">
                            <div style="font-size: 10px; font-weight: 700; color: #3b82f6; text-transform: uppercase;">Transferências</div>
                            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${fmt(totals.transfersTotal)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; font-weight: 700; color: #d97706; text-transform: uppercase;">Pgto. Cartão</div>
                            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${fmt(totals.cardPaymentsTotal)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; font-weight: 700; color: #10b981; text-transform: uppercase;">Total Receitas</div>
                            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${fmt(totals.totalIncome)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; font-weight: 700; color: #f43f5e; text-transform: uppercase;">Total Despesas</div>
                            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${fmt(totals.totalExpense)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Resultado Líquido</div>
                            <div style="font-size: 18px; font-weight: 700; color: ${totals.result >= 0 ? '#10b981' : '#f43f5e'};">${fmt(totals.result)}</div>
                        </div>
                    </div>
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 rounded-t-2xl">
                    <div>
                        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                            <FileText className="text-emerald-500" size={32} /> Relatório Financeiro
                        </h2>
                        <p className="text-slate-400 text-sm mt-2 ml-1">Visão completa e detalhada do fluxo financeiro.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col border-b border-slate-800 bg-slate-950 shadow-inner">
                    <div className="p-5 border-b border-slate-800/50">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Período</label>
                            <DateRangePicker
                                date={dateRange}
                                setDate={setDateRange}
                                className="bg-slate-900 border-slate-700 text-slate-200 max-w-[300px]"
                            />
                        </div>
                    </div>

                    <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Conta/Banco</label>
                            <Select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="h-10 text-sm bg-slate-900 border-slate-700">
                                <option value="all">Todas Contas</option>
                                <optgroup label="Contas Bancárias">
                                    {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </optgroup>
                                <optgroup label="Cartões de Crédito">
                                    {[...cards].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </optgroup>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Categoria</label>
                            <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-10 text-sm bg-slate-900 border-slate-700">
                                <option value="all">Todas</option>
                                {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Cliente/Fornecedor</label>
                            <Select value={contactFilter} onChange={e => setContactFilter(e.target.value)} className="h-10 text-sm bg-slate-900 border-slate-700">
                                <option value="all">Todos</option>
                                {[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Tipo</label>
                            <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-10 text-sm bg-slate-900 border-slate-700">
                                <option value="all">Todos</option>
                                <option value="income">Receitas</option>
                                <option value="expense">Despesas</option>
                                <option value="transfer">Transferências</option>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Status</label>
                            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 text-sm bg-slate-900 border-slate-700">
                                <option value="all">Todos</option>
                                <option value="paid">Realizado</option>
                                <option value="pending">A Vencer</option>
                                <option value="overdue">Atrasado</option>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-8">

                    {/* TABLE */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Detalhamento</h3>
                        <div className="overflow-hidden border border-slate-800 rounded-lg shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 border-b border-slate-800 w-32">Data</th>
                                        <th className="px-6 py-4 border-b border-slate-800">Descrição / Categoria</th>
                                        <th className="px-6 py-4 border-b border-slate-800">Conta / Origem</th>
                                        <th className="px-6 py-4 border-b border-slate-800 text-center w-32">Status</th>
                                        <th className="px-6 py-4 border-b border-slate-800 text-right w-40">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                                    {filteredData.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>
                                    ) : filteredData.map(t => (
                                        <tr key={t.id} className="group hover:bg-slate-800/60 transition-colors odd:bg-transparent even:bg-slate-900/40">
                                            <td className="px-6 py-4 text-slate-400 font-medium align-top pt-5">
                                                {format(parseDateLocal(t.date), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <div className="font-bold text-base text-white mb-1 group-hover:text-emerald-400 transition-colors">{t.description}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                                        {t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : 'Despesa'}
                                                    </span>
                                                    <span className="text-xs text-slate-500">•</span>
                                                    <span className="text-xs text-slate-400">{getCategoryName(t.categoryId)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm align-top pt-5">
                                                {renderAccountInfo(t)}
                                            </td>
                                            <td className="px-6 py-4 text-center align-top pt-5">
                                                <Badge variant={t.isPaid ? 'success' : isBefore(parseDateLocal(t.date), startOfDay(new Date())) ? 'error' : 'warning'} className="px-3 py-1">
                                                    {t.isPaid ? 'Realizado' : isBefore(parseDateLocal(t.date), startOfDay(new Date())) ? 'Atrasado' : 'Pendente'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right align-top pt-5">
                                                <div className={`text-lg font-bold tabular-nums ${t.type === 'transfer' ? 'text-blue-400' :
                                                        (t.type === 'expense' && t.description.toLowerCase().includes('fatura')) ? 'text-yellow-400' :
                                                            t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                                    }`}>
                                                    {t.type === 'expense' || t.type === 'transfer' ? '-' : ''}{fmt(t.amount)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-950 border-t-2 border-slate-800 font-bold text-slate-200">
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-right uppercase text-[10px] tracking-wider text-slate-500">
                                            Resultado Líquido do Período
                                        </td>
                                        <td className={`px-6 py-4 text-right text-lg ${totals.result >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {fmt(totals.result)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer Totals Block */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 border-t border-slate-800 pt-4">
                            <div className="flex justify-between items-center p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                <span className="text-xs font-bold uppercase text-blue-500">Transferências</span>
                                <span className="text-lg font-bold text-blue-400">{fmt(totals.transfersTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                                <span className="text-xs font-bold uppercase text-yellow-500">Pgto. Cartão</span>
                                <span className="text-lg font-bold text-yellow-400">{fmt(totals.cardPaymentsTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                <span className="text-xs font-bold uppercase text-emerald-500">Total Receitas</span>
                                <span className="text-lg font-bold text-emerald-400">{fmt(totals.totalIncome)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                                <span className="text-xs font-bold uppercase text-rose-500">Total Despesas</span>
                                <span className="text-lg font-bold text-rose-400">{fmt(totals.totalExpense)}</span>
                            </div>
                            <div className={`flex justify-between items-center p-3 border rounded-lg ${totals.result >= 0 ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
                                <span className={`text-xs font-bold uppercase ${totals.result >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>Resultado</span>
                                <span className={`text-lg font-bold ${totals.result >= 0 ? 'text-indigo-300' : 'text-rose-300'}`}>{fmt(totals.result)}</span>
                            </div>
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
