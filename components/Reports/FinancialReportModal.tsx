import React, { useState, useMemo } from 'react';
import { FinancialTransaction, FinancialAccount, FinancialCategory } from '../../types';
import { Button, Select, Badge } from '../Shared';
import { X, Printer, FileText, Filter, DollarSign, TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: FinancialTransaction[];
    accounts: FinancialAccount[];
    categories: FinancialCategory[];
}

export const FinancialReportModal: React.FC<FinancialReportModalProps> = ({ isOpen, onClose, transactions, accounts, categories }) => {
    if (!isOpen) return null;

    // Default Filters
    const [startDate, setStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('all'); // all, paid, pending, overdue
    const [accountFilter, setAccountFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all'); // all, income, expense

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Filter Logic
    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            // Technical filters
            if (t.originType === 'technical' || t.description.includes('Pagamento Fatura (Crédito Local)')) return false;

            const tDate = parseISO(t.date);
            const start = startOfDay(parseISO(startDate));
            const end = endOfDay(parseISO(endDate));
            const inRange = isWithinInterval(tDate, { start, end });

            // Account
            let accountMatch = true;
            if (accountFilter !== 'all') {
                accountMatch = t.accountId === accountFilter;
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

            // Status
            let statusMatch = true;
            const today = startOfDay(new Date());
            if (statusFilter === 'paid') statusMatch = t.isPaid;
            else if (statusFilter === 'pending') statusMatch = !t.isPaid && !isBefore(tDate, today);
            else if (statusFilter === 'overdue') statusMatch = !t.isPaid && isBefore(tDate, today);

            return inRange && accountMatch && categoryMatch && typeMatch && statusMatch;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, startDate, endDate, statusFilter, accountFilter, categoryFilter, typeFilter]);

    // Summary Calculations
    const calculateTotals = () => {
        let incomeReceived = 0;
        let incomeToReceive = 0;
        let expensePaid = 0;
        let expenseToPay = 0;

        filteredData.forEach(t => {
            if (t.type === 'income') {
                if (t.isPaid) incomeReceived += t.amount;
                else incomeToReceive += t.amount;
            } else if (t.type === 'expense') {
                if (t.isPaid) expensePaid += t.amount;
                else expenseToPay += t.amount;
            }
        });

        return {
            incomeReceived,
            incomeToReceive,
            totalIncome: incomeReceived + incomeToReceive,
            expensePaid,
            expenseToPay,
            totalExpense: expensePaid + expenseToPay,
            result: (incomeReceived + incomeToReceive) - (expensePaid + expenseToPay)
        };
    };

    const totals = calculateTotals();

    // Global Balance (Sum of filtered accounts current balance logic is tricky because transactions history defines balance. 
    // Simplified: Sum of all accounts active in filter, if 'all' then all accounts.)
    // Better approach requested: "Soma de todas as contas filtradas".
    // If account filter is active, show that account's logic balance? Or just the Current Balance from the state passed?
    // Let's use the `accounts` prop. If filtered, sum only that one.
    const currentBalance = useMemo(() => {
        const targetAccounts = accountFilter === 'all' ? accounts : accounts.filter(a => a.id === accountFilter);
        // We need to calculate balance based on ALL transactions ever for these accounts, not just the filtered period range.
        // But the prompt says "Soma de todas as contas filtradas".
        // Let's emulate the Overview logic:
        return targetAccounts.reduce((acc, account) => {
            const accountIncome = transactions.filter(t => t.accountId === account.id && t.type === 'income' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            const accountExpense = transactions.filter(t => t.accountId === account.id && t.type === 'expense' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            const trOut = transactions.filter(t => t.accountId === account.id && t.type === 'transfer' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            const trIn = transactions.filter(t => t.toAccountId === account.id && t.type === 'transfer' && t.isPaid).reduce((s, t) => s + t.amount, 0);
            return acc + account.initialBalance + accountIncome - accountExpense - trOut + trIn;
        }, 0);
    }, [accounts, transactions, accountFilter]);

    // Alerts Logic (Using filteredData or All Data? "Bloco dedicado a riscos e pendências". Usually this is about NOW, independent of the date filter. 
    // BUT user says "Os dados devem refletir exatamente os valores da Visão Geral" AND "Filtros disponíveis... Qualquer alteração deve atualizar o relatório". 
    // HOWEVER, alerts like "Overdue" are global states. 
    // Let's stick to the convention: Alerts usually look at the whole picture or the filtered context? 
    // Given usage, let's look at the FILTERED context if possible, BUT "Overdue" implies relative to Today.
    // If I filter for last year, "Overdue" doesn't make sense unless it was overdue back then? No.
    // Let's apply filters to the dataset BUT keeping the "Overdue" definition relative to Today.

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '-';
    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '-';

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
                    
                    .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 30px 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    
                    .alerts-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                    .alert-card { padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
                    .alert-card.danger { background: #fff1f2; border-color: #fecdd3; }
                    .alert-card.warn { background: #fffbeb; border-color: #fde68a; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { text-align: left; padding: 8px; background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                    tr:nth-child(even) { background: #f8fafc; }
                    
                    .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; display: inline-block; }
                    .badge-income { background: #d1fae5; color: #065f46; }
                    .badge-expense { background: #ffe4e6; color: #9f1239; }
                    
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
                        <div><strong>Período:</strong> ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}</div>
                        <div><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                        <div><strong>Filtros:</strong> ${accountFilter !== 'all' ? 'Conta Específica' : 'Todas Contas'} • ${categoryFilter !== 'all' ? 'Categoria Específica' : 'Todas Categorias'}</div>
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
                            <th>Vencimento</th>
                            <th class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(t => `
                            <tr>
                                <td>${format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                                <td>
                                    <strong>${t.description}</strong>
                                    <div style="font-size: 9px; color: #64748b;">${t.type === 'income' ? 'Receita' : 'Despesa'}</div>
                                </td>
                                <td>${getCategoryName(t.categoryId)}</td>
                                <td>${getAccountName(t.accountId)}</td>
                                <td>
                                    ${t.isPaid
                ? '<span style="color: #10b981; font-weight: bold;">Realizado</span>'
                : isBefore(parseISO(t.date), startOfDay(new Date()))
                    ? '<span style="color: #ef4444; font-weight: bold;">Atrasado</span>'
                    : '<span style="color: #f59e0b; font-weight: bold;">Pendente</span>'
            }
                                </td>
                                <td>${format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                                <td class="text-right">
                                    <span class="${t.type === 'income' ? 'text-emerald' : 'text-rose'}" style="font-weight: 700;">
                                        ${t.type === 'expense' ? '-' : ''}${fmt(t.amount)}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 20px;">
                    <div style="display: flex; justify-content: flex-end; gap: 30px;">
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
                <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="text-emerald-500" /> Relatório Financeiro
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Visão completa e detalhada do fluxo financeiro.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-800 grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Início</label>
                        <input className="bg-slate-800 border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-500" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
                        <input className="bg-slate-800 border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-500" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Conta/Banco</label>
                        <Select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="h-[30px] text-xs">
                            <option value="all">Todas Contas</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Categoria</label>
                        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-[30px] text-xs">
                            <option value="all">Todas</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Tipo</label>
                        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-[30px] text-xs">
                            <option value="all">Todos</option>
                            <option value="income">Receitas</option>
                            <option value="expense">Despesas</option>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
                        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-[30px] text-xs">
                            <option value="all">Todos</option>
                            <option value="paid">Realizado</option>
                            <option value="pending">A Vencer</option>
                            <option value="overdue">Atrasado</option>
                        </Select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-8">

                    {/* TABLE */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhamento</h3>
                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Descrição</th>
                                        <th className="px-4 py-3">Categoria</th>
                                        <th className="px-4 py-3">Conta</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    {filteredData.length === 0 ? (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>
                                    ) : filteredData.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{t.description}</div>
                                                <div className="text-[10px] text-slate-500">{t.type === 'income' ? 'Receita' : 'Despesa'}</div>
                                            </td>
                                            <td className="px-4 py-3">{getCategoryName(t.categoryId)}</td>
                                            <td className="px-4 py-3">{getAccountName(t.accountId)}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={t.isPaid ? 'success' : isBefore(parseISO(t.date), startOfDay(new Date())) ? 'error' : 'warning'}>
                                                    {t.isPaid ? 'Realizado' : isBefore(parseISO(t.date), startOfDay(new Date())) ? 'Atrasado' : 'Pendente'}
                                                </Badge>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {t.type === 'expense' ? '-' : ''}{fmt(t.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900 border-t-2 border-slate-700 font-bold text-slate-200">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-4 text-right uppercase text-[10px] tracking-wider text-slate-400">
                                            Resumo do Relatório
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {/* Totals Summary in Footer */}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer Totals Block */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800 pt-4">
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
