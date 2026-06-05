
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FinancialCategory, FinancialTransaction } from '../../types';
import { Loader, Badge, Button, Card } from '../../components/Shared';
import { DrilldownModal, CategoryModal, ConfirmationModal } from '../../components/Modals';
import { ArrowUpCircle, ArrowDownCircle, Plus, Trash2, Edit2, ChevronRight, Tags, ChevronLeft } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAppEnvironment } from '../../context/AppEnvironmentContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../components/Shared';

export const FinancialCategories: React.FC = () => {
    const { currentCompany } = useCompany();
    const { isApp } = useAppEnvironment();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

    // Modals
    const [drilldownState, setDrilldownState] = useState<{ isOpen: boolean, title: string, data: any[] }>({ isOpen: false, title: '', data: [] });
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<FinancialCategory | undefined>(undefined);
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
            const [cats, trans] = await Promise.all([
                api.getFinancialCategories(currentCompany.id),
                api.getFinancialTransactions(currentCompany.id)
            ]);
            setCategories(cats);
            setTransactions(trans);
        } catch (error) {
            console.error(error);
        } finally { setLoading(false); }
    };

    const getCategoryTotal = (catId: string) => {
        return transactions.filter(t => t.categoryId === catId && t.isPaid).reduce((sum, t) => sum + t.amount, 0);
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

    // === MOBILE LAYOUT ===
    if (isApp) {
        return (
            <div className="flex-1 flex flex-col bg-background text-foreground relative pb-20">
                {/* Header Compacto */}
                <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground"><ChevronLeft size={20} /></button>
                    <h1 className="text-base font-bold text-foreground">Categorias</h1>
                    <button onClick={handleCreate} className="p-2 -mr-2 text-primary"><Plus size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="px-4 py-3 bg-card border-b border-border sticky top-[53px] z-10">
                    <div className="flex bg-secondary/50 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('expense')}
                            className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-colors", activeTab === 'expense' ? "bg-card shadow text-danger" : "text-muted-foreground")}
                        >
                            Despesas
                        </button>
                        <button
                            onClick={() => setActiveTab('income')}
                            className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-colors", activeTab === 'income' ? "bg-card shadow text-success" : "text-muted-foreground")}
                        >
                            Receitas
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                    {(activeTab === 'income' ? incomeCats : expenseCats).map(cat => (
                        <div key={cat.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shadow-sm" onClick={(e) => handleEdit(e, cat)}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 rounded-full" style={{ backgroundColor: cat.color || (activeTab === 'income' ? '#10b981' : '#f43f5e') }}></div>
                                <span className="font-bold text-sm text-foreground">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => requestDelete(e, cat.id)} className="p-2 text-muted-foreground hover:text-danger"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {(activeTab === 'income' ? incomeCats : expenseCats).length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma categoria encontrada.</div>
                    )}
                </div>

                <CategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSuccess={loadData} initialData={editingCategory} />
                <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Excluir Categoria" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-4 pb-8 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Tags className="text-emerald-500" size={20} /> Categorias
                </h1>
                <Button className="gap-1.5 h-7 px-3 text-[10px]" onClick={handleCreate}>
                    <Plus size={14} /> Nova Categoria
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Income Column */}
                <Card className="rounded-xl border border-border p-6" variant="solid">
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 pb-4 border-b border-border">
                        <ArrowUpCircle size={18} className="text-emerald-500" /> Receitas
                    </h2>
                    <div className="space-y-3">
                        {incomeCats.map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => setDrilldownState({ isOpen: true, title: cat.name, data: transactions.filter(t => t.categoryId === cat.id) })}
                                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border cursor-pointer hover:border-emerald-500/50 hover:bg-secondary/50 transition-all group shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color || '#10b981' }}></div>
                                    <span className="font-medium text-foreground">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleEdit(e, cat)} className="text-muted-foreground hover:text-primary p-1"><Edit2 size={14} /></button>
                                        <button onClick={(e) => requestDelete(e, cat.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={14} /></button>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground" />
                                </div>
                            </div>
                        ))}
                        {incomeCats.length === 0 && <p className="text-muted-foreground text-sm italic text-center py-4">Nenhuma categoria cadastrada.</p>}
                    </div>
                </Card>

                {/* Expense Column */}
                <Card className="rounded-xl border border-border p-6" variant="solid">
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 pb-4 border-b border-border">
                        <ArrowDownCircle size={18} className="text-rose-500" /> Despesas
                    </h2>
                    <div className="space-y-3">
                        {expenseCats.map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => setDrilldownState({ isOpen: true, title: cat.name, data: transactions.filter(t => t.categoryId === cat.id) })}
                                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border cursor-pointer hover:border-rose-500/50 hover:bg-secondary/50 transition-all group shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color || '#f43f5e' }}></div>
                                    <span className="font-medium text-foreground">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleEdit(e, cat)} className="text-muted-foreground hover:text-primary p-1"><Edit2 size={14} /></button>
                                        <button onClick={(e) => requestDelete(e, cat.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={14} /></button>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground" />
                                </div>
                            </div>
                        ))}
                        {expenseCats.length === 0 && <p className="text-muted-foreground text-sm italic text-center py-4">Nenhuma categoria cadastrada.</p>}
                    </div>
                </Card>
            </div>

            <DrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState({ ...drilldownState, isOpen: false })}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
                users={[]}
                onPayAction={(item) => {
                    navigate(`/finance/cards?payInvoice=${item.id}`);
                }}
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
