
import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Select, Textarea, Badge, CurrencyInput } from './Shared';
import { Contact, CatalogItem, RecurringService, Quote, FinancialCategory, FinancialAccount, ContactScope, PersonType, CatalogType, QuoteItem } from '../types';
import { api, getErrorMessage } from '../services/api';
import { Plus, Trash2, ShoppingBag, User as UserIcon, Building, FileText, Check, AlertCircle, UserPlus, X, Box, Calendar, DollarSign, ArrowRight, ArrowLeft } from 'lucide-react';
import { format, parseISO, addMonths, differenceInDays, addDays } from 'date-fns';
import { formatDate } from '../utils/formatters';

const getLocalDateISO = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
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
                        <Select value={formData.scope} onChange={e => setFormData({ ...formData, scope: e.target.value as ContactScope })}>
                            <option value="client">Cliente</option>
                            <option value="supplier">Fornecedor</option>
                            <option value="both">Ambos</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Pessoa</label>
                        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <button type="button" onClick={() => setFormData({ ...formData, type: 'pf' })} className={`flex - 1 text - xs py - 1.5 rounded ${formData.type === 'pf' ? 'bg-slate-700 text-white' : 'text-slate-400'} `}>Pessoa Física</button>
                            <button type="button" onClick={() => setFormData({ ...formData, type: 'pj' })} className={`flex - 1 text - xs py - 1.5 rounded ${formData.type === 'pj' ? 'bg-slate-700 text-white' : 'text-slate-400'} `}>Pessoa Jurídica</button>
                        </div>
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
                    <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as CatalogType })}>
                        <option value="service">Serviço</option>
                        <option value="product">Produto</option>
                    </Select>
                </div>
                <Input label="Nome" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />

                <div className="grid grid-cols-2 gap-4">
                    <CurrencyInput label="Valor Base" value={formData.price} onValueChange={(val) => setFormData({ ...formData, price: val || 0 })} />
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Categoria Financeira (Receita)</label>
                        <Select
                            value={formData.financialCategoryId || ''}
                            onChange={e => setFormData({ ...formData, financialCategoryId: e.target.value })}
                            required
                        >
                            <option value="">Selecione...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
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
    onSuccess: () => void;
    contacts: Contact[];
    catalog: CatalogItem[];
    initialData?: Quote;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({ isOpen, onClose, onSuccess, contacts, catalog, initialData }) => {
    const [formData, setFormData] = useState<Partial<Quote>>({ contactId: '', customerName: '', customerPhone: '', status: 'draft', date: getLocalDateISO(), validUntil: '', notes: '' });
    const [items, setItems] = useState<Partial<QuoteItem>[]>([]);
    const [loading, setLoading] = useState(false);
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({ ...initialData, date: initialData.date.substring(0, 10) });
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
            if (initialData?.id) await api.updateQuote(payload, items);
            else await api.addQuote(payload, items);
            onSuccess(); onClose();
        } catch (error) { console.error(error); alert(`Erro: ${getErrorMessage(error)} `); }
        finally { setLoading(false); }
    };

    const handleApproval = async () => {
        if (!initialData?.id) return;
        if (!window.confirm("Aprovar orçamento e gerar venda?")) return;
        try {
            await api.updateQuote({ ...formData, status: 'approved' }, items);

            // Try to generate revenue
            const mainItem = items[0];
            const catItem = catalog.find(c => c.id === mainItem?.catalogItemId);

            await api.addTransaction({
                description: `Venda: ${formData.customerName || 'Cliente'} (Orç #${initialData.id.substring(0, 4)})`,
                amount: totalValue,
                type: 'income',
                date: getLocalDateISO(),
                categoryId: catItem?.financialCategoryId || undefined,
                contactId: initialData.contactId,
                isPaid: false
            });

            alert(`Venda gerada com sucesso!`);
            onSuccess(); onClose();
        } catch (error) { console.error(error); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Orçamento" : "Novo Orçamento"} className="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-400 block ml-1">Cliente</label>
                            <button type="button" onClick={() => setIsGuest(!isGuest)} className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                                {isGuest ? <><UserIcon size={12} /> Selecionar Cadastrado</> : <><UserPlus size={12} /> Novo / Prospect</>}
                            </button>
                        </div>

                        {!isGuest ? (
                            <Select value={formData.contactId} onChange={e => {
                                const c = contacts.find(contact => contact.id === e.target.value);
                                setFormData({ ...formData, contactId: e.target.value, customerName: c?.name });
                            }}>
                                <option value="">Selecione um cliente...</option>
                                {contacts.filter(c => c.scope !== 'supplier').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
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
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Status</label>
                            <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                <option value="draft">Rascunho</option>
                                <option value="sent">Enviado</option>
                                <option value="approved">Aprovado</option>
                                <option value="rejected">Rejeitado</option>
                                <option value="expired">Expirado</option>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Itens do Orçamento</h3>
                        <div className="flex gap-2">
                            <Select className="w-48 py-1 text-xs" onChange={(e) => {
                                if (e.target.value) {
                                    addItem(catalog.find(i => i.id === e.target.value));
                                    e.target.value = "";
                                }
                            }}>
                                <option value="">+ Adicionar do Catálogo</option>
                                {catalog.map(i => <option key={i.id} value={i.id}>{i.name} - R$ {i.price}</option>)}
                            </Select>
                            <Button type="button" size="sm" variant="secondary" onClick={() => addItem()}>+ Item Manual</Button>
                        </div>
                    </div>

                    <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-800 text-slate-400">
                                <tr>
                                    <th className="p-3 w-1/2">Descrição</th>
                                    <th className="p-3 w-20">Qtd</th>
                                    <th className="p-3 w-32">Unitário</th>
                                    <th className="p-3 w-32 text-right">Total</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2">
                                            <input className="w-full bg-transparent outline-none text-slate-200 placeholder:text-slate-600" placeholder="Item..." value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            <input type="number" className="w-full bg-transparent outline-none text-slate-200 text-center" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} />
                                        </td>
                                        <td className="p-2">
                                            <CurrencyInput
                                                value={item.unitPrice}
                                                onValueChange={(val) => updateItem(idx, 'unitPrice', val || 0)}
                                                className="bg-transparent border-0 pl-0 pr-0 py-1"
                                                placeholder="0,00"
                                            />
                                        </td>
                                        <td className="p-2 text-right font-medium text-emerald-400">
                                            R$ {(item.total || 0).toFixed(2)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => removeItem(idx)} className="text-slate-600 hover:text-rose-500"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500 italic">Nenhum item adicionado.</td></tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 font-bold text-white">
                                <tr>
                                    <td colSpan={3} className="p-3 text-right text-slate-400 uppercase text-xs">Total Final</td>
                                    <td className="p-3 text-right text-emerald-400">R$ {totalValue.toFixed(2)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <Textarea placeholder="Termos, condições ou notas internas..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="h-20" />

                <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <div>
                        {initialData?.id && formData.status !== 'approved' && (
                            <Button type="button" variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={handleApproval}>
                                <Check size={16} className="mr-2" /> Aprovar & Gerar Venda
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>Salvar Orçamento</Button>
                    </div>
                </div>
            </form>
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
                <div className="flex items-center justify-between px-8 border-b border-slate-800 pb-4">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`flex items-center gap-2 ${step >= s ? 'text-emerald-400' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${step >= s ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-700 bg-slate-800'}`}>
                                {s}
                            </div>
                            <span className="text-xs font-bold uppercase hidden sm:block">
                                {s === 1 ? 'Cliente' : s === 2 ? 'Implantação' : s === 3 ? 'Recorrência' : 'Confirmação'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* STEP 1: CLIENT */}
                {step === 1 && (
                    <div className="space-y-4 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h3 className="text-lg font-medium text-white text-center">Quem é o contratante?</h3>
                        <div className="max-w-sm mx-auto">
                            <label className="text-xs text-slate-400 block mb-1">Cliente</label>
                            <Select value={formData.contactId} onChange={e => setFormData({ ...formData, contactId: e.target.value })} className="text-lg">
                                <option value="">Selecione...</option>
                                {contacts.filter(c => c.scope !== 'supplier').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            <p className="text-center text-slate-500 text-xs mt-4">Selecione o cliente para prosseguir.</p>
                        </div>
                    </div>
                )}


                {/* STEP 2: SETUP (IMPLANTAÇÃO) */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-lg mx-auto">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-white text-center mb-4">Configuração de Implantação</h3>

                            <CurrencyInput label="Taxa de Implantação / Setup (Única)" value={formData.setupFee} onValueChange={(val) => setFormData({ ...formData, setupFee: val || 0 })} />

                            {formData.setupFee && formData.setupFee > 0 ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Categoria Financeira (Setup) *</label>
                                        <Select
                                            value={formData.setupCategoryId}
                                            onChange={e => setFormData({ ...formData, setupCategoryId: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {financialCategories.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </Select>
                                    </div>

                                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                                <input type="radio" name="setupType" checked={setupPaymentMethod === 'spot'} onChange={() => setSetupPaymentMethod('spot')} className="accent-emerald-500" />
                                                À Vista
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                                <input type="radio" name="setupType" checked={setupPaymentMethod === 'split'} onChange={() => setSetupPaymentMethod('split')} className="accent-emerald-500" />
                                                Entrada + Restante
                                            </label>
                                        </div>

                                        {setupPaymentMethod === 'spot' ? (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                <Input type="date" label="Data de Recebimento *" value={formData.setupSpotDate || ''} onChange={(e) => setFormData({ ...formData, setupSpotDate: e.target.value })} required />
                                                <p className="text-xs text-slate-500">O valor total de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.setupFee)} será lançado nesta data.</p>
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
                                <p className="text-center text-slate-500 text-sm italic py-4">
                                    Sem taxa de setup configurada. Opcional.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 3: RECURRENCE (RECORRÊNCIA) */}
                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Serviços do Catálogo (Opcional)</h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                    {catalog.filter(i => i.type === 'service').map(item => {
                                        const isSelected = !!selectedServices.find(s => s.id === item.id);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => toggleService(item)}
                                                className={`p-2 rounded border cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                            >
                                                <span className={`text-sm ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>{item.name}</span>
                                                <span className="text-xs font-mono">R$ {item.price}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <CurrencyInput label="Adicional Recorrente" value={extraAmount} onValueChange={(val) => setExtraAmount(val || 0)} />
                                <CurrencyInput label="Desconto Mensal" value={discount} onValueChange={(val) => setDiscount(val || 0)} />

                                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center mt-4">
                                    <span className="text-xs text-slate-400 uppercase block mb-1">Mensalidade Final</span>
                                    <span className="text-3xl font-bold text-emerald-400">R$ {formData.recurringAmount?.toFixed(2)}</span>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Categoria Financeira (Recorrência) *</label>
                                    <Select
                                        value={formData.financialCategoryId}
                                        onChange={e => setFormData({ ...formData, financialCategoryId: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {financialCategories.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Conta Bancária (Recebimento)</label>
                                    <Select
                                        value={formData.bankAccountId}
                                        onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}
                                    >
                                        <option value="">Sem conta definida</option>
                                        {bankAccounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </Select>
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
                                                startDate: newDate // Sync: Start of contract validity = First Recurrence
                                            });
                                        }}
                                        required
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Data que será gerada a primeira mensalidade.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION (CONFIRMAÇÃO) */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Início da Vigência (Contrato)" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Duração (Meses)</label>
                                <Input type="number" placeholder="0 = Indeterminado" value={formData.contractMonths} onChange={e => setFormData({ ...formData, contractMonths: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <h5 className="font-bold text-slate-300 mb-2 border-b border-slate-700 pb-1">Resumo</h5>
                            <dl className="space-y-1 text-sm">
                                <div className="flex justify-between text-slate-400">
                                    <dt>Setup / Implantação:</dt>
                                    <dd className="text-slate-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.setupFee || 0)}</dd>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <dt>Valor Mensal:</dt>
                                    <dd className="text-emerald-400 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.recurringAmount || 0)}</dd>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <dt>Duração:</dt>
                                    <dd className="text-slate-200">{formData.contractMonths ? `${formData.contractMonths} meses` : 'Indeterminado'}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                )}

                {/* Footer Navigation */}
                <div className="flex justify-between pt-4 border-t border-slate-800">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={() => setStep(step - 1)} type="button" className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Voltar
                        </Button>
                    ) : <div />}

                    {step < 4 ? (
                        <Button
                            type="button"
                            onClick={() => setStep(step + 1)}
                            className="flex items-center gap-2"
                            disabled={
                                (step === 1 && !formData.contactId) ||
                                (step === 2 && formData.setupFee! > 0 && (
                                    !formData.setupCategoryId ||
                                    (setupPaymentMethod === 'split' && (!formData.setupEntryAmount || !formData.setupRemainingAmount || !formData.setupEntryDate || !formData.setupRemainingDate)) ||
                                    (setupPaymentMethod === 'spot' && !formData.setupSpotDate)
                                )) ||
                                (step === 3 && (!formData.financialCategoryId || !formData.firstRecurrenceDate))
                            }                      >
                            Próximo <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={loading || !formData.startDate}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            {loading ? 'Salvando...' : 'Finalizar Contrato'}
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
