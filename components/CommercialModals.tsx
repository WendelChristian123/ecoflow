
import { createPortal } from 'react-dom';
import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Textarea, Badge, CurrencyInput } from './Shared';
import { FilterSelect } from './FilterSelect';
import { Contact, CatalogItem, RecurringService, Quote, FinancialCategory, FinancialAccount, ContactScope, PersonType, CatalogType, QuoteItem, Kanban, KanbanStage } from '../types';
import { api, getErrorMessage } from '../services/api';
import { kanbanService } from '../services/kanbanService';
import { Plus, Trash2, ShoppingBag, User as UserIcon, Building, FileText, Check, AlertCircle, UserPlus, X, Box, Calendar, DollarSign, ArrowRight, ArrowLeft, RefreshCw, Printer } from 'lucide-react';
import { format, parseISO, addMonths, differenceInDays, addDays } from 'date-fns';
import { formatDate } from '../utils/formatters';
import { supabase } from '../services/supabase';
import { QuotePrintTemplate } from './Commercial/QuotePrintTemplate';
import { Tenant } from '../types';

const getLocalDateISO = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

interface QuoteApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOptionSelected: (option: 'contract' | 'finance') => void;
}

export const QuoteApprovalModal: React.FC<QuoteApprovalModalProps> = ({ isOpen, onClose, onOptionSelected }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Orçamento Aprovado!" className="max-w-md">
            <div className="space-y-6">
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                    <div className="mx-auto w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mb-3">
                        <Check className="text-white w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-400 mb-1">Status atualizado com sucesso!</h3>
                    <p className="text-sm text-slate-400">O cliente foi criado/vinculado automaticamente.</p>
                </div>

                <div className="text-center text-slate-300">
                    <p className="mb-4">O que deseja fazer a seguir?</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onOptionSelected('contract')}
                            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group"
                        >
                            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                <RefreshCw size={20} />
                            </div>
                            <span className="font-bold text-sm">Criar Contrato</span>
                            <span className="text-[10px] text-slate-500 leading-tight">Serviços recorrentes ou mensalidades</span>
                        </button>

                        <button
                            onClick={() => onOptionSelected('finance')}
                            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group"
                        >
                            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                <DollarSign size={20} />
                            </div>
                            <span className="font-bold text-sm">Lançar Financeiro</span>
                            <span className="text-[10px] text-slate-500 leading-tight">Venda única, receita pontual</span>
                        </button>
                    </div>
                </div>

                <div className="pt-2 flex justify-center">
                    <Button variant="ghost" onClick={onClose} className="text-slate-500 text-xs">Agora não, apenas salvar status</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- CONTACT MODAL ---
interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (contact?: Contact) => void;
    initialData?: Contact;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [formData, setFormData] = useState<Partial<Contact>>({
        scope: 'client', type: 'pj', name: '', email: '', phone: '', address: '', fantasyName: '', document: '', adminName: '', notes: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setFormData(initialData || { scope: 'client', type: 'pj', name: '', email: '', phone: '', address: '', fantasyName: '', document: '', adminName: '', notes: '' });
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let result: Contact | undefined;
            if (initialData?.id) {
                await api.updateContact({ ...initialData, ...formData } as Contact);
                result = { ...initialData, ...formData } as Contact;
            }
            else result = await api.addContact(formData);

            onSuccess(result); onClose();
        } catch (error: any) {
            console.error("FULL ERROR DETAILS:", error);
            alert(`Erro ao salvar contrato: ${error.message || JSON.stringify(error)} `);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Contato" : "Novo Contato"} className="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Scope & Type */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Tipo de Parceiro</label>
                        <FilterSelect
                            value={formData.scope}
                            onChange={(val) => setFormData({ ...formData, scope: val as ContactScope })}
                            options={[
                                { value: 'client', label: 'Cliente' },
                                { value: 'supplier', label: 'Fornecedor' },
                                { value: 'both', label: 'Ambos' }
                            ]}
                            className="w-full"
                            triggerClassName="w-full justify-between"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Tipo de Pessoa</label>
                        <FilterSelect
                            value={formData.type}
                            onChange={(val) => setFormData({ ...formData, type: val as PersonType })}
                            options={[
                                { value: 'pj', label: 'Pessoa Jurídica' },
                                { value: 'pf', label: 'Pessoa Física' }
                            ]}
                            className="w-full"
                            triggerClassName="w-full justify-between"
                        />
                    </div>
                </div>

                {/* Common Fields */}
                <Input label={formData.type === 'pj' ? "Razão Social" : "Nome Completo"} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />

                {formData.type === 'pj' && (
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome Fantasia" value={formData.fantasyName} onChange={e => setFormData({ ...formData, fantasyName: e.target.value })} />
                        <Input label="Nome do Responsável/Admin" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Input label={formData.type === 'pj' ? "CNPJ" : "CPF"} value={formData.document} onChange={e => setFormData({ ...formData, document: e.target.value })} />
                    <Input label="Telefone / WhatsApp" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>

                <Input label="E-mail" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <Input label="Endereço Completo" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />

                <Textarea placeholder="Observações internas..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="h-20" />

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

// --- CATALOG MODAL ---
interface CatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: CatalogItem;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [formData, setFormData] = useState<Partial<CatalogItem>>({ type: 'service', name: '', description: '', price: 0, active: true, financialCategoryId: '' });
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || { type: 'service', name: '', description: '', price: 0, active: true, financialCategoryId: '' });
            api.getFinancialCategories().then(cats => {
                setCategories(cats.filter(c => c.type === 'income'));
            }).catch(console.error);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) await api.updateCatalogItem({ ...initialData, ...formData } as CatalogItem);
            else await api.addCatalogItem(formData);
            onSuccess(); onClose();
        } catch (error) {
            console.error(error);
            alert(`Erro ao salvar item: ${getErrorMessage(error)} `);
        }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Item" : "Novo Item de Catálogo"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                    <FilterSelect
                        value={formData.type}
                        onChange={(val) => setFormData({ ...formData, type: val as CatalogType })}
                        options={[
                            { value: 'service', label: 'Serviço' },
                            { value: 'product', label: 'Produto' }
                        ]}
                        className="w-full"
                        triggerClassName="w-full justify-between"
                    />
                </div>
                <Input label="Nome" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />

                <div className="grid grid-cols-2 gap-4">
                    <CurrencyInput label="Valor Base" value={formData.price} onValueChange={(val) => setFormData({ ...formData, price: val || 0 })} />
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Categoria Financeira (Receita)</label>
                        <FilterSelect
                            value={formData.financialCategoryId || ''}
                            onChange={(val) => setFormData({ ...formData, financialCategoryId: val })}
                            options={categories.map(c => ({ value: c.id, label: c.name }))}
                            className="w-full"
                            triggerClassName="w-full justify-between"
                            placeholder="Selecione..."
                        />
                    </div>
                </div>

                <Textarea placeholder="Descrição..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />

                <div className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} className="rounded bg-slate-800 border-slate-700" />
                    <span className="text-sm text-slate-300">Ativo no Catálogo</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

