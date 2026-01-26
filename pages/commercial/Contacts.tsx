
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Contact } from '../../types';
import { Loader, Card, Button, Input, Badge, Avatar } from '../../components/Shared';
import { ContactModal } from '../../components/CommercialModals';
import { ContactsReportModal } from '../../components/Reports/ContactsReportModal';
import { translateContactScope, translatePersonType } from '../../utils/i18n';
import { ConfirmationModal } from '../../components/Modals';
import { Users, Search, Plus, Phone, Mail, MapPin, Building, User as UserIcon, Trash2, Edit2, FileText } from 'lucide-react';

export const ContactsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getContacts();
            setContacts(data);
        } catch (e) { console.error(e); }
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

    // Split Data
    const suppliers = filtered.filter(c => c.scope === 'supplier' || c.scope === 'both');
    const clients = filtered.filter(c => c.scope === 'client' || c.scope === 'both');

    if (loading) return <Loader />;

    const ContactTable = ({ items, type }: { items: Contact[], type: 'supplier' | 'client' }) => (
        <Card className="rounded-xl border border-border overflow-hidden flex flex-col h-full shadow-sm" variant="solid">
            <div className={`px-4 py-3 border-b border-border flex justify-between items-center ${type === 'client' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                <div className="flex items-center gap-2 font-bold text-foreground">
                    {type === 'client' ? <UserIcon size={18} className="text-emerald-500" /> : <Building size={18} className="text-amber-500" />}
                    {type === 'client' ? 'Clientes' : 'Fornecedores'}
                </div>
                <Badge variant="neutral">{items.length}</Badge>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left text-sm text-muted-foreground">
                    <thead className="bg-secondary/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="px-4 py-3">Nome</th>
                            <th className="px-4 py-3 hidden sm:table-cell">Contato</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {items.length === 0 ? (
                            <tr><td colSpan={3} className="px-6 py-12 text-center text-muted-foreground italic">Nenhum registro.</td></tr>
                        ) : items.map(c => (
                            <tr key={c.id} className="hover:bg-secondary/30 transition-colors group">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                            {c.type === 'pj' ? <Building size={14} /> : <UserIcon size={14} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium text-foreground truncate max-w-[150px] lg:max-w-[200px]" title={c.name}>{c.name}</div>
                                            {c.fantasyName && <div className="text-[10px] text-muted-foreground truncate">{c.fantasyName}</div>}
                                            {c.scope === 'both' && <span className="text-[9px] bg-secondary px-1 rounded text-muted-foreground mt-0.5 inline-block">Ambos</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 hidden sm:table-cell">
                                    <div className="space-y-0.5">
                                        {c.phone && <div className="text-xs flex items-center gap-1.5"><Phone size={10} className="text-muted-foreground" /> {c.phone}</div>}
                                        {c.email && <div className="text-xs flex items-center gap-1.5 truncate max-w-[150px]" title={c.email}><Mail size={10} className="text-muted-foreground" /> {c.email}</div>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingContact(c); setIsModalOpen(true); }} className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-500 rounded transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={() => setConfirmDeleteId(c.id)} className="p-1.5 hover:bg-rose-500/20 hover:text-rose-500 rounded transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );

    return (
        <div className="h-full flex flex-col overflow-hidden pb-4 pr-2 bg-background">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3"><Users className="text-emerald-500" /> Contatos</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" className="gap-2" onClick={() => setIsReportOpen(true)}><FileText size={16} /> Relatórios</Button>
                    <Button className="gap-2" onClick={() => { setEditingContact(undefined); setIsModalOpen(true); }}><Plus size={16} /> Novo Contato</Button>
                </div>
            </div>

            <div className="relative mb-6 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar por nome, e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border text-foreground focus:border-primary" />
            </div>

            {/* SPLIT VIEW */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ContactTable items={suppliers} type="supplier" />
                <ContactTable items={clients} type="client" />
            </div>

            <ContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} initialData={editingContact} />
            <ContactsReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} contacts={contacts} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Contato" />
        </div>
    );
};
