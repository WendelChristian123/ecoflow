
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Contact } from '../../types';
import { Loader, Card, Button, Input, Badge, Avatar } from '../../components/Shared';
import { ContactModal } from '../../components/CommercialModals';
import { ConfirmationModal } from '../../components/Modals';
import { Users, Search, Plus, Phone, Mail, MapPin, Building, User as UserIcon, Trash2, Edit2 } from 'lucide-react';

export const ContactsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getContacts();
            setContacts(data);
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (confirmDeleteId) {
            await api.deleteContact(confirmDeleteId);
            setConfirmDeleteId(null);
            loadData();
        }
    };

    const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Users className="text-emerald-500"/> Clientes & Fornecedores</h1>
                <Button className="gap-2" onClick={() => { setEditingContact(undefined); setIsModalOpen(true); }}><Plus size={16}/> Novo Contato</Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input placeholder="Buscar por nome, e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {/* LIST / TABLE VIEW */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/80 text-slate-200 uppercase text-xs font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Nome / Razão Social</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Contato</th>
                            <th className="px-6 py-4">Documento</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                                    Nenhum contato encontrado.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(c => (
                                <tr key={c.id} className="hover:bg-slate-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                                                {c.type === 'pj' ? <Building size={16}/> : <UserIcon size={16}/>}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{c.name}</div>
                                                {c.fantasyName && <div className="text-xs text-slate-500">{c.fantasyName}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            <Badge variant={c.scope === 'client' ? 'success' : c.scope === 'supplier' ? 'warning' : 'default'}>
                                                {c.scope === 'client' ? 'Cliente' : c.scope === 'supplier' ? 'Fornecedor' : 'Ambos'}
                                            </Badge>
                                            <span className="text-[10px] text-slate-500 uppercase">{c.type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            {c.email && <div className="flex items-center gap-2 text-xs"><Mail size={12} className="text-slate-500"/> {c.email}</div>}
                                            {c.phone && <div className="flex items-center gap-2 text-xs"><Phone size={12} className="text-slate-500"/> {c.phone}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                                        {c.document || '--'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => { setEditingContact(c); setIsModalOpen(true); }} 
                                                className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={16}/>
                                            </button>
                                            <button 
                                                onClick={() => setConfirmDeleteId(c.id)} 
                                                className="p-1.5 rounded text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} initialData={editingContact} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Contato" />
        </div>
    );
};