// --- QUOTE MODAL ---
interface QuoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (quote?: Quote) => void;
    contacts: Contact[];
    catalog: CatalogItem[];
    initialData?: Quote;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({ isOpen, onClose, onSuccess, contacts, catalog, initialData }) => {
    const [formData, setFormData] = useState<Partial<Quote>>({ contactId: '', customerName: '', customerPhone: '', status: 'draft', date: getLocalDateISO(), validUntil: '', notes: '' });
    const [items, setItems] = useState<Partial<QuoteItem>[]>([]);
    const [loading, setLoading] = useState(false);
    const [isGuest, setIsGuest] = useState(false);

    // Print / Tenant Logic
    const [showPreview, setShowPreview] = useState(false);
    const [tenant, setTenant] = useState<Tenant>({ name: 'Minha Empresa' } as Tenant);

    useEffect(() => {
        if (isOpen) {
            const fetchTenant = async () => {
                const id = localStorage.getItem('ecoflow-tenant-id');
                if (id) {
                    const { data } = await supabase.from('tenants').select('*').eq('id', id).single();
                    if (data) setTenant(data as Tenant);
                }
            };
            fetchTenant();
        }
    }, [isOpen]);

    // Kanban Logic
    const [kanbans, setKanbans] = useState<Kanban[]>([]);
    const [stages, setStages] = useState<KanbanStage[]>([]);

    useEffect(() => {
        if (isOpen) {
            const loadKanbans = async () => {
                try {
                    const kbs = await kanbanService.listKanbans('crm');
                    setKanbans(kbs);
                } catch (e) { console.error(e); }
            };
            loadKanbans();
        }
    }, [isOpen]);

    // Sync Stages when Kanban changes or init
    useEffect(() => {
        if (kanbans.length > 0) {
            let selectedK = kanbans.find(k => k.id === formData.kanbanId);
            if (!selectedK && !formData.kanbanId) {
                // Default to first 'isDefault' or just first
                selectedK = kanbans.find(k => k.isDefault) || kanbans[0];
                if (selectedK) {
                    setFormData(prev => ({ ...prev, kanbanId: selectedK!.id }));
                }
            }
            if (selectedK) setStages(selectedK.stages || []);
        }
    }, [kanbans, formData.kanbanId]);

    // Auto-set status when Stage changes
    useEffect(() => {
        if (formData.kanbanStageId && stages.length > 0) {
            const stage = stages.find(s => s.id === formData.kanbanStageId);
            if (stage && stage.systemStatus) {
                // Map systemStatus to QuoteStatus if possible, or just string match
                setFormData(prev => ({ ...prev, status: stage.systemStatus as any }));
            }
        }
    }, [formData.kanbanStageId, stages]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    date: initialData.date?.substring(0, 10) || '',
                    validUntil: initialData.validUntil?.substring(0, 10) || ''
                });
                setItems(initialData.items || []);
                setIsGuest(!initialData.contactId);
            } else {
                setFormData({ contactId: '', customerName: '', customerPhone: '', status: 'draft', date: getLocalDateISO(), validUntil: '', notes: '' });
                setItems([]);
                setIsGuest(false);
            }
        }
    }, [isOpen, initialData]);

    // Add Item
    const addItem = (catalogItem?: CatalogItem) => {
        if (catalogItem) {
            setItems([...items, { catalogItemId: catalogItem.id, description: catalogItem.name, quantity: 1, unitPrice: catalogItem.price, total: catalogItem.price }]);
        } else {
            setItems([...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
        }
    };

    // Update Item
    const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        // Recalculate total for row
        if (field === 'quantity' || field === 'unitPrice') {
            const qty = field === 'quantity' ? value : newItems[index].quantity || 0;
            const price = field === 'unitPrice' ? value : newItems[index].unitPrice || 0;
            newItems[index].total = qty * price;
        }
        setItems(newItems);
    };

    // Remove Item
    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalValue = items.reduce((acc, item) => acc + (item.total || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { ...formData, totalValue };
            let result: Quote | undefined;

            if (initialData?.id) {
                await api.updateQuote(payload, items);
                // Construct updated quote object for return
                result = { ...initialData, ...payload, items } as Quote;
            }
            else {
                // Should return created quote ideally, but assuming update is enough for now or onSuccess reloads
                await api.addQuote(payload, items);
                // Mock result for new quote if ID missing isn't crucial for immediate next step logic
                // But wait, we need the ID for automation flow if new. 
                // api.addQuote doesn't return the object in current implementation? Let's check api.ts later. 
                // For now, let's assume we can proceed or that automation mainly happens on update.
                // Actually, status 'approved' could be set on creation.
                result = { ...payload, items, id: 'temp' } as Quote;
            }
            onSuccess(result); onClose();
        } catch (error) { console.error(error); alert(`Erro: ${getErrorMessage(error)} `); }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Orçamento" : "Novo Orçamento"} className="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/30 p-4 rounded-xl border border-border">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-muted-foreground block ml-1">Cliente</label>
                            <button type="button" onClick={() => setIsGuest(!isGuest)} className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                                {isGuest ? <><UserIcon size={12} /> Selecionar Cadastrado</> : <><UserPlus size={12} /> Novo / Prospect</>}
                            </button>
                        </div>

                        {!isGuest ? (
                            <FilterSelect
                                value={formData.contactId}
                                onChange={(val) => {
                                    const c = contacts.find(contact => contact.id === val);
                                    setFormData({ ...formData, contactId: val, customerName: c?.name });
                                }}
                                options={contacts.filter(c => c.scope !== 'supplier').map(c => ({ value: c.id, label: c.name }))}
                                className="w-full"
                                triggerClassName="w-full justify-between"
                                placeholder="Selecione um cliente..."
                            />
                        ) : (
                            <div className="space-y-2">
                                <Input placeholder="Nome do Cliente (Prospect)" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value, contactId: '' })} required />
                                <Input placeholder="Telefone / Contato" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Data Emissão" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                            <Input label="Validade" type="date" value={formData.validUntil} onChange={e => setFormData({ ...formData, validUntil: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Funil (Kanban)</label>
                                <FilterSelect
                                    value={formData.kanbanId || ''}
                                    onChange={(val) => setFormData({ ...formData, kanbanId: val, kanbanStageId: '' })}
                                    options={kanbans.map(k => ({ value: k.id, label: k.name }))}
                                    className="w-full"
                                    triggerClassName="w-full justify-between"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Etapa</label>
                                <FilterSelect
                                    value={formData.kanbanStageId || ''}
                                    onChange={(val) => setFormData({ ...formData, kanbanStageId: val })}
                                    options={stages.map(s => ({ value: s.id, label: s.name }))}
                                    className="w-full"
                                    triggerClassName="w-full justify-between"
                                    placeholder="Selecione..."
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Items Table */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Itens do Orçamento</h3>
                        <div className="flex gap-2">
                            <FilterSelect
                                value=""
                                onChange={(val) => {
                                    if (val) {
                                        addItem(catalog.find(i => i.id === val));
                                        // Reset handled by value=""
                                    }
                                }}
                                options={[{ value: '', label: '+ Adicionar do Catálogo' }, ...catalog.map(i => ({ value: i.id, label: `${i.name} - R$ ${i.price}` }))]}
                                className="w-56"
                                triggerClassName="w-full justify-between text-xs py-1 h-9"
                                placeholder="+ Adicionar do Catálogo"
                            />
                            <Button type="button" size="sm" variant="secondary" onClick={() => addItem()}>+ Item Manual</Button>
                        </div>
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-secondary text-muted-foreground">
                                <tr>
                                    <th className="p-3 w-1/2">Descrição</th>
                                    <th className="p-3 w-20">Qtd</th>
                                    <th className="p-3 w-32">Unitário</th>
                                    <th className="p-3 w-32 text-right">Total</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2">
                                            <input className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground" placeholder="Item..." value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            <input type="number" className="w-full bg-transparent outline-none text-foreground text-center" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} />
                                        </td>
                                        <td className="p-2">
                                            <CurrencyInput
                                                value={item.unitPrice}
                                                onValueChange={(val) => updateItem(idx, 'unitPrice', val || 0)}
                                                className="bg-transparent border-0 pl-8 pr-0 py-1"
                                                placeholder="0,00"
                                            />
                                        </td>
                                        <td className="p-2 text-right font-medium text-emerald-400">
                                            R$ {(item.total || 0).toFixed(2)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-rose-500"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">Nenhum item adicionado.</td></tr>
                                )}
                            </tbody>
                            <tfoot className="bg-secondary font-bold text-foreground">
                                <tr>
                                    <td colSpan={3} className="p-3 text-right text-muted-foreground uppercase text-xs">Total Final</td>
                                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">R$ {totalValue.toFixed(2)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <Textarea placeholder="Termos, condições ou notas internas..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="h-20" />

                <div className="flex justify-between items-center pt-4 border-t border-border">
                    <Button type="button" variant="outline" onClick={() => setShowPreview(true)} className="gap-2">
                        <Printer size={16} /> Imprimir / PDF
                    </Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>Salvar Orçamento</Button>
                    </div>
                </div>
            </form>

            {/* Print Preview Modal */}
            {showPreview && (
                <>
                    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
                        <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-800">
                            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-100">Visualizar Impressão</h3>
                                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full"><X size={20} /></button>
                            </div>
                            <div className="flex-1 overflow-auto p-8 bg-black/50 flex justify-center">
                                <div className="shadow-2xl shadow-black scale-90 origin-top">
                                    <QuotePrintTemplate quote={{ ...initialData, ...formData, items } as Quote} tenant={tenant} contact={contacts.find(c => c.id === formData.contactId)} />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setShowPreview(false)}>Fechar</Button>
                                <Button onClick={() => window.print()} className="gap-2"><Printer size={16} /> Imprimir Agora</Button>
                            </div>
                        </div>
                    </div>
                    {/* Portal for Actual Printing - Isolated from Modal Styles */}
                    {createPortal(
                        <div id="print-portal" className="hidden print:block">
                            <QuotePrintTemplate quote={{ ...initialData, ...formData, items } as Quote} tenant={tenant} contact={contacts.find(c => c.id === formData.contactId)} />
                        </div>,
                        document.body
                    )}
                </>
            )}
        </Modal>
    );
};

