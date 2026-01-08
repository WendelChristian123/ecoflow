
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { RecurringService, Contact, CatalogItem, FinancialCategory, FinancialAccount } from '../../types';
import { Loader, Card, Button, Badge } from '../../components/Shared';
import { RecurringModal, ContractDetailModal } from '../../components/CommercialModals';
import { ConfirmationModal } from '../../components/Modals';
import { RefreshCw, Plus, Trash2, Calendar, Edit2, User, Eye, FileText, MoreHorizontal } from 'lucide-react';
import { format, parseISO, addMonths, addDays } from 'date-fns';
import { formatDate } from '../../utils/formatters';

export const RecurringPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<RecurringService[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
    const [bankAccounts, setBankAccounts] = useState<FinancialAccount[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    // State to hold the contract being edited/viewed
    const [editingService, setEditingService] = useState<RecurringService | undefined>(undefined);
    const [detailService, setDetailService] = useState<RecurringService | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [r, c, cat, fc, fa] = await Promise.all([
                api.getRecurringServices(),
                api.getContacts(),
                api.getCatalogItems(),
                api.getFinancialCategories(),
                api.getFinancialAccounts()
            ]);
            setServices(r); setContacts(c); setCatalog(cat); setFinancialCategories(fc); setBankAccounts(fa);
        } catch (e) { console.error(e); }
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
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><RefreshCw className="text-emerald-500" /> Contratos Recorrentes</h1>
                <Button className="gap-2" onClick={() => handleOpenModal()}><Plus size={16} /> Novo Contrato</Button>
            </div>

            <div className="space-y-3">
                {services.map(s => {
                    // Safe parsing for calculation (split T)
                    const parseSafe = (d?: string) => d ? parseISO(d.split('T')[0]) : new Date();

                    const startDate = parseSafe(s.startDate);
                    const recurrenceStart = parseSafe(s.firstRecurrenceDate);

                    // Logic: Last Recurrence Date + 30 days
                    // Last Recurrence Day = First + (Months-1) months
                    const endDate = addDays(addMonths(recurrenceStart, (s.contractMonths || 12) - 1), 30);

                    return (
                        <div
                            key={s.id}
                            onClick={() => setDetailService(s)}
                            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all group"
                        >
                            <div className="flex items-center gap-6">
                                {/* Contract ID */}
                                <div className="flex flex-col items-center justify-center h-12 w-16 bg-slate-800 rounded text-slate-400 font-mono text-xs border border-slate-700">
                                    <span className="text-[10px] uppercase text-slate-500">Contrato</span>
                                    <span className="font-bold text-slate-300">#{s.id.substring(0, 4)}</span>
                                </div>

                                {/* Client Name */}
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 font-medium uppercase mb-0.5">Cliente</span>
                                    <h3 className="font-bold text-white text-lg leading-none">{s.contactName || s.contact?.name || '---'}</h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                {/* Dates */}
                                <div className="hidden md:flex items-center gap-6 text-sm">
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs text-slate-500 uppercase">Início</span>
                                        <div className="flex items-center gap-1.5 text-slate-300">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                            {formatDate(s.startDate)}
                                        </div>
                                    </div>
                                    <div className="h-8 w-px bg-slate-800"></div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs text-slate-500 uppercase">Fim</span>
                                        <div className="flex items-center gap-1.5 text-slate-300">
                                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                            {format(endDate, 'dd/MM/yyyy')}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        className="h-9 w-9 p-0 rounded-full hover:bg-slate-800 hover:text-emerald-400 text-slate-500 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setEditingService(s); setIsModalOpen(true); }}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-9 w-9 p-0 rounded-full hover:bg-slate-800 hover:text-rose-500 text-slate-500 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {services.length === 0 && (
                    <div className="py-12 text-center border border-dashed border-slate-700 rounded-xl text-slate-500">
                        Nenhum contrato recorrente ativo.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <ContractDetailModal
                isOpen={!!detailService}
                onClose={() => setDetailService(undefined)}
                service={detailService!}
                onEdit={() => { setEditingService(detailService); setIsModalOpen(true); }}
            />

            <RecurringModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadData}
                contacts={contacts}
                catalog={catalog}
                financialCategories={financialCategories}
                initialData={editingService}
                bankAccounts={bankAccounts}
            />

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={handleDelete}
                title="Excluir Contrato"
                description="Tem certeza que deseja excluir este contrato recorrente? Isso não excluirá lançamentos financeiros já gerados."
                confirmText="Excluir"
                cancelText="Cancelar"
            />
        </div>
    );
};
