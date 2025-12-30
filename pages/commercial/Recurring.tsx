
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { RecurringService, Contact, CatalogItem } from '../../types';
import { Loader, Card, Button, Badge } from '../../components/Shared';
import { RecurringModal } from '../../components/CommercialModals';
import { ConfirmationModal } from '../../components/Modals';
import { RefreshCw, Plus, Trash2, Calendar, Edit2, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const RecurringPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<RecurringService[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    // State to hold the contract being edited/viewed
    const [editingService, setEditingService] = useState<RecurringService | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [r, c, cat] = await Promise.all([api.getRecurringServices(), api.getContacts(), api.getCatalogItems()]);
            setServices(r); setContacts(c); setCatalog(cat);
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (confirmDeleteId) {
            await api.deleteRecurringService(confirmDeleteId);
            setConfirmDeleteId(null);
            loadData();
        }
    };

    const handleOpenModal = (service?: RecurringService) => {
        setEditingService(service); // Set initial data (if viewing/editing)
        setIsModalOpen(true);
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><RefreshCw className="text-emerald-500"/> Contratos Recorrentes</h1>
                <Button className="gap-2" onClick={() => handleOpenModal()}><Plus size={16}/> Novo Contrato</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(s => (
                    <Card 
                        key={s.id} 
                        className="group relative hover:border-emerald-500/30 cursor-pointer transition-all hover:bg-slate-800/80"
                        onClick={() => handleOpenModal(s)} // Open modal on click
                    >
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }} className="text-slate-500 hover:text-rose-500 bg-slate-900/50 p-1.5 rounded"><Trash2 size={16}/></button>
                        </div>
                        
                        <div className="flex justify-between items-start mb-3">
                            <Badge variant={s.active ? 'success' : 'neutral'}>{s.active ? 'Ativo' : 'Inativo'}</Badge>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.frequency === 'monthly' ? 'Mensal' : 'Anual'}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                                <User size={20} />
                            </div>
                            <h3 className="font-bold text-white text-lg truncate flex-1">{s.contact?.name || 'Cliente Removido'}</h3>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm text-slate-400 border border-slate-700/50">
                            <div className="flex justify-between">
                                <span className="flex items-center gap-2"><Calendar size={12}/> Início</span>
                                <span className="text-slate-200">{format(parseISO(s.startDate), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Duração</span>
                                <span className="text-slate-200">{s.contractMonths ? `${s.contractMonths} meses` : 'Indeterminado'}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-700/50 pt-2 mt-2">
                                <span>Valor Recorrente</span>
                                <span className="text-emerald-400 font-bold">R$ {s.recurringAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div className="mt-3 text-center text-xs text-slate-500 group-hover:text-emerald-400 transition-colors">
                            Clique para ver detalhes
                        </div>
                    </Card>
                ))}
                {services.length === 0 && (
                    <div className="col-span-full py-12 text-center border border-dashed border-slate-700 rounded-xl text-slate-500">
                        Nenhum contrato recorrente ativo.
                    </div>
                )}
            </div>

            <RecurringModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={loadData} 
                contacts={contacts} 
                catalog={catalog}
                initialData={editingService}
            />
            
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Encerrar Contrato" description="Isso removerá o contrato, mas manterá o histórico financeiro gerado." />
        </div>
    );
};
