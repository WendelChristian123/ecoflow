
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Quote, Contact, CatalogItem } from '../../types';
import { Loader, Button, Badge } from '../../components/Shared';
import { QuoteModal, QuoteApprovalModal, RecurringModal } from '../../components/CommercialModals';
import { ConfirmationModal, TransactionModal } from '../../components/Modals';
import { FileText, Plus, Trash2, Edit2, User, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

import { startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select } from '../../components/Shared';
import { QuoteKanban } from '../../components/Commercial/QuoteKanban';
import { translateQuoteStatus } from '../../utils/i18n';
import { LayoutGrid, List } from 'lucide-react';
import { FinancialCategory, FinancialAccount, RecurringService } from '../../types';

export const QuotesPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    // Data for subsequent modals
    const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

    // Filters
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewAllDates, setViewAllDates] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [searchTerm, setSearchTerm] = useState('');

    // Approval Workflow State
    const [approvedQuote, setApprovedQuote] = useState<Quote | undefined>(undefined);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [transactionInitialData, setTransactionInitialData] = useState<any>(undefined);
    const [recurringInitialData, setRecurringInitialData] = useState<Partial<RecurringService> | undefined>(undefined);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [q, c, cat, fc, acc] = await Promise.all([
                api.getQuotes(),
                api.getContacts(),
                api.getCatalogItems(),
                api.getFinancialCategories(),
                api.getFinancialAccounts()
            ]);
            setQuotes(q); setContacts(c); setCatalog(cat); setFinancialCategories(fc); setAccounts(acc);
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
        const targetQuote = quotes.find(q => q.id === id);
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus as any } : q));

        try {
            await api.updateQuote({ id, status: newStatus as any }, null as any);

            // AUTOMATION: If Approved, trigger flow
            if (newStatus === 'approved' && targetQuote) {
                handleApprovalFlow({ ...targetQuote, status: 'approved' } as Quote);
            }
        } catch (e) {
            console.error("Failed to move quote", e);
            loadData(); // Revert on error
        }
    };

    const handleApprovalFlow = async (quote: Quote) => {
        let currentQuote = { ...quote };

        // 1. Check/Create Contact
        if (!currentQuote.contactId) {
            try {
                // Auto-create contact
                const newContact = await api.addContact({
                    name: currentQuote.customerName || 'Cliente Novo',
                    phone: currentQuote.customerPhone,
                    scope: 'client',
                    type: 'pj' // Default to PJ or could infer?
                });

                // Update local state
                setContacts(prev => [...prev, newContact]);

                // Link contact to quote
                await api.updateQuote({ id: currentQuote.id, contactId: newContact.id } as any, null as any);
                currentQuote.contactId = newContact.id;
                currentQuote.contact = newContact;

                // Update list
                setQuotes(prev => prev.map(q => q.id === currentQuote.id ? { ...q, contactId: newContact.id, contact: newContact } : q));
            } catch (error) {
                console.error("Failed to auto-create contact", error);
                alert("Erro ao criar contato automaticamente. Verifique os dados do cliente.");
                return;
            }
        }

        // 2. Open Decision Modal
        setApprovedQuote(currentQuote);
        setIsApprovalModalOpen(true);
    };

    const handleApprovalDecision = (option: 'contract' | 'finance') => {
        setIsApprovalModalOpen(false);
        if (!approvedQuote) return;

        if (option === 'finance') {
            // Prepare Transaction Data
            // Try to find a category from the first item
            const firstItem = approvedQuote.items?.[0];
            const catItem = catalog.find(c => c.id === firstItem?.catalogItemId);

            setTransactionInitialData({
                description: `Venda: ${approvedQuote.contact?.name || approvedQuote.customerName} (Orç #${approvedQuote.id.substring(0, 4)})`,
                amount: approvedQuote.totalValue,
                type: 'income',
                date: new Date().toISOString().split('T')[0], // Today
                contactId: approvedQuote.contactId,
                categoryId: catItem?.financialCategoryId || ''
            });
            setIsTransactionModalOpen(true);
        } else {
            // Prepare Contract Data
            setRecurringInitialData({
                contactId: approvedQuote.contactId,
                startDate: new Date().toISOString().split('T')[0], // Today
                description: `Contrato Ref. Orçamento #${approvedQuote.id.substring(0, 4)}`,
                amount: approvedQuote.totalValue,
                active: true,
                contractMonths: 12
            });
            setIsRecurringModalOpen(true);
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

        // Search Logic
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            (q.customerName || '').toLowerCase().includes(searchLower) ||
            (q.title || '').toLowerCase().includes(searchLower) ||
            q.id.toLowerCase().includes(searchLower);

        return matchesStatus && matchesDate && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort desc by date

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2 bg-background text-foreground">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Orçamentos</h1>
                    <p className="text-muted-foreground mt-1">Gerencie suas propostas comerciais</p>
                </div>
                <Button className="gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-[34px]" onClick={() => { setEditingQuote(undefined); setIsModalOpen(true); }}>
                    <Plus size={16} /> <span className="hidden sm:inline">Novo</span>
                </Button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* 1. Search */}
                <div className="relative mr-auto">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Filter size={14} />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-card border border-border text-foreground pl-9 pr-4 py-1.5 rounded-lg text-sm w-48 focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                    />
                </div>

                {/* 2. Month Nav */}
                <div className="flex bg-card border border-border rounded-lg p-0.5 items-center">
                    <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={16} /></button>
                    <span className="text-xs font-bold text-foreground uppercase px-2 w-24 text-center select-none">{format(selectedMonth, 'MMM/yyyy', { locale: ptBR })}</span>
                    <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={16} /></button>
                </div>

                {/* 3. Status */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-card border-border text-foreground text-sm h-[34px] rounded-lg px-2 border focus:ring-1 focus:ring-primary outline-none w-36"
                >
                    <option value="all">Todos Status</option>
                    <option value="draft">Rascunhos</option>
                    <option value="sent">Enviados</option>
                    <option value="approved">Aprovados</option>
                    <option value="rejected">Rejeitados</option>
                </select>

                {/* 4. View Toggle */}
                <div className="flex bg-card border border-border rounded-lg p-0.5">
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                        <List size={16} />
                    </button>
                    <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition-all ${viewMode === 'kanban' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                        <LayoutGrid size={16} />
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
                        <div className="text-center py-10 text-muted-foreground">Nenhum orçamento encontrado.</div>
                    ) : filteredQuotes.map(q => (
                        <div
                            key={q.id}
                            onClick={() => { setEditingQuote(q); setIsModalOpen(true); }}
                            className="bg-card border border-border hover:border-primary/50 rounded-lg p-4 pr-12 flex items-center justify-between cursor-pointer transition-all group relative shadow-sm"
                        >
                            <div className="flex items-center gap-6">
                                {/* Quote ID */}
                                <div className="flex flex-col items-center justify-center h-12 w-16 bg-secondary rounded text-muted-foreground font-mono text-xs border border-border">
                                    <span className="text-[10px] uppercase text-muted-foreground">COD</span>
                                    <span className="font-bold text-foreground">#{q.id.substring(0, 4)}</span>
                                </div>

                                {/* Client Name */}
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs text-muted-foreground font-medium uppercase">Cliente</span>
                                        {!q.contactId && <Badge variant="neutral" className="py-0 px-1 text-[10px]">Convidado</Badge>}
                                    </div>
                                    <h3 className="font-bold text-foreground text-lg leading-none truncate max-w-[200px] md:max-w-xs">{q.contact?.name || q.customerName || 'Cliente Desconhecido'}</h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                {/* Dates */}
                                <div className="hidden md:flex items-center gap-6 text-sm">
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs text-muted-foreground uppercase">Emissão</span>
                                        <div className="flex items-center gap-1.5 text-foreground">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                            {formatDate(q.date)}
                                        </div>
                                    </div>
                                    <div className="h-8 w-px bg-border"></div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs text-muted-foreground uppercase">Vencimento</span>
                                        <div className="flex items-center gap-1.5 text-foreground">
                                            <Calendar className="w-3.5 h-3.5 text-rose-500" />
                                            {formatDate(q.validUntil)}
                                        </div>
                                    </div>
                                </div>

                                {/* Value & Status */}
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground uppercase">{q.items?.length || 0} itens</div>
                                        <div className="text-lg font-bold text-emerald-500">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.totalValue)}
                                        </div>
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()} className="w-32">
                                        <select
                                            value={q.status}
                                            onChange={(e) => handleStatusChange(q.id, e.target.value)}
                                            className={`
                                                w-full appearance-none text-xs font-bold px-3 py-1.5 rounded-md border outline-none cursor-pointer text-center uppercase tracking-wider transition-colors
                                                ${q.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' :
                                                    q.status === 'sent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' :
                                                        q.status === 'rejected' || q.status === 'expired' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20' :
                                                            'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary'}
                                            `}
                                        >
                                            <option value="draft" className="bg-popover text-muted-foreground">Rascunho</option>
                                            <option value="sent" className="bg-popover text-amber-500">Enviado</option>
                                            <option value="approved" className="bg-popover text-emerald-500">Aprovado</option>
                                            <option value="rejected" className="bg-popover text-rose-500">Rejeitado</option>
                                            <option value="expired" className="bg-popover text-rose-500">Expirado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(q.id); }}
                                    className="p-1.5 bg-secondary hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500 rounded transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <QuoteModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={(savedQuote) => {
                    loadData();
                    if (savedQuote && savedQuote.status === 'approved') {
                        // Small delay to ensure modal close animation allows seeing the new one? Not strictly necessary.
                        // We pass the savedQuote directly
                        handleApprovalFlow(savedQuote);
                    }
                }}
                contacts={contacts}
                catalog={catalog}
                initialData={editingQuote}
            />

            <QuoteApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                onOptionSelected={handleApprovalDecision}
            />

            <TransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                onSuccess={() => { loadData(); /* Maybe navigate to finance? */ }}
                contacts={contacts}
                categories={financialCategories}
                accounts={accounts}
                initialData={transactionInitialData}
            />

            <RecurringModal
                isOpen={isRecurringModalOpen}
                onClose={() => setIsRecurringModalOpen(false)}
                onSave={loadData}
                contacts={contacts}
                catalog={catalog}
                financialCategories={financialCategories}
                bankAccounts={accounts}
                initialData={recurringInitialData}
            />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Orçamento" />
        </div>
    );
};
