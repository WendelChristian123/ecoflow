
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialAccount, FinancialTransaction } from '../../types';
import { Loader, Card, Badge, cn, Button } from '../../components/Shared';
import { DrilldownModal, AccountModal, ConfirmationModal } from '../../components/Modals';
import { Wallet, Building2, Landmark, DollarSign, Plus, Trash2, Edit2 } from 'lucide-react';

export const FinancialAccounts: React.FC = () => {
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

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [acc, trans] = await Promise.all([api.getFinancialAccounts(), api.getFinancialTransactions()]);
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

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Wallet className="text-emerald-500" /> Contas & Bancos
                </h1>
                <Button className="gap-2" onClick={handleCreate}>
                    <Plus size={16} /> Nova Conta
                </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-sm font-medium uppercase">Total de Contas</span>
                        <div className="text-3xl font-bold text-white mt-1">{accounts.length}</div>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg text-slate-400"><Landmark size={24} /></div>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-sm font-medium uppercase">Saldo Total Consolidado</span>
                        <div className="text-3xl font-bold text-emerald-400 mt-1">{fmt(totalBalance)}</div>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg text-emerald-400"><DollarSign size={24} /></div>
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
                                <h3 className="text-lg font-semibold text-white mb-1">{acc.name}</h3>
                                <p className="text-sm text-slate-500 capitalize">{acc.type === 'checking' ? 'Conta Corrente' : acc.type === 'savings' ? 'Poupança' : acc.type === 'investment' ? 'Investimento' : 'Caixa'}</p>
                            </div>

                            <div className="pt-4 border-t border-slate-700/50 flex justify-between items-end">
                                <span className="text-xs text-slate-500">Saldo Atual</span>
                                <span className="text-xl font-bold text-slate-200">{fmt(balance)}</span>
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
