
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
            <div className={`px-4 py-2 border-b border-border flex justify-between items-center shrink-0 ${type === 'client' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                    {type === 'client' ? <UserIcon size={16} className="text-emerald-500" /> : <Building size={16} className="text-amber-500" />}
                    {type === 'client' ? 'Clientes' : 'Fornecedores'}
                </div>
                <Badge variant="neutral" className="text-xs px-1.5 py-0">{items.length}</Badge>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 p-0">
                <table className="w-full text-left text-xs text-muted-foreground">
                    <thead className="bg-secondary/50 text-muted-foreground uppercase text-[9px] font-bold tracking-wider sticky top-0 backdrop-blur-sm z-10 border-b border-border/50">
                        <tr>
                            <th className="px-3 py-2">Nome</th>
                            <th className="px-3 py-2 hidden sm:table-cell">Contato</th>
                            <th className="px-3 py-2 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {items.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic">Nenhum registro.</td></tr>
                        ) : items.map(c => (
                            <tr key={c.id} className="hover:bg-secondary/30 transition-colors group">
                                <td className="px-3 py-1.5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-md bg-secondary/50 flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                            {c.type === 'pj' ? <Building size={12} /> : <UserIcon size={12} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium text-foreground truncate max-w-[140px] lg:max-w-[180px]" title={c.name}>{c.name}</div>
                                            {(c.fantasyName || c.scope === 'both') && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {c.fantasyName && <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{c.fantasyName}</span>}
                                                    {c.scope === 'both' && <span className="text-[8px] bg-secondary border border-border/50 px-1 rounded text-muted-foreground uppercase tracking-tight">Ambos</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-1.5 hidden sm:table-cell">
                                    <div className="space-y-0.5">
                                        {c.phone && <div className="text-[10px] flex items-center gap-1.5 font-mono opacity-80"><Phone size={9} className="text-muted-foreground" /> {c.phone}</div>}
                                        {c.email && <div className="text-[10px] flex items-center gap-1.5 truncate max-w-[140px] opacity-80" title={c.email}><Mail size={9} className="text-muted-foreground" /> {c.email}</div>}
                                    </div>
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingContact(c); setIsModalOpen(true); }} className="p-1 hover:bg-emerald-500/20 hover:text-emerald-500 rounded.md transition-colors"><Edit2 size={13} /></button>
                                        <button onClick={() => setConfirmDeleteId(c.id)} className="p-1 hover:bg-rose-500/20 hover:text-rose-500 rounded.md transition-colors"><Trash2 size={13} /></button>
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
        <div className="h-full flex flex-col overflow-hidden p-4 pt-1 bg-background select-none">
            {/* COMPACT HEADER */}
            <div className="flex justify-between items-center mb-3 shrink-0 h-10">
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2"><Users size={18} className="text-emerald-500" /> Contatos</h1>
                <div className="flex gap-2">
                    <div className="relative w-64 group">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" size={14} />
                        <Input
                            placeholder="Buscar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-muted/40 border-transparent hover:bg-muted/60 focus:bg-background focus:border-emerald-500/50 transition-all rounded-lg"
                        />
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs" onClick={() => setIsReportOpen(true)}><FileText size={14} /> Relatórios</Button>
                    <Button size="sm" className="h-8 gap-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm" onClick={() => { setEditingContact(undefined); setIsModalOpen(true); }}><Plus size={14} /> Novo</Button>
                </div>
            </div>

            {/* FULL HEIGHT SPLIT VIEW */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 pb-0">
                <ContactTable items={suppliers} type="supplier" />
                <ContactTable items={clients} type="client" />
            </div>

            <ContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} initialData={editingContact} />
            <ContactsReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} contacts={contacts} />
            <ConfirmationModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={handleDelete} title="Excluir Contato" />
        </div>
    );
};
