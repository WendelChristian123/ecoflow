
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialCategory, FinancialTransaction } from '../../types';
import { Loader, Badge, Button } from '../../components/Shared';
import { DrilldownModal, CategoryModal, ConfirmationModal } from '../../components/Modals';
import { Tags, ArrowUpCircle, ArrowDownCircle, Plus, Trash2, Edit2, ChevronRight } from 'lucide-react';

export const FinancialCategories: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    
    // Modals
    const [drilldownState, setDrilldownState] = useState<{isOpen: boolean, title: string, data: any[]}>({ isOpen: false, title: '', data: [] });
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<FinancialCategory | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cats, trans] = await Promise.all([api.getFinancialCategories(), api.getFinancialTransactions()]);
            setCategories(cats);
            setTransactions(trans);
        } catch (error) {
            console.error(error);
        } finally { setLoading(false); }
    };

    const getCategoryTotal = (catId: string) => {
        return transactions.filter(t => t.categoryId === catId).reduce((sum, t) => sum + t.amount, 0);
    };

    const handleCreate = () => {
        setEditingCategory(undefined);
        setIsCategoryModalOpen(true);
    }

    const handleEdit = (e: React.MouseEvent, category: FinancialCategory) => {
        e.stopPropagation();
        setEditingCategory(category);
        setIsCategoryModalOpen(true);
    }

    const requestDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    }

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            await api.deleteFinancialCategory(confirmDeleteId);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Não foi possível excluir a categoria. Verifique se existem transações vinculadas a ela.");
        }
    }

    if (loading) return <Loader />;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    
    const incomeCats = categories.filter(c => c.type === 'income');
    const expenseCats = categories.filter(c => c.type === 'expense');

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-8 pb-10 pr-2">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Tags className="text-emerald-500" /> Categorias
                </h1>
                <Button className="gap-2" onClick={handleCreate}>
                    <Plus size={16} /> Nova Categoria
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Income Column */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-800 p-6">
                    <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 pb-4 border-b border-slate-700/50">
                        <ArrowUpCircle size={18} className="text-emerald-400"/> Receitas
                    </h2>
                    <div className="space-y-3">
                        {incomeCats.map(cat => (
                            <div 
                                key={cat.id} 
                                onClick={() => setDrilldownState({ isOpen: true, title: cat.name, data: transactions.filter(t => t.categoryId === cat.id) })}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-700/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color || '#10b981' }}></div>
                                    <span className="font-medium text-slate-200">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-300 text-sm">{fmt(getCategoryTotal(cat.id))}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleEdit(e, cat)} className="text-slate-500 hover:text-white p-1"><Edit2 size={14}/></button>
                                        <button onClick={(e) => requestDelete(e, cat.id)} className="text-slate-500 hover:text-rose-500 p-1"><Trash2 size={14}/></button>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600" />
                                </div>
                            </div>
                        ))}
                        {incomeCats.length === 0 && <p className="text-slate-500 text-sm italic text-center py-4">Nenhuma categoria cadastrada.</p>}
                    </div>
                </div>

                {/* Expense Column */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-800 p-6">
                    <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 pb-4 border-b border-slate-700/50">
                        <ArrowDownCircle size={18} className="text-rose-400"/> Despesas
                    </h2>
                    <div className="space-y-3">
                        {expenseCats.map(cat => (
                            <div 
                                key={cat.id} 
                                onClick={() => setDrilldownState({ isOpen: true, title: cat.name, data: transactions.filter(t => t.categoryId === cat.id) })}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-rose-500/50 hover:bg-slate-700/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color || '#f43f5e' }}></div>
                                    <span className="font-medium text-slate-200">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-300 text-sm">{fmt(getCategoryTotal(cat.id))}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleEdit(e, cat)} className="text-slate-500 hover:text-white p-1"><Edit2 size={14}/></button>
                                        <button onClick={(e) => requestDelete(e, cat.id)} className="text-slate-500 hover:text-rose-500 p-1"><Trash2 size={14}/></button>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600" />
                                </div>
                            </div>
                        ))}
                        {expenseCats.length === 0 && <p className="text-slate-500 text-sm italic text-center py-4">Nenhuma categoria cadastrada.</p>}
                    </div>
                </div>
            </div>

            <DrilldownModal 
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState({...drilldownState, isOpen: false})}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
            />

            <CategoryModal 
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onSuccess={loadData}
                initialData={editingCategory}
            />

            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Excluir Categoria" />
        </div>
    );
};