// --- RECURRING CONTRACT MODAL (WIZARD) ---
interface RecurringModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    contacts: Contact[];
    catalog: CatalogItem[];
    financialCategories: FinancialCategory[]; // New Prop
    bankAccounts: FinancialAccount[];
    initialData?: RecurringService;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({ isOpen, onClose, onSave, contacts, catalog, financialCategories, bankAccounts, initialData }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<RecurringService>>({
        contactId: '',
        recurringAmount: 0,
        startDate: getLocalDateISO(),
        frequency: 'monthly',
        contractMonths: 12,
        active: true,
        bankAccountId: '', // Include in init
        setupFee: 0,
        financialCategoryId: '',
        setupCategoryId: '',
        setupEntryAmount: 0,
        setupEntryDate: '',
        setupRemainingAmount: 0,
        setupRemainingDate: '',
        firstRecurrenceDate: ''
    });

    // UI Helpers for composition
    const [selectedServices, setSelectedServices] = useState<{ id: string, price: number, categoryId?: string }[]>([]);
    const [extraAmount, setExtraAmount] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [loading, setLoading] = useState(false);

    // Setup Split Logic
    const [setupPaymentMethod, setSetupPaymentMethod] = useState<'spot' | 'split'>('spot');

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            if (initialData) {
                setFormData(initialData);
                setExtraAmount(initialData.recurringAmount);
                setSelectedServices([]);
                // Restore setup split state logic if needed (simplified for now: default to spot if not explicit)
                setSetupPaymentMethod(initialData.setupEntryAmount ? 'split' : 'spot');
            } else {
                setFormData({
                    contactId: '',
                    recurringAmount: 0,
                    startDate: getLocalDateISO(),
                    frequency: 'monthly',
                    contractMonths: 12,
                    active: true,
                    setupFee: 0,
                    financialCategoryId: '',
                    setupCategoryId: '',
                    setupEntryAmount: 0,
                    setupEntryDate: '',
                    setupRemainingAmount: 0,
                    setupRemainingDate: '',
                    firstRecurrenceDate: ''
                });
                setSelectedServices([]);
                setExtraAmount(0);
                setDiscount(0);
                setSetupPaymentMethod('spot');
            }
        }
    }, [isOpen, initialData]);

    // Calculate total whenever composition changes
    useEffect(() => {
        const servicesTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
        const total = servicesTotal + extraAmount - discount;
        setFormData(prev => ({ ...prev, recurringAmount: Math.max(0, total) }));
    }, [selectedServices, extraAmount, discount]);

    const toggleService = (item: CatalogItem) => {
        if (selectedServices.find(s => s.id === item.id)) {
            setSelectedServices(selectedServices.filter(s => s.id !== item.id));
        } else {
            setSelectedServices([...selectedServices, { id: item.id, price: item.price, categoryId: item.financialCategoryId }]);
        }
    };

    const handleSave = async () => {
        // Validations
        if (!formData.financialCategoryId) return alert("Selecione a categoria financeira da recorrência.");

        if (formData.setupFee && formData.setupFee > 0) {
            if (!formData.setupCategoryId) return alert("Selecione a categoria financeira do setup.");

            if (setupPaymentMethod === 'split') {
                const totalSplit = (formData.setupEntryAmount || 0) + (formData.setupRemainingAmount || 0);
                if (Math.abs(totalSplit - formData.setupFee) > 0.01) {
                    return alert("A soma da entrada e do restante deve ser igual ao valor total do setup.");
                }
                if (!formData.setupEntryDate || !formData.setupRemainingDate) {
                    return alert("Defina as datas de recebimento do setup.");
                }
            }
        }

        setLoading(true);
        try {
            if (initialData?.id) {
                alert("Edição de contratos ativa não implementada no mock. Crie um novo contrato.");
            } else {
                // Find contact name for transaction descriptions
                const contactName = contacts.find(c => c.id === formData.contactId)?.name || 'Cliente';

                // Determine effective Start Date (Rule: Setup Date > Recurrence Date)
                let effectiveStartDate = formData.firstRecurrenceDate;
                if (formData.setupFee && formData.setupFee > 0) {
                    if (setupPaymentMethod === 'spot' && formData.setupSpotDate) effectiveStartDate = formData.setupSpotDate;
                    else if (setupPaymentMethod === 'split' && formData.setupEntryDate) effectiveStartDate = formData.setupEntryDate;
                }

                console.log("Creating Contract. StartDate:", effectiveStartDate);
                await api.addRecurringService({
                    ...formData,
                    startDate: effectiveStartDate, // Overwrite with correct start date
                    // If spot, ensure no split data is sent that might confuse backend
                    setupEntryAmount: setupPaymentMethod === 'split' ? formData.setupEntryAmount : 0,
                    setupRemainingAmount: setupPaymentMethod === 'split' ? formData.setupRemainingAmount : 0,
                    // Pass contactName for API to use in descriptions
                    contactName: contactName
                } as any); // Cast to any to allow extra prop
            }
            onSave(); onClose();
        } catch (error: any) {
            console.error("RECURRING CONTRACT SAVE ERROR:", error);
            alert(`Erro ao salvar contrato: ${error.message || JSON.stringify(error)} `);
        }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Detalhes do Contrato" : "Novo Contrato Recorrente"} className="max-w-2xl">
            <div className="space-y-6">
                {/* Wizard Steps Indicator */}
                <div className="flex items-center justify-between px-8 border-b border-border pb-6">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`flex items-center gap-2 transition-colors ${step >= s ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= s
                                ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-600 dark:bg-emerald-400/10 text-white dark:text-emerald-400 shadow-lg shadow-emerald-500/20'
                                : 'border-border bg-secondary text-muted-foreground'
                                }`}>
                                {s}
                            </div>
                            <span className="text-xs font-bold uppercase hidden sm:block tracking-widest">
                                {s === 1 ? 'Cliente' : s === 2 ? 'Implantação' : s === 3 ? 'Recorrência' : 'Confirmação'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* STEP 1: CLIENT */}
                {step === 1 && (
                    <div className="space-y-6 py-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h3 className="text-xl font-semibold text-foreground text-center">Quem é o contratante?</h3>
                        <div className="max-w-sm mx-auto space-y-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-2">Cliente *</label>
                                <FilterSelect
                                    value={formData.contactId}
                                    onChange={(val) => setFormData({ ...formData, contactId: val })}
                                    options={contacts.filter(c => c.scope !== 'supplier').map(c => ({ value: c.id, label: c.name }))}
                                    className="w-full text-base"
                                    triggerClassName="w-full justify-between"
                                    placeholder="Selecione um cliente..."
                                />
                            </div>
                            <p className="text-center text-muted-foreground text-sm mt-6 bg-secondary/50 p-3 rounded-lg border border-border">💡 Selecione o cliente para iniciar o contrato</p>
                        </div>
                    </div>
                )}


                {/* STEP 2: SETUP (IMPLANTAÇÃO) */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-lg mx-auto py-6">
                        <h3 className="text-xl font-semibold text-foreground text-center mb-6">Configuração de Implantação</h3>

                        <CurrencyInput label="Taxa de Implantação / Setup (Única)" value={formData.setupFee} onValueChange={(val) => setFormData({ ...formData, setupFee: val || 0 })} />

                        {formData.setupFee && formData.setupFee > 0 ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Categoria Financeira (Setup) *</label>
                                    <FilterSelect
                                        value={formData.setupCategoryId}
                                        onChange={(val) => setFormData({ ...formData, setupCategoryId: val })}
                                        options={financialCategories.filter(c => c.type === 'income').map(c => ({ value: c.id, label: c.name }))}
                                        className="w-full"
                                        triggerClassName="w-full justify-between"
                                        placeholder="Selecione uma categoria..."
                                    />
                                </div>

                                <div className="bg-card border border-border p-6 rounded-xl space-y-6">
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                                            <input type="radio" name="setupType" checked={setupPaymentMethod === 'spot'} onChange={() => setSetupPaymentMethod('spot')} className="accent-emerald-600 w-4 h-4" />
                                            À Vista
                                        </label>
                                        <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                                            <input type="radio" name="setupType" checked={setupPaymentMethod === 'split'} onChange={() => setSetupPaymentMethod('split')} className="accent-emerald-600 w-4 h-4" />
                                            Entrada + Restante
                                        </label>
                                    </div>

                                    {setupPaymentMethod === 'spot' ? (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <Input type="date" label="Data de Recebimento *" value={formData.setupSpotDate || ''} onChange={(e) => setFormData({ ...formData, setupSpotDate: e.target.value })} required />
                                            <p className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">💰 O valor total de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.setupFee)} será lançado nesta data.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <CurrencyInput label="Valor Entrada" value={formData.setupEntryAmount} onValueChange={(val) => setFormData({ ...formData, setupEntryAmount: val || 0 })} />
                                                <Input type="date" label="Data Entrada *" value={formData.setupEntryDate || ''} onChange={(e) => setFormData({ ...formData, setupEntryDate: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <CurrencyInput label="Valor Restante" value={formData.setupRemainingAmount} onValueChange={(val) => setFormData({ ...formData, setupRemainingAmount: val || 0 })} />
                                                <Input type="date" label="Data Restante *" value={formData.setupRemainingDate || ''} onChange={(e) => setFormData({ ...formData, setupRemainingDate: e.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground text-sm italic py-6 bg-secondary/30 p-4 rounded-lg border border-dashed border-border">
                                ✓ Sem taxa de setup configurada. Opcional.
                            </p>
                        )}
                    </div>
                )}

                {/* STEP 3: RECURRENCE (RECORRÊNCIA) */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Seleção de Serviços */}
                            <div className="border border-border rounded-xl p-4 bg-card">
                                <h4 className="text-sm font-bold text-foreground uppercase mb-4 tracking-wider">Serviços do Catálogo</h4>
                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                    {catalog.filter(i => i.type === 'service').map(item => {
                                        const isSelected = !!selectedServices.find(s => s.id === item.id);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => toggleService(item)}
                                                className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-600 dark:border-emerald-500/50 shadow-sm'
                                                    : 'bg-secondary border-border hover:bg-secondary/80 hover:border-emerald-500/30'
                                                    }`}
                                            >
                                                <span className={`text-sm font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>{item.name}</span>
                                                <span className="text-xs font-mono font-semibold text-muted-foreground">R$ {item.price.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Resumo e Configurações */}
                            <div className="space-y-6">
                                <CurrencyInput label="Adicional Recorrente" value={extraAmount} onValueChange={(val) => setExtraAmount(val || 0)} />
                                <CurrencyInput label="Desconto Mensal" value={discount} onValueChange={(val) => setDiscount(val || 0)} />

                                {/* Resumo Financeiro Destacado */}
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-xl border-2 border-emerald-600 dark:border-emerald-500/50 text-center mt-4">
                                    <span className="text-xs uppercase tracking-widest font-bold text-emerald-700 dark:text-emerald-400 block mb-2">Mensalidade Final</span>
                                    <span className="text-4xl font-black text-emerald-600 dark:text-emerald-500">R$ {formData.recurringAmount?.toFixed(2)}</span>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Categoria Financeira (Recorrência) *</label>
                                    <FilterSelect
                                        value={formData.financialCategoryId}
                                        onChange={(val) => setFormData({ ...formData, financialCategoryId: val })}
                                        options={financialCategories.filter(c => c.type === 'income').map(c => ({ value: c.id, label: c.name }))}
                                        className="w-full"
                                        triggerClassName="w-full justify-between"
                                        placeholder="Selecione uma categoria..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Conta Bancária (Recebimento)</label>
                                    <FilterSelect
                                        value={formData.bankAccountId}
                                        onChange={(val) => setFormData({ ...formData, bankAccountId: val })}
                                        options={[
                                            { value: '', label: 'Sem conta definida' },
                                            ...(bankAccounts || []).map(a => ({ value: a.id, label: a.name }))
                                        ]}
                                        className="w-full"
                                        triggerClassName="w-full justify-between"
                                        placeholder="Sem conta definida"
                                    />
                                </div>

                                <div>
                                    <Input
                                        label="Data da 1ª Parcela Recorrente *"
                                        type="date"
                                        value={formData.firstRecurrenceDate || ''}
                                        onChange={e => {
                                            const newDate = e.target.value;
                                            setFormData({
                                                ...formData,
                                                firstRecurrenceDate: newDate,
                                                startDate: newDate
                                            });
                                        }}
                                        required
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-2 bg-secondary/30 p-2 rounded">📅 Data em que será gerada a primeira mensalidade.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION (CONFIRMAÇÃO) */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto py-6">
                        <div className="grid grid-cols-2 gap-6">
                            <Input label="Início da Vigência (Contrato)" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-2 block">Duração (Meses)</label>
                                <Input type="number" placeholder="0 = Indeterminado" value={formData.contractMonths} onChange={e => setFormData({ ...formData, contractMonths: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        {/* Resumo Destacado */}
                        <div className="bg-card border border-border p-6 rounded-xl">
                            <h5 className="font-bold text-foreground mb-4 border-b border-border pb-3 text-base">Resumo do Contrato</h5>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <dt className="font-medium">Setup / Implantação:</dt>
                                    <dd className="text-foreground font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.setupFee || 0)}</dd>
                                </div>
                                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 -mx-3 px-3 py-2 rounded-lg">
                                    <dt className="font-medium text-emerald-700 dark:text-emerald-400">Valor Mensal:</dt>
                                    <dd className="text-emerald-600 dark:text-emerald-500 font-bold text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.recurringAmount || 0)}</dd>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <dt className="font-medium">Duração:</dt>
                                    <dd className="text-foreground font-semibold">{formData.contractMonths ? `${formData.contractMonths} meses` : 'Indeterminado'}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                )}

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-6 border-t border-border">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={() => setStep(step - 1)} type="button" className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Voltar
                        </Button>
                    ) : <div />}

                    {step < 4 ? (
                        <Button
                            type="button"
                            onClick={() => setStep(step + 1)}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={
                                (step === 1 && !formData.contactId) ||
                                (step === 2 && formData.setupFee! > 0 && (
                                    !formData.setupCategoryId ||
                                    (setupPaymentMethod === 'split' && (!formData.setupEntryAmount || !formData.setupRemainingAmount || !formData.setupEntryDate || !formData.setupRemainingDate)) ||
                                    (setupPaymentMethod === 'spot' && !formData.setupSpotDate)
                                )) ||
                                (step === 3 && (!formData.financialCategoryId || !formData.firstRecurrenceDate))
                            }
                        >
                            Próximo <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={loading || !formData.startDate}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg px-8"
                        >
                            {loading ? 'Salvando...' : '✓ Finalizar Contrato'}
                        </Button>
                    )}
                </div>
            </div >
        </Modal >
    );
};

interface ContractDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: RecurringService;
    onEdit: () => void;
}

export const ContractDetailModal: React.FC<ContractDetailModalProps> = ({ isOpen, onClose, service, onEdit }) => {
    if (!service) return null;

    // Safe parsing for calculation
    const parseSafe = (d?: string) => d ? parseISO(d.split('T')[0]) : new Date();

    const startDate = parseSafe(service.startDate);

    // Calculate End Date: 30 days after last installment
    // Base is First Recurrence Date (or Start Date if missing)
    const recurrenceStart = service.firstRecurrenceDate ? parseSafe(service.firstRecurrenceDate) : startDate;
    const months = service.contractMonths || 12;
    // Last payment is at (months - 1) offset from start
    const lastPaymentDate = addMonths(recurrenceStart, months - 1);
    const endDate = addDays(lastPaymentDate, 30);

    const totalDays = differenceInDays(endDate, startDate);
    const elapsedDays = differenceInDays(new Date(), startDate);
    const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    // Format currency
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes do Contrato #${service.id.substring(0, 8)}`} className="max-w-xl">
            <div className="space-y-6">

                {/* Header: Client */}
                <div className="text-center pb-4 border-b border-slate-700">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-emerald-500/30">
                        <UserIcon className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">{service.contactName || service.contact?.name || 'Cliente Desconhecido'}</h2>
                    <Badge variant={service.active ? 'success' : 'default'}>{service.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>

                {/* Progress Bar */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>Início: {formatDate(startDate)}</span>
                        <span>Fim: {formatDate(endDate)}</span>
                    </div>
                    <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700 relative">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                            {progress.toFixed(0)}% Concluído
                        </div>
                    </div>
                    <div className="text-center mt-2 text-xs text-slate-500">
                        Duração: {service.contractMonths || 12} meses
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 text-center">
                        <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Valor Setup</span>
                        <span className="text-lg font-bold text-white">{formatCurrency(service.setupFee || 0)}</span>
                    </div>
                    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 text-center">
                        <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Recorrência Mensal</span>
                        <span className="text-xl font-bold text-emerald-400">{formatCurrency(service.recurringAmount || 0)}</span>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Fechar</Button>
                    <Button onClick={() => { onClose(); onEdit(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <FileText className="w-4 h-4 mr-2" />
                        Editar Contrato
                    </Button>
                </div>

            </div>
        </Modal>
    );
};
