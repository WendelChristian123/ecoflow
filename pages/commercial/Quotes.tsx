
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Quote, Contact, CatalogItem } from '../../types';
import { Loader, Card, Button, Badge } from '../../components/Shared';
import { QuoteModal } from '../../components/CommercialModals';
import { ConfirmationModal } from '../../components/Modals';
import { FileText, Plus, Trash2, Edit2, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const QuotesPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [q, c, cat] = await Promise.all([api.getQuotes(), api.getContacts(), api.getCatalogItems()]);
            setQuotes(q); setContacts(c); setCatalog(cat);
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (confirmDeleteId) {
            await api.deleteQuote(confirmDeleteId);
            setConfirmDeleteId(null);
            loadData();
        }
    };

    const statusMap: any = {
        draft: { label: 'Rascunho', color: 'neutral' },
        sent: { label: 'Enviado', color: 'warning' },
        approved: { label: 'Aprovado', color: 'success' },
        rejected: { label: 'Rejeitado', color: 'error' },
        expired: { label: 'Expirado', color: 'error' }
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FileText className="text-emerald-500"/> Orçamentos</h1>
                <Button className="gap-2" onClick={() => { setEditingQuote(undefined); setIsModalOpen(true); }}><Plus size={16}/> Novo Orçamento</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quotes.map(q => (
                    <Card key={q.id} className="group relative hover:border-emerald-500/30 cursor-pointer" onClick={() => { setEditingQuote(q); setIsModalOpen(true); }}>
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(q.id); }} className="text-slate-500 hover:text-rose-500"><Trash2 size={16}/></button>
                        </div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-slate-500">#{q.id.substring(0,8)}</span>
                            <div className="flex gap-2">
                                {!q.contactId && <Badge variant="neutral" className="bg-slate-700 text-slate-300 border-slate-600">Convidado</Badge>}
                                <Badge variant={statusMap[q.status].color}>{statusMap[q.status].label}</Badge>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-1">
                            {!q.contactId && <User size={16} className="text-slate-500" />}
                            <h3 className="font-bold text-white text-lg truncate">
                                {q.contact?.name || q.customerName || <span className="text-slate-500 italic">Cliente Desconhecido</span>}
                            </h3>
                        </div>
                        
                        <div className="text-sm text-slate-400">Data: {format(parseISO(q.date), 'dd/MM/yyyy')}</div>
                        {(q.customerPhone || q.contact?.phone) && (
                            <div className="text-xs text-slate-500 mt-1">{q.customerPhone || q.contact?.phone}</div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                            <span className="text-xs text-slate-500">{q.items?.length || 0} itens</span>
                            <span className="text-xl font-bold text-emerald-400">R$ {q.totalValue.toFixed(2)}</span>
                        </div>
                    </Card>
                ))}
            </div>

            <QuoteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} contacts={contacts} catalog={catalog} initialData={editingQuote} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Orçamento" />
        </div>
    );
};
