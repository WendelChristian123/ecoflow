
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, FinanceFilters, Contact } from '../../types';
import { Loader, Card, Badge, cn, Button, Select, ProgressBar } from '../../components/Shared';
import { DrilldownModal, TransactionModal } from '../../components/Modals';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, DollarSign, ArrowRight, Filter, Plus, CreditCard as CardIcon, Calendar, ThumbsUp, ThumbsDown, BarChart2 } from 'lucide-react';
import { isBefore, startOfDay, endOfDay, addDays, isWithinInterval, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate';
    subtitle?: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const colors = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
        <div 
            onClick={onClick}
            className={cn(
                "bg-slate-800 border border-slate-700/50 p-6 rounded-xl transition-all relative overflow-hidden group flex flex-col justify-between h-full",
                onClick && "cursor-pointer hover:bg-slate-700/50 hover:border-slate-600"
            )}
        >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">{title}</span>
                <div className={cn("p-2 rounded-lg", colors[color])}>{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="text-2xl font-bold text-white tracking-tight">{fmt(value)}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
            </div>
            {onClick && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={18} className="text-slate-400" />
                </div>
            )}
        </div>
    );
};

export const FinancialOverview: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);

    // Filters
    const [filters, setFilters] = useState<FinanceFilters & { status: string }>({
        period: 'month',
        accountId: 'all',
        categoryId: 'all',
        type: 'all',
        status: 'all'
    });

    // Modals
    const [modalState, setModalState] = useState<{isOpen: boolean, title: string, data: any[]}>({
        isOpen: false, title: '', data: []
    });
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [t, a, c, cc, cont] = await Promise.all([
                api.getFinancialTransactions(),
                api.getFinancialAccounts(),
                api.getFinancialCategories(),
                api.getCreditCards(),
                api.getContacts()
            ]);
            setTransactions(t);
            setAccounts(a);
            setCategories(c);
            setCards(cc);
            setContacts(cont);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const getFilteredTransactions = () => {
        let filtered = transactions;
        const now = new Date();
        const todayStart = startOfDay(now);

        // Period
        if(filters.period === 'today') {
            filtered = filtered.filter(t => t.date === now.toISOString().split('T')[0]);
        } else if (filters.period === 'last7') {
            const last7 = addDays(now, -7);
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), { start: last7, end: now }));
        } else if (filters.period === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            filtered = filtered.filter(t => isWithinInterval(parseISO(t.date), { start: firstDay, end: lastDay }));
        }

        // Account
        if(filters.accountId !== 'all') {
            filtered = filtered.filter(t => t.accountId === filters.accountId);
        }

        // Category
        if(filters.categoryId !== 'all') {
            filtered = filtered.filter(t => t.categoryId === filters.categoryId);
        }

        // Type
        if(filters.type !== 'all') {
            filtered = filtered.filter(t => t.type === filters.type);
        }

        // Status (Novo)
        if (filters.status === 'overdue') {
            filtered = filtered.filter(t => !t.isPaid && isBefore(parseISO(t.date), todayStart));
        } else if (filters.status === 'pending') {
            filtered = filtered.filter(t => !t.isPaid && !isBefore(parseISO(t.date), todayStart));
        } else if (filters.status === 'paid') {
            filtered = filtered.filter(t => t.isPaid);
        }

        return filtered;
    };

    const handleToggleStatus = async (e: React.MouseEvent, t: FinancialTransaction) => {
        e.stopPropagation();
        const newStatus = !t.isPaid;
        setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isPaid: newStatus } : item));
        try {
            await api.toggleTransactionStatus(t.id, newStatus);
        } catch (error) {
             setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isPaid: !newStatus } : item));
        }
    }

    const filteredData = getFilteredTransactions();
    const todayStart = startOfDay(new Date());
    const next7DaysEnd = endOfDay(addDays(new Date(), 7));

    // Stats
    const totalIncome = filteredData.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = filteredData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const result = totalIncome - totalExpense;
    
    // Helper para Cartões
    const getCardInvoice = (cardId: string) => {
        return transactions
            .filter(t => t.creditCardId === cardId && t.type === 'expense' && !t.isPaid)
            .reduce((acc, t) => acc + t.amount, 0);
    };

    const currentBalance = accounts.reduce((acc, a) => acc + a.initialBalance, 0) + 
                           transactions.filter(t => t.isPaid && t.type === 'income').reduce((s,t)=>s+t.amount, 0) -
                           transactions.filter(t => t.isPaid && t.type === 'expense').reduce((s,t)=>s+t.amount, 0);

    const openDrilldown = (title: string, filterFn: (t: FinancialTransaction) => boolean) => {
        const data = filteredData.filter(filterFn);
        setModalState({ isOpen: true, title, data });
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Evolution Comparison Logic
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthIncome = transactions.filter(t => t.type === 'income' && isWithinInterval(parseISO(t.date), {start: thisMonthStart, end: thisMonthEnd})).reduce((s,t) => s+t.amount, 0);
    const thisMonthExpense = transactions.filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), {start: thisMonthStart, end: thisMonthEnd})).reduce((s,t) => s+t.amount, 0);
    
    const lastMonthIncome = transactions.filter(t => t.type === 'income' && isWithinInterval(parseISO(t.date), {start: lastMonthStart, end: lastMonthEnd})).reduce((s,t) => s+t.amount, 0);
    const lastMonthExpense = transactions.filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), {start: lastMonthStart, end: lastMonthEnd})).reduce((s,t) => s+t.amount, 0);

    const comparisonData = [
        { name: 'Mês Anterior', Receitas: lastMonthIncome, Despesas: lastMonthExpense },
        { name: 'Mês Atual', Receitas: thisMonthIncome, Despesas: thisMonthExpense }
    ];

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <DollarSign className="text-emerald-500" /> Visão Geral
                </h1>
                <Button className="gap-2" onClick={() => setIsTransactionModalOpen(true)}>
                    <Plus size={16}/> Novo Lançamento
                </Button>
            </div>

            {/* FILTERS - GRID LAYOUT */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-center">
                <div className="flex items-center gap-2 text-slate-400 text-sm pl-1">
                    <Filter size={16}/> <span className="uppercase font-semibold text-xs">Filtros:</span>
                </div>
                <Select value={filters.period} onChange={e => setFilters({...filters, period: e.target.value as any})} className="py-1.5 text-xs">
                    <option value="today">Hoje</option>
                    <option value="last7">7 Dias</option>
                    <option value="month">Este Mês</option>
                    <option value="all">Todo o Período</option>
                </Select>
                <Select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="py-1.5 text-xs">
                    <option value="all">Todos Status</option>
                    <option value="overdue">Vencidos</option>
                    <option value="pending">A Vencer</option>
                    <option value="paid">Pagos</option>
                </Select>
                <Select value={filters.accountId} onChange={e => setFilters({...filters, accountId: e.target.value})} className="py-1.5 text-xs">
                    <option value="all">Todas Contas</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
                <Select value={filters.categoryId} onChange={e => setFilters({...filters, categoryId: e.target.value})} className="py-1.5 text-xs">
                    <option value="all">Todas Categ.</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                 <Select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value as any})} className="py-1.5 text-xs">
                    <option value="all">Todos Tipos</option>
                    <option value="income">Receitas</option>
                    <option value="expense">Despesas</option>
                </Select>
            </div>

            {/* BLOCO 1 - RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Saldo Atual" 
                    value={currentBalance} 
                    icon={<Wallet size={20} />} 
                    color="slate"
                />
                <StatCard 
                    title="Receitas" 
                    value={totalIncome} 
                    icon={<TrendingUp size={20} />} 
                    color="emerald"
                    onClick={() => openDrilldown('Receitas do Período', t => t.type === 'income')}
                />
                <StatCard 
                    title="Despesas" 
                    value={totalExpense} 
                    icon={<TrendingDown size={20} />} 
                    color="rose"
                    onClick={() => openDrilldown('Despesas do Período', t => t.type === 'expense')}
                />
                <StatCard 
                    title="Resultado" 
                    value={result} 
                    icon={<DollarSign size={20} />} 
                    color={result >= 0 ? 'indigo' : 'amber'}
                />
            </div>

            {/* BLOCO 2 - SITUAÇÃO */}
            <div>
                <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-slate-400"/> Situação Financeira
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Vencidas" 
                        value={filteredData.filter(t => t.type === 'expense' && !t.isPaid && isBefore(parseISO(t.date), todayStart)).reduce((s,t) => s+t.amount, 0)} 
                        icon={<AlertCircle size={20} />} 
                        color="rose"
                        subtitle="Contas em atraso"
                        onClick={() => openDrilldown('Contas Vencidas', t => t.type === 'expense' && !t.isPaid && isBefore(parseISO(t.date), todayStart))}
                    />
                     <StatCard 
                        title="A Vencer (7d)" 
                        value={filteredData.filter(t => t.type === 'expense' && !t.isPaid && isWithinInterval(parseISO(t.date), { start: todayStart, end: next7DaysEnd })).reduce((s,t)=>s+t.amount,0)} 
                        icon={<Clock size={20} />} 
                        color="amber"
                        subtitle="Próximos pagamentos"
                        onClick={() => openDrilldown('A Pagar em 7 dias', t => t.type === 'expense' && !t.isPaid && isWithinInterval(parseISO(t.date), { start: todayStart, end: next7DaysEnd }))}
                    />
                     <StatCard 
                        title="A Receber Vencidas" 
                        value={filteredData.filter(t => t.type === 'income' && !t.isPaid && isBefore(parseISO(t.date), todayStart)).reduce((s,t)=>s+t.amount,0)} 
                        icon={<AlertCircle size={20} />} 
                        color="rose"
                        subtitle="Em atraso"
                        onClick={() => openDrilldown('Receitas Vencidas', t => t.type === 'income' && !t.isPaid && isBefore(parseISO(t.date), todayStart))}
                    />
                     <StatCard 
                        title="A Receber (7d)" 
                        value={filteredData.filter(t => t.type === 'income' && !t.isPaid && isWithinInterval(parseISO(t.date), { start: todayStart, end: next7DaysEnd })).reduce((s,t)=>s+t.amount,0)} 
                        icon={<Clock size={20} />} 
                        color="indigo"
                        subtitle="Entradas previstas"
                        onClick={() => openDrilldown('A Receber em 7 dias', t => t.type === 'income' && !t.isPaid && isWithinInterval(parseISO(t.date), { start: todayStart, end: next7DaysEnd }))}
                    />
                </div>
            </div>

            {/* BLOCO 3 - CARTÕES DE CRÉDITO */}
            {cards.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <CardIcon size={18} className="text-slate-400"/> Cartões de Crédito
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cards.map(card => {
                            const invoice = getCardInvoice(card.id);
                            const available = card.limitAmount - invoice;
                            const percent = Math.min(100, (invoice / card.limitAmount) * 100);

                            return (
                                <div key={card.id} 
                                     onClick={() => openDrilldown(`Fatura: ${card.name}`, t => t.creditCardId === card.id && !t.isPaid)}
                                     className="bg-slate-800 border border-slate-700/50 p-5 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-all"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-700 rounded-lg text-slate-300">
                                                <CardIcon size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">{card.name}</h3>
                                                <p className="text-xs text-slate-500">Limite: {fmt(card.limitAmount)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500 uppercase">Fatura Atual</div>
                                            <div className="font-mono text-slate-200 font-bold">{fmt(invoice)}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-rose-400">Usado: {Math.round(percent)}%</span>
                                            <span className="text-emerald-400">Disp: {fmt(available)}</span>
                                        </div>
                                        <ProgressBar progress={percent} />
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} /> Fecha: {card.closingDay}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} /> Vence: {card.dueDay}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* BLOCO 4 - ÚLTIMOS LANÇAMENTOS (FULL WIDTH) */}
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Últimos Lançamentos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredData.slice(0, 6).map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3 truncate">
                                <div className={cn("p-2 rounded-full shrink-0", t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                                    {t.type === 'income' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                                </div>
                                <div className="truncate">
                                    <div className="font-medium text-slate-200 truncate">{t.description}</div>
                                    <div className="text-xs text-slate-500">{t.date}</div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end pl-2">
                                <div className={cn("font-bold", t.type === 'income' ? 'text-emerald-400' : 'text-rose-400')}>
                                    {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                                </div>
                                <button 
                                    onClick={(e) => handleToggleStatus(e, t)}
                                    className={cn(
                                        "mt-1 p-1 rounded transition-colors",
                                        t.isPaid ? "text-emerald-500" : "text-slate-500 hover:text-emerald-500"
                                    )}
                                    title={t.isPaid ? "Pago" : "Pendente"}
                                >
                                    {t.isPaid ? <ThumbsUp size={14} className="fill-emerald-500/10" /> : <ThumbsDown size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredData.length === 0 && <p className="text-slate-500 text-sm col-span-full text-center py-4">Nenhum lançamento.</p>}
                </div>
            </div>

            {/* BLOCO 5 - EVOLUÇÃO (COMPARAÇÃO MENSAL) */}
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <BarChart2 className="text-indigo-500" /> Evolução: Mês Anterior vs Atual
                    </h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Legenda Numérica */}
                    <div className="space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <span className="text-sm text-slate-400 uppercase font-bold tracking-wide">Receitas</span>
                            <div className="mt-2 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Mês Passado:</span>
                                    <span className="text-slate-300">{fmt(lastMonthIncome)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-emerald-500">Atual:</span>
                                    <span className="text-white">{fmt(thisMonthIncome)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <span className="text-sm text-slate-400 uppercase font-bold tracking-wide">Despesas</span>
                            <div className="mt-2 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Mês Passado:</span>
                                    <span className="text-slate-300">{fmt(lastMonthExpense)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-rose-500">Atual:</span>
                                    <span className="text-white">{fmt(thisMonthExpense)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="lg:col-span-2 h-[300px] w-full min-w-0">
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    formatter={(value: number) => fmt(value)}
                                />
                                <Legend />
                                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <DrilldownModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({...modalState, isOpen: false})}
                title={modalState.title}
                type="finance"
                data={modalState.data}
            />

            <TransactionModal 
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                onSuccess={loadData}
                accounts={accounts}
                categories={categories}
                cards={cards}
                contacts={contacts}
            />
        </div>
    );
};
