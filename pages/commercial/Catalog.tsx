
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CatalogItem } from '../../types';
import { Loader, Card, Button, Input, Badge } from '../../components/Shared';
import { CatalogModal } from '../../components/CommercialModals';
import { ConfirmationModal } from '../../components/Modals';
import { ShoppingBag, Search, Plus, Trash2, Edit2, Tag } from 'lucide-react';

export const CatalogPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getCatalogItems();
            setItems(data);
        } catch(e) { console.error(e); } 
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
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><ShoppingBag className="text-emerald-500"/> Produtos & Serviços</h1>
                <Button className="gap-2" onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }}><Plus size={16}/> Novo Item</Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input placeholder="Buscar no catálogo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filtered.map(i => (
                    <Card key={i.id} className="group relative hover:border-emerald-500/30 flex flex-col justify-between">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingItem(i); setIsModalOpen(true); }} className="text-slate-500 hover:text-white"><Edit2 size={16}/></button>
                            <button onClick={() => setConfirmDeleteId(i.id)} className="text-slate-500 hover:text-rose-500"><Trash2 size={16}/></button>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Badge variant={i.type === 'service' ? 'neutral' : 'default'}>{i.type === 'service' ? 'Serviço' : 'Produto'}</Badge>
                                {!i.active && <Badge variant="error">Inativo</Badge>}
                            </div>
                            <h3 className="font-bold text-white text-lg mb-1">{i.name}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">{i.description}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                            <span className="text-xs text-slate-500">Valor Unitário</span>
                            <span className="text-lg font-bold text-emerald-400">R$ {i.price.toFixed(2)}</span>
                        </div>
                    </Card>
                ))}
            </div>

            <CatalogModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} initialData={editingItem} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Item" />
        </div>
    );
};
