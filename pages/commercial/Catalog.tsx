
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CatalogItem } from '../../types';
import { Loader, Card, Button, Input, Badge } from '../../components/Shared';
import { CatalogModal } from '../../components/CommercialModals';
import { CatalogReportModal } from '../../components/Reports/CatalogReportModal';
import { ConfirmationModal } from '../../components/Modals';
import { ShoppingBag, Search, Plus, Trash2, Edit2, Tag, FileText } from 'lucide-react';
import { translateCatalogType } from '../../utils/i18n';

export const CatalogPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getCatalogItems();
            setItems(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (confirmDeleteId) {
            await api.deleteCatalogItem(confirmDeleteId);
            setConfirmDeleteId(null);
            loadData();
        }
    };

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><ShoppingBag className="text-emerald-500" /> Produtos & Serviços</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" className="gap-2" onClick={() => setIsReportOpen(true)}><FileText size={16} /> Relatórios</Button>
                    <Button className="gap-2" onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }}><Plus size={16} /> Novo Item</Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input placeholder="Buscar no catálogo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="space-y-3">
                {filtered.map(i => (
                    <div
                        key={i.id}
                        onClick={() => { setEditingItem(i); setIsModalOpen(true); }}
                        className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            {/* Type Indicator */}
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center font-bold text-lg border ${i.type === 'service'
                                ? 'bg-slate-800 border-slate-700 text-purple-400'
                                : 'bg-slate-800 border-slate-700 text-blue-400'
                                }`}>
                                {i.type === 'service' ? 'S' : 'P'}
                            </div>

                            {/* Info */}
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="font-bold text-white text-base">{i.name}</h3>
                                    {!i.active && <Badge variant="error">Inativo</Badge>}
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">{i.description || 'Sem descrição'}</p>
                            </div>
                        </div>

                        {/* Right Side */}
                        <div className="flex items-center gap-6">
                            <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">
                                R$ {i.price.toFixed(2)}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingItem(i); setIsModalOpen(true); }}
                                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(i.id); }}
                                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-rose-500 transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <CatalogModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} initialData={editingItem} />
            <CatalogReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} items={items} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Item" />
        </div>
    );
};
