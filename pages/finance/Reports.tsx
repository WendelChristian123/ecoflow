
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialTransaction, FinancialCategory } from '../../types';
import { Loader, Card, Button } from '../../components/Shared';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Printer, PieChart as PieChartIcon, Calendar } from 'lucide-react';
import { FilterSelect } from '../../components/FilterSelect';
import { startOfMonth, endOfMonth, isWithinInterval, format, subMonths, parseISO, endOfDay } from 'date-fns';
import { parseDateLocal } from '../../utils/formatters';
import { ptBR } from 'date-fns/locale';

export const FinancialReports: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [filterPeriod, setFilterPeriod] = useState<'current' | 'last' | 'all' | 'custom'>('current');
    const [customDate, setCustomDate] = useState({ start: '', end: '' });

    useEffect(() => {
        Promise.all([api.getFinancialTransactions(), api.getFinancialCategories()])
            .then(([t, c]) => {
                setTransactions(t);
                setCategories(c);
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Loader />;

    // Filter Logic
    const now = new Date();

    // Mandatory Technical Filter
    const baseTransactions = transactions.filter(t =>
        t.originType !== 'technical' &&
        !t.description.includes('Pagamento Fatura (Crédito Local)') &&
        !t.description.includes('Entrada Técnica')
    );

    let filteredTransactions = baseTransactions;

    if (filterPeriod === 'current') {
        filteredTransactions = baseTransactions.filter(t =>
            isWithinInterval(parseDateLocal(t.date), { start: startOfMonth(now), end: endOfMonth(now) })
        );
    } else if (filterPeriod === 'last') {
        const last = subMonths(now, 1);
        filteredTransactions = baseTransactions.filter(t =>
            isWithinInterval(parseDateLocal(t.date), { start: startOfMonth(last), end: endOfMonth(last) })
        );
    } else if (filterPeriod === 'custom' && customDate.start && customDate.end) {
        filteredTransactions = transactions.filter(t =>
            isWithinInterval(parseDateLocal(t.date), {
                start: parseDateLocal(customDate.start),
                end: endOfDay(parseDateLocal(customDate.end))
            })
        );
    }

    // Chart 1 Data: Income vs Expense
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const barData = [
        { name: 'Receitas', value: income },
        { name: 'Despesas', value: expense }
    ];

    // Chart 2 Data: Expense by Category
    const pieData = categories
        .filter(c => c.type === 'expense')
        .map(cat => {
            const val = filteredTransactions
                .filter(t => t.categoryId === cat.id && t.type === 'expense')
                .reduce((s, t) => s + t.amount, 0);
            return { name: cat.name, value: val, color: cat.color || '#94a3b8' };
        })
        .filter(d => d.value > 0); // Hide empty

    const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#6366f1', '#8b5cf6'];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2 print:p-0">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <PieChartIcon className="text-emerald-500" /> Relatórios
                </h1>

                <div className="flex items-center gap-2">
                    <FilterSelect
                        label="PERÍODO"
                        value={filterPeriod}
                        onChange={(val) => setFilterPeriod(val as any)}
                        options={[
                            { value: 'current', label: 'Este Mês' },
                            { value: 'last', label: 'Mês Passado' },
                            { value: 'custom', label: 'Personalizado' },
                            { value: 'all', label: 'Todo o Período' }
                        ]}
                        className="w-48"
                        icon={<Calendar size={14} />}
                        placeholder="Período"
                    />
                    {filterPeriod === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            <input
                                type="date"
                                className="bg-card border border-input rounded-lg px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                                value={customDate.start}
                                onChange={e => setCustomDate({ ...customDate, start: e.target.value })}
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                className="bg-card border border-input rounded-lg px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                                value={customDate.end}
                                onChange={e => setCustomDate({ ...customDate, end: e.target.value })}
                            />
                        </div>
                    )}
                    <Button variant="secondary" onClick={handlePrint} className="gap-2">
                        <Printer size={16} /> Imprimir
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <Card className="min-h-[400px] flex flex-col min-w-0" variant="solid">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Receitas x Despesas</h3>
                    {filteredTransactions.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">Sem dados no período.</div>
                    ) : (
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="99%" height="100%">
                                <BarChart data={barData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-xs" tickLine={false} axisLine={false} />
                                    <YAxis stroke="currentColor" className="text-muted-foreground text-xs" tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)', borderRadius: '8px' }}
                                        formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                        cursor={{ fill: 'var(--muted)' }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {barData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Receitas' ? '#10b981' : '#f43f5e'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>

                {/* Pie Chart */}
                <Card className="min-h-[400px] flex flex-col min-w-0" variant="solid">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Despesas por Categoria</h3>
                    {pieData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">Sem despesas categorizadas no período.</div>
                    ) : (
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="99%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)', borderRadius: '8px' }}
                                        formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>
            </div>

            <div className="text-center text-xs text-slate-500 mt-4">
                Relatório gerado em {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
        </div>
    );
};
