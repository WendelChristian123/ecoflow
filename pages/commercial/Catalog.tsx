
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
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2 bg-background text-foreground">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3"><ShoppingBag className="text-emerald-500" /> Produtos & Serviços</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" className="gap-2" onClick={() => setIsReportOpen(true)}><FileText size={16} /> Relatórios</Button>
                    <Button className="gap-2" onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }}><Plus size={16} /> Novo Item</Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar no catálogo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border text-foreground focus:border-primary" />
            </div>

            <div className="space-y-3">
                {filtered.map(i => (
                    <div
                        key={i.id}
                        onClick={() => { setEditingItem(i); setIsModalOpen(true); }}
                        className="bg-card border border-border hover:border-primary/50 rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all group shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            {/* Type Indicator */}
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center font-bold text-lg border ${i.type === 'service'
                                ? 'bg-secondary border-border text-primary'
                                : 'bg-secondary border-border text-blue-500'
                                }`}>
                                {i.type === 'service' ? 'S' : 'P'}
                            </div>

                            {/* Info */}
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="font-bold text-foreground text-base">{i.name}</h3>
                                    {!i.active && <Badge variant="error">Inativo</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">{i.description || 'Sem descrição'}</p>
                            </div>
                        </div>

                        {/* Right Side */}
                        <div className="flex items-center gap-6">
                            <span className="text-sm font-bold text-emerald-500 whitespace-nowrap">
                                R$ {i.price.toFixed(2)}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingItem(i); setIsModalOpen(true); }}
                                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(i.id); }}
                                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
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
