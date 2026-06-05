
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialAccount, FinancialTransaction } from '../../types';
import { Loader, Card, Badge, cn, Button } from '../../components/Shared';
import { DrilldownModal, AccountModal, ConfirmationModal } from '../../components/Modals';
import { Wallet, Building2, Landmark, DollarSign, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAppEnvironment } from '../../context/AppEnvironmentContext';
import { useNavigate } from 'react-router-dom';

export const FinancialAccounts: React.FC = () => {
    const { currentCompany } = useCompany();
    const { isApp } = useAppEnvironment();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

    // Modals
    const [drilldownState, setDrilldownState] = useState<{
        isOpen: boolean,
        title: string,
        data: any[],
        summary?: { initialBalance: number, totalIncome: number, totalExpense: number, finalBalance: number }
    }>({ isOpen: false, title: '', data: [] });
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<FinancialAccount | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (currentCompany) {
            loadData();
        }
    }, [currentCompany]);

    const loadData = async () => {
        if (!currentCompany) return;
        setLoading(true);
        try {
            const [acc, trans] = await Promise.all([
                api.getFinancialAccounts(currentCompany.id),
                api.getFinancialTransactions(currentCompany.id)
            ]);
            setAccounts(acc);
            setTransactions(trans);
        } catch (error) {
            console.error(error);
        } finally { setLoading(false); }
    };

    // Optimized Balance Calculation (O(T) instead of O(A*T))
    const accountBalances = React.useMemo(() => {
        const balances: Record<string, number> = {};

        // Initialize with initial balances
        accounts.forEach(acc => {
            balances[acc.id] = acc.initialBalance;
        });

        // Single pass through transactions
        transactions.forEach(t => {
            if (!t.isPaid) return;

            // Handle Source Account (Income, Expense, Transfer Out)
            if (t.accountId && balances[t.accountId] !== undefined) {
                if (t.type === 'income') balances[t.accountId] += t.amount;
                if (t.type === 'expense') balances[t.accountId] -= t.amount;
                if (t.type === 'transfer') balances[t.accountId] -= t.amount;
            }

            // Handle Implied Destination (Transfer In)
            if (t.type === 'transfer' && t.toAccountId && balances[t.toAccountId] !== undefined) {
                balances[t.toAccountId] += t.amount;
            }
        });

        return balances;
    }, [accounts, transactions]);

    const getAccountBalance = (accountId: string) => accountBalances[accountId] || 0;

    const handleCreate = () => { setEditingAccount(undefined); setIsAccountModalOpen(true); };

    const handleEdit = (e: React.MouseEvent, account: FinancialAccount) => {
        e.stopPropagation();
        setEditingAccount(account);
        setIsAccountModalOpen(true);
    };

    const requestDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    }

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            await api.deleteFinancialAccount(confirmDeleteId);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Não foi possível excluir a conta. Verifique se existem transações vinculadas a ela.");
        }
    }

    if (loading) return <Loader />;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const totalBalance = accounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);

    // === MOBILE LAYOUT ===
    if (isApp) {
        return (
            <div className="flex-1 flex flex-col bg-background text-foreground relative pb-20">
                {/* Header Compacto */}
                <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground"><ChevronLeft size={20} /></button>
                    <h1 className="text-base font-bold text-foreground">Contas & Bancos</h1>
                    <button onClick={handleCreate} className="p-2 -mr-2 text-primary"><Plus size={20} /></button>
                </div>

                {/* Resumo */}
                <div className="p-4 bg-primary/5 border-b border-primary/10">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saldo Consolidado</span>
                        <span className="text-[10px] font-medium text-muted-foreground">{accounts.length} contas</span>
                    </div>
                    <div className="text-3xl font-black text-foreground tracking-tighter">{fmt(totalBalance)}</div>
                </div>

                {/* Lista de Contas */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {accounts.map(acc => {
                        const balance = getAccountBalance(acc.id);
                        return (
                            <div key={acc.id} onClick={(e) => handleEdit(e, acc)} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground text-sm">{acc.name}</div>
                                        <div className="text-[10px] text-muted-foreground capitalize">{acc.type === 'checking' ? 'Corrente' : acc.type === 'savings' ? 'Poupança' : acc.type === 'investment' ? 'Investimento' : 'Caixa'}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-foreground text-sm">{fmt(balance)}</div>
                                    <Badge variant="success" className="text-[9px] py-0 mt-1">Ativa</Badge>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <AccountModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onSuccess={loadData} initialData={editingAccount} />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-4 pb-8 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-foreground dark:text-white flex items-center gap-2">
                    <Wallet className="text-emerald-500" size={20} /> Contas & Bancos
                </h1>
                <Button className="gap-1.5 h-7 px-3 text-[10px]" onClick={handleCreate}>
                    <Plus size={14} /> Nova Conta
                </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-secondary/50 dark:bg-slate-800 p-6 rounded-xl border border-border dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <span className="text-muted-foreground dark:text-slate-400 text-sm font-medium uppercase">Total de Contas</span>
                        <div className="text-3xl font-bold text-foreground dark:text-white mt-1">{accounts.length}</div>
                    </div>
                    <div className="p-3 bg-secondary dark:bg-slate-700/50 rounded-lg text-muted-foreground dark:text-slate-400"><Landmark size={24} /></div>
                </div>
                <div className="bg-secondary/50 dark:bg-slate-800 p-6 rounded-xl border border-border dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <span className="text-muted-foreground dark:text-slate-400 text-sm font-medium uppercase">Saldo Total Consolidado</span>
                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalBalance)}</div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 dark:bg-slate-700/50 rounded-lg text-emerald-600 dark:text-emerald-400"><DollarSign size={24} /></div>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {accounts.map(acc => {
                    const balance = getAccountBalance(acc.id);
                    return (
                        <Card
                            key={acc.id}
                            onClick={() => {
                                const accountTransactions = transactions.filter(t =>
                                    (t.accountId === acc.id || (t.type === 'transfer' && t.toAccountId === acc.id))
                                );

                                // Calculate Drilldown Summary
                                let income = 0;
                                let expense = 0;
                                accountTransactions.forEach(t => {
                                    if (!t.isPaid) return;
                                    // Income: Type income on account OR Transfer IN to account
                                    if (t.accountId === acc.id && t.type === 'income') income += t.amount;
                                    if (t.toAccountId === acc.id && t.type === 'transfer') income += t.amount;

                                    // Expense: Type expense on account OR Transfer OUT from account
                                    if (t.accountId === acc.id && t.type === 'expense') expense += t.amount;
                                    if (t.accountId === acc.id && t.type === 'transfer') expense += t.amount;
                                });

                                setDrilldownState({
                                    isOpen: true,
                                    title: `Lançamentos: ${acc.name}`,
                                    data: accountTransactions,
                                    summary: {
                                        initialBalance: acc.initialBalance,
                                        totalIncome: income,
                                        totalExpense: expense,
                                        finalBalance: balance
                                    }
                                });
                            }}
                            className="flex flex-col justify-between cursor-pointer hover:border-emerald-500/30 transition-all min-h-[160px] group relative"
                        >
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button onClick={(e) => handleEdit(e, acc)} className="text-slate-600 hover:text-white transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={(e) => requestDelete(e, acc.id)} className="text-slate-600 hover:text-rose-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex justify-between items-start">
                                <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Building2 size={24} />
                                </div>
                                <Badge variant="success">Ativa</Badge>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-foreground dark:text-white mb-1">{acc.name}</h3>
                                <p className="text-sm text-muted-foreground capitalize">{acc.type === 'checking' ? 'Conta Corrente' : acc.type === 'savings' ? 'Poupança' : acc.type === 'investment' ? 'Investimento' : 'Caixa'}</p>
                            </div>

                            <div className="pt-4 border-t border-border dark:border-slate-700/50 flex justify-between items-end">
                                <span className="text-xs text-muted-foreground">Saldo Atual</span>
                                <span className="text-xl font-bold text-foreground dark:text-slate-200">{fmt(balance)}</span>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <DrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState({ ...drilldownState, isOpen: false })}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
                accountSummary={drilldownState.summary}
                users={[]}
                onPayAction={(item) => {
                    navigate(`/finance/cards?payInvoice=${item.id}`);
                }}
            />

            <AccountModal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                onSuccess={loadData}
                initialData={editingAccount}
            />

            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Excluir Conta" />
        </div>
    );
};
