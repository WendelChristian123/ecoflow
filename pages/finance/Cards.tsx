
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CreditCard, FinancialTransaction } from '../../types';
import { Loader, Card, ProgressBar, cn, Button } from '../../components/Shared';
import { DrilldownModal, CardModal, ConfirmationModal } from '../../components/Modals';
import { CreditCard as CardIcon, Calendar, Plus, Trash2, Edit2 } from 'lucide-react';

export const FinancialCards: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    
    const [drilldownState, setDrilldownState] = useState<{isOpen: boolean, title: string, data: any[]}>({ isOpen: false, title: '', data: [] });
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [c, t] = await Promise.all([api.getCreditCards(), api.getFinancialTransactions()]);
            setCards(c);
            setTransactions(t);
        } catch (error) {
            console.error(error);
        } finally { setLoading(false); }
    };

    const getCardStats = (cardId: string, limit: number) => {
        // Assume pending expenses linked to card count as "used limit" for MVP
        const used = transactions
            .filter(t => t.creditCardId === cardId && t.type === 'expense' && !t.isPaid)
            .reduce((s, t) => s + t.amount, 0);
        
        return { used, available: limit - used, percent: Math.min(100, (used / limit) * 100) };
    };

    const handleCreate = () => {
        setEditingCard(undefined);
        setIsCardModalOpen(true);
    }

    const handleEdit = (e: React.MouseEvent, card: CreditCard) => {
        e.stopPropagation();
        setEditingCard(card);
        setIsCardModalOpen(true);
    }

    const requestDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    }

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            await api.deleteCreditCard(confirmDeleteId);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Não foi possível excluir o cartão. Verifique se existem lançamentos vinculados a ele.");
        }
    }

    if (loading) return <Loader />;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <CardIcon className="text-emerald-500" /> Cartões de Crédito
                </h1>
                <Button className="gap-2" onClick={handleCreate}>
                    <Plus size={16} /> Novo Cartão
                </Button>
            </div>

            {cards.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-700 rounded-xl">
                    <div className="bg-slate-800 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                        <CardIcon size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-300">Nenhum cartão encontrado</h3>
                    <p className="text-slate-500">Cadastre seus cartões para acompanhar limites e faturas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map(card => {
                        const { used, available, percent } = getCardStats(card.id, card.limitAmount);
                        return (
                            <Card 
                                key={card.id} 
                                onClick={() => setDrilldownState({ isOpen: true, title: `Lançamentos: ${card.name}`, data: transactions.filter(t => t.creditCardId === card.id) })}
                                className="cursor-pointer hover:border-emerald-500/30 transition-all bg-gradient-to-br from-slate-800 to-slate-900 group relative"
                            >
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => handleEdit(e, card)} className="text-slate-400 hover:text-white">
                                        <Edit2 size={16}/>
                                    </button>
                                    <button onClick={(e) => requestDelete(e, card.id)} className="text-slate-400 hover:text-rose-500">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-700 rounded-lg text-slate-300">
                                            <CardIcon size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{card.name}</h3>
                                            <p className="text-xs text-slate-500">Crédito</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase">Limite Total</div>
                                        <div className="font-mono text-slate-300">{fmt(card.limitAmount)}</div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-rose-400">Em uso: {fmt(used)}</span>
                                        <span className="text-emerald-400">Disponível: {fmt(available)}</span>
                                    </div>
                                    <ProgressBar progress={percent} />
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-slate-700/50 text-xs text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={12} />
                                        <span>Fecha dia {card.closingDay}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={12} />
                                        <span>Vence dia {card.dueDay}</span>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

             <DrilldownModal 
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState({...drilldownState, isOpen: false})}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
            />

            <CardModal 
                isOpen={isCardModalOpen}
                onClose={() => setIsCardModalOpen(false)}
                onSuccess={loadData}
                initialData={editingCard}
            />

            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Excluir Cartão" />
        </div>
    );
};
