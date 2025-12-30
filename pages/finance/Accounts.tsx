
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
    const [drilldownState, setDrilldownState] = useState<{isOpen: boolean, title: string, data: any[]}>({ isOpen: false, title: '', data: [] });
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

    const getAccountBalance = (accountId: string, initialBalance: number) => {
        const accTrans = transactions.filter(t => t.accountId === accountId && t.isPaid);
        const income = accTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = accTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return initialBalance + income - expense;
    };

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
    const totalBalance = accounts.reduce((sum, acc) => sum + getAccountBalance(acc.id, acc.initialBalance), 0);

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
                    <div className="p-3 bg-slate-700/50 rounded-lg text-slate-400"><Landmark size={24}/></div>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-sm font-medium uppercase">Saldo Total Consolidado</span>
                        <div className="text-3xl font-bold text-emerald-400 mt-1">{fmt(totalBalance)}</div>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg text-emerald-400"><DollarSign size={24}/></div>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {accounts.map(acc => {
                    const balance = getAccountBalance(acc.id, acc.initialBalance);
                    return (
                        <Card 
                            key={acc.id} 
                            onClick={() => {
                                const accountTransactions = transactions.filter(t => t.accountId === acc.id);
                                setDrilldownState({ isOpen: true, title: `Lançamentos: ${acc.name}`, data: accountTransactions });
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
                onClose={() => setDrilldownState({...drilldownState, isOpen: false})}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
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
