
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api';
import { FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard, TransactionType, Contact } from '../../types';
import { Loader, Badge, cn, Button, Select, Input } from '../../components/Shared';
import { TransactionModal, ConfirmationModal, RecurrenceActionModal } from '../../components/Modals';
import { 
    FileText, 
    ArrowDownCircle, 
    ArrowUpCircle, 
    Filter, 
    Plus, 
    Edit2, 
    Search, 
    ChevronLeft, 
    ChevronRight, 
    FileSpreadsheet, 
    MoreVertical, 
    ArrowRightLeft,
    ThumbsUp,
    ThumbsDown,
    Trash2,
    RefreshCw
} from 'lucide-react';
import { format, parseISO, addMonths, subMonths, isSameMonth, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';
import { useRBAC } from '../../context/RBACContext';

export const FinancialTransactions: React.FC = () => {
    const { can, canDelete } = useRBAC();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    
    // States de Navegação e Filtro
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    
    // States de UI
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);

    // Modal & Editing
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | Partial<FinancialTransaction> | undefined>(undefined);
    const [initialType, setInitialType] = useState<TransactionType>('expense');

    // Confirm Delete State
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [recurrenceDeleteData, setRecurrenceDeleteData] = useState<FinancialTransaction | null>(null);

    const location = useLocation();

    useEffect(() => {
        loadData();
        const handleClickOutside = (event: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
                setIsAddMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!loading && transactions.length > 0 && location.state?.transactionId) {
            const target = transactions.find(t => t.id === location.state.transactionId);
            if (target) {
                handleEdit(target);
                setCurrentDate(parseISO(target.date));
            }
        }
    }, [loading, transactions, location.state]);

    const loadData = async () => {
        setLoading(true);
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
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleOpenModal = (type: TransactionType) => {
        if (!can('finance', 'create')) return;
        setEditingTransaction(undefined);
        setInitialType(type);
        setIsModalOpen(true);
        setIsAddMenuOpen(false);
    };

    const handleEdit = (t: FinancialTransaction) => {
        if (!can('finance', 'edit')) return;
        setEditingTransaction(t);
        setInitialType(t.type);
        setIsModalOpen(true);
    };

    const requestDelete = (e: React.MouseEvent, t: FinancialTransaction) => {
        e.stopPropagation();
        if (!canDelete()) return;
        if (t.recurrenceId) {
            setRecurrenceDeleteData(t);
        } else {
            setConfirmDeleteId(t.id);
        }
    };

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            await api.deleteTransaction(confirmDeleteId);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Falha ao excluir o lançamento.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const executeRecurrenceDelete = async (scope: 'single' | 'future') => {
        if (!recurrenceDeleteData) return;
        try {
            await api.deleteTransaction(recurrenceDeleteData.id, scope, recurrenceDeleteData.recurrenceId, recurrenceDeleteData.date);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir recorrência.");
        } finally {
            setRecurrenceDeleteData(null);
        }
    };

    const handleExport = () => {
        alert("Funcionalidade de exportar para Excel em desenvolvimento.");
    };

    const handleToggleStatus = async (e: React.MouseEvent, t: FinancialTransaction) => {
        e.stopPropagation();
        if (!can('finance', 'edit')) return;
        const newStatus = !t.isPaid;
        setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isPaid: newStatus } : item));
        
        try {
            await api.toggleTransactionStatus(t.id, newStatus);
        } catch (error) {
            console.error("Failed to toggle status", error);
            setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isPaid: !newStatus } : item));
            alert("Erro ao atualizar status.");
        }
    };

    if (loading) return <Loader />;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const filteredTransactions = transactions.filter(t => {
        const transactionDate = parseISO(t.date);
        const matchesMonth = isSameMonth(transactionDate, currentDate);
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        
        return matchesMonth && matchesSearch && matchesType;
    });

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            
            {/* HEADER CUSTOMIZADO */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Lado Esquerdo: Título + Botão Adicionar */}
                <div className="flex items-center gap-3 w-full md:w-auto relative" ref={addMenuRef}>
                    <h1 className="text-2xl font-bold text-white">Lançamentos</h1>
                    
                    {can('finance', 'create') && (
                        <>
                            <button 
                                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                                className="h-8 w-8 rounded-full border border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm shadow-rose-900/20"
                            >
                                <Plus size={18} />
                            </button>

                            {/* Dropdown Menu */}
                            {isAddMenuOpen && (
                                <div className="absolute top-10 left-20 z-50 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="py-1">
                                        <button 
                                            onClick={() => handleOpenModal('expense')}
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-rose-400 flex items-center gap-2"
                                        >
                                            <div className="h-2 w-2 rounded-full bg-rose-500"></div> Nova Despesa
                                        </button>
                                        <button 
                                            onClick={() => handleOpenModal('income')}
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-emerald-400 flex items-center gap-2"
                                        >
                                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div> Nova Receita
                                        </button>
                                        <button 
                                            onClick={() => handleOpenModal('transfer')}
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-400 flex items-center gap-2"
                                        >
                                            <div className="h-2 w-2 rounded-full bg-indigo-500"></div> Nova Transferência
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Centro: Navegação de Data */}
                <div className="flex items-center gap-4 text-slate-200">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-lg font-medium capitalize min-w-[140px] text-center select-none">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Lado Direito: Ações */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button 
                        onClick={handleExport}
                        className="p-2 border border-slate-700 rounded-lg text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-800 transition-all" 
                        title="Exportar Excel"
                    >
                        <FileSpreadsheet size={18} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS & BUSCA */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center shadow-sm">
                <div className="flex items-center px-4 py-2 text-slate-500 border-r border-slate-800 gap-2 cursor-pointer hover:text-slate-300 transition-colors">
                    <Filter size={16} />
                    <span className="text-sm font-medium whitespace-nowrap hidden sm:inline">Filtrar por</span>
                </div>
                
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar por descrição, categoria..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent border-none text-slate-200 text-sm pl-10 pr-4 py-2.5 focus:ring-0 outline-none placeholder:text-slate-600"
                    />
                </div>

                <div className="px-2">
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-slate-800 border-none text-xs text-slate-400 rounded-lg py-1.5 px-2 outline-none cursor-pointer hover:text-white"
                    >
                        <option value="all">Todos</option>
                        <option value="expense">Despesas</option>
                        <option value="income">Receitas</option>
                    </select>
                </div>
            </div>

            {/* LISTAGEM */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[400px]">
                <div className="divide-y divide-slate-800/50">
                    {filteredTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p>Nenhum lançamento neste mês.</p>
                        </div>
                    ) : (
                        filteredTransactions.map(t => {
                            const contact = contacts.find(c => c.id === t.contactId);
                            const displayName = contact ? ` - ${contact.name}` : '';
                            
                            return (
                                <div key={t.id} className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer border-l-2 border-l-transparent hover:border-l-emerald-500" onClick={() => handleEdit(t)}>
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm", 
                                            t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 
                                            t.type === 'expense' ? 'bg-rose-500/10 text-rose-400' : 
                                            'bg-indigo-500/10 text-indigo-400'
                                        )}>
                                            {t.type === 'income' ? <ArrowUpCircle size={20} /> : t.type === 'expense' ? <ArrowDownCircle size={20} /> : <ArrowRightLeft size={18} />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-200 text-sm md:text-base flex items-center gap-2">
                                                {t.description}<span className="text-slate-400 font-normal">{displayName}</span>
                                                {t.recurrenceId && <span title="Recorrente"><RefreshCw size={12} className="text-slate-500" /></span>}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                <span className="font-medium text-slate-400">{format(parseISO(t.date), 'dd/MM/yyyy')}</span>
                                                {t.categoryId && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-slate-700">
                                                            {categories.find(c => c.id === t.categoryId)?.name || 'Geral'}
                                                        </span>
                                                    </>
                                                )}
                                                {t.accountId && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                        <span className="text-slate-500">{accounts.find(a => a.id === t.accountId)?.name}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-6 min-w-[220px]">
                                        <div className="text-right">
                                            <div className={cn("font-bold text-sm md:text-base", t.type === 'expense' ? 'text-rose-400' : t.type === 'income' ? 'text-emerald-400' : 'text-slate-300')}>
                                                {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}
                                                {fmt(t.amount)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={(e) => handleToggleStatus(e, t)}
                                                className={cn(
                                                    "p-1.5 rounded transition-colors flex items-center justify-center",
                                                    t.isPaid 
                                                        ? "text-emerald-500 hover:bg-emerald-500/10" 
                                                        : "text-slate-500 hover:text-emerald-500 hover:bg-slate-700"
                                                )}
                                                title={t.isPaid ? "Marcar como não pago" : "Marcar como pago"}
                                            >
                                                {t.isPaid ? <ThumbsUp size={20} className="fill-emerald-500/10" /> : <ThumbsDown size={20} />}
                                            </button>
                                            
                                            {canDelete() && (
                                                <button 
                                                    onClick={(e) => requestDelete(e, t)}
                                                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <TransactionModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadData}
                accounts={accounts}
                categories={categories}
                cards={cards}
                contacts={contacts}
                initialData={editingTransaction ? editingTransaction : { type: initialType, date: new Date().toISOString().split('T')[0], isPaid: false }}
            />

            <ConfirmationModal 
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={executeDelete}
                title="Excluir Lançamento"
                description="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
            />

            <RecurrenceActionModal
                isOpen={!!recurrenceDeleteData}
                onClose={() => setRecurrenceDeleteData(null)}
                onConfirm={executeRecurrenceDelete}
                action="delete"
            />
        </div>
    );
};
