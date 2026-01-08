
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Quote, Contact, CatalogItem } from '../../types';
import { Loader, Button, Badge } from '../../components/Shared';
import { QuoteModal } from '../../components/CommercialModals';
import { ConfirmationModal } from '../../components/Modals';
import { FileText, Plus, Trash2, Edit2, User, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

import { startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select } from '../../components/Shared';
import { QuoteKanban } from '../../components/Commercial/QuoteKanban';
import { LayoutGrid, List } from 'lucide-react';

export const QuotesPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);

    // Filters
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewAllDates, setViewAllDates] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [q, c, cat] = await Promise.all([api.getQuotes(), api.getContacts(), api.getCatalogItems()]);
            setQuotes(q); setContacts(c); setCatalog(cat);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (confirmDeleteId) {
            await api.deleteQuote(confirmDeleteId);
            setConfirmDeleteId(null);
            loadData();
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        // Optimistic Update
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus as any } : q));

        try {
            await api.updateQuote({ id, status: newStatus as any }, null as any);
        } catch (e) {
            console.error("Failed to move quote", e);
            loadData(); // Revert on error
        }
    };

    const statusMap: any = {
        draft: { label: 'Rascunho', color: 'neutral' },
        sent: { label: 'Enviado', color: 'warning' },
        approved: { label: 'Aprovado', color: 'success' },
        rejected: { label: 'Rejeitado', color: 'error' },
        expired: { label: 'Expirado', color: 'error' }
    };

    // Filter Logic
    const filteredQuotes = quotes.filter(q => {
        const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

        // Date Logic: Parse quote date (string or Date)
        const quoteDate = new Date(q.date);
        const matchesDate = viewAllDates || isSameMonth(quoteDate, selectedMonth);

        return matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort desc by date

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FileText className="text-emerald-500" /> Orçamentos</h1>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    {/* Month Selector */}
                    <div className={`flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1 transition-opacity ${viewAllDates ? 'opacity-50 pointer-events-none' : ''}`}>
                        <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-1 hover:text-white text-slate-400"><ChevronLeft size={20} /></button>
                        <span className="text-sm font-bold text-white min-w-[120px] text-center capitalize select-none">{format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</span>
                        <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="p-1 hover:text-white text-slate-400"><ChevronRight size={20} /></button>
                    </div>


                    {/* Status Filter */}
                    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full md:w-40 bg-slate-900 border-slate-800 text-sm">
                        <option value="all">Todos Status</option>
                        <option value="draft">Rascunhos</option>
                        <option value="sent">Enviados</option>
                        <option value="approved">Aprovados</option>
                        <option value="rejected">Rejeitados</option>
                    </Select>

                    <Button className="gap-2 whitespace-nowrap" onClick={() => { setEditingQuote(undefined); setIsModalOpen(true); }}><Plus size={16} /> Novo Orçamento</Button>
                </div>
            </div>


            <div className="flex justify-between items-center px-1">
                <button
                    onClick={() => setViewAllDates(!viewAllDates)}
                    className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${viewAllDates ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
                >
                    {viewAllDates ? 'Exibindo: Todas as Datas' : 'Filtrar por Mês'}
                </button>

                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                        <List size={18} />
                    </button>
                    <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition-all ${viewMode === 'kanban' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                        <LayoutGrid size={18} />
                    </button>
                </div>
            </div>

            {viewMode === 'kanban' ? (
                <div className="h-[calc(100vh-220px)]">
                    <QuoteKanban
                        quotes={filteredQuotes}
                        onStatusChange={handleStatusChange}
                        onQuoteClick={(q) => { setEditingQuote(q); setIsModalOpen(true); }}
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredQuotes.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">Nenhum orçamento encontrado.</div>
                    ) : filteredQuotes.map(q => (
                        <div
                            key={q.id}
                            onClick={() => { setEditingQuote(q); setIsModalOpen(true); }}
                            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all group"
                        >
                            <div className="flex items-center gap-6">
                                {/* Quote ID */}
                                <div className="flex flex-col items-center justify-center h-12 w-16 bg-slate-800 rounded text-slate-400 font-mono text-xs border border-slate-700">
                                    <span className="text-[10px] uppercase text-slate-500">COD</span>
                                    <span className="font-bold text-slate-300">#{q.id.substring(0, 4)}</span>
                                </div>

                                {/* Client Name */}
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs text-slate-500 font-medium uppercase">Cliente</span>
                                        {!q.contactId && <Badge variant="neutral" className="py-0 px-1 text-[10px]">Convidado</Badge>}
                                    </div>
                                    <h3 className="font-bold text-white text-lg leading-none truncate max-w-[200px] md:max-w-xs">{q.contact?.name || q.customerName || 'Cliente Desconhecido'}</h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                {/* Dates */}
                                <div className="hidden md:flex items-center gap-6 text-sm">
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs text-slate-500 uppercase">Emissão</span>
                                        <div className="flex items-center gap-1.5 text-slate-300">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                            {formatDate(q.date)}
                                        </div>
                                    </div>
                                    <div className="h-8 w-px bg-slate-800"></div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs text-slate-500 uppercase">Vencimento</span>
                                        <div className="flex items-center gap-1.5 text-slate-300">
                                            <Calendar className="w-3.5 h-3.5 text-rose-500" />
                                            {formatDate(q.validUntil)}
                                        </div>
                                    </div>
                                </div>

                                {/* Value & Status */}
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase">{q.items?.length || 0} itens</div>
                                        <div className="text-lg font-bold text-emerald-400">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.totalValue)}
                                        </div>
                                    </div>
                                    <Badge variant={statusMap[q.status].color} className="w-24 justify-center">{statusMap[q.status].label}</Badge>
                                </div>
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(q.id); }}
                                    className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <QuoteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} contacts={contacts} catalog={catalog} initialData={editingQuote} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Orçamento" />
        </div>
    );
};
