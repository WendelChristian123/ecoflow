
import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Select, Textarea, Badge, CurrencyInput } from './Shared';
import { Contact, CatalogItem, Quote, RecurringService, ContactScope, PersonType, CatalogType, QuoteItem, FinancialCategory } from '../types';
import { api, getErrorMessage } from '../services/api';
import { Plus, Trash2, ShoppingBag, User as UserIcon, Building, FileText, Check, AlertCircle, UserPlus, X, Box, Calendar, DollarSign, ArrowRight, ArrowLeft } from 'lucide-react';

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
    onSuccess: () => void;
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
            if (initialData?.id) await api.updateContact({ ...initialData, ...formData } as Contact);
            else await api.addContact(formData);
            onSuccess(); onClose();
        } catch (error) {
            console.error(error);
            alert(`Erro ao salvar contato: ${getErrorMessage(error)}`);
        }
        finally { setLoading(false); }
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
                            <button type="button" onClick={() => setFormData({ ...formData, type: 'pf' })} className={`flex-1 text-xs py-1.5 rounded ${formData.type === 'pf' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Pessoa Física</button>
                            <button type="button" onClick={() => setFormData({ ...formData, type: 'pj' })} className={`flex-1 text-xs py-1.5 rounded ${formData.type === 'pj' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Pessoa Jurídica</button>
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
            alert(`Erro ao salvar item: ${getErrorMessage(error)}`);
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
        } catch (error) { console.error(error); alert(`Erro: ${getErrorMessage(error)}`); }
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
                isPaid: false,
                categoryId: catItem?.financialCategoryId,
                contactId: formData.contactId
            });

            alert("Orçamento aprovado e receita lançada no financeiro!");
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
    onSuccess: () => void;
    contacts: Contact[];
    catalog: CatalogItem[];
    initialData?: RecurringService;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({ isOpen, onClose, onSuccess, contacts, catalog, initialData }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<RecurringService>>({
        contactId: '',
        recurringAmount: 0,
        startDate: getLocalDateISO(),
        frequency: 'monthly',
        contractMonths: 12,
        active: true,
        setupFee: 0
    });

    // UI Helpers for composition
    const [selectedServices, setSelectedServices] = useState<{ id: string, price: number, categoryId?: string }[]>([]);
    const [extraAmount, setExtraAmount] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            if (initialData) {
                setFormData(initialData);
                // Simplify: we don't store individual items in mock RecurringService, so we just set the amount
                setExtraAmount(initialData.recurringAmount);
                setSelectedServices([]);
            } else {
                setFormData({ contactId: '', recurringAmount: 0, startDate: getLocalDateISO(), frequency: 'monthly', contractMonths: 12, active: true, setupFee: 0 });
                setSelectedServices([]);
                setExtraAmount(0);
                setDiscount(0);
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
        setLoading(true);
        try {
            if (initialData?.id) {
                // Update implementation (mock doesn't support deep update of contract logic easily, just basic fields)
                alert("Edição de contratos ativa não implementada no mock. Crie um novo contrato.");
            } else {
                // 1. Create Contract
                const contractId = await api.addRecurringService(formData);

                // 2. Sync Financials (Try to use category from first service)
                const mainCategory = selectedServices[0]?.categoryId || '';
                // Since mock syncContractFinancials is a placeholder, we manually trigger the creation of the first transaction to look good
                if (mainCategory) {
                    await api.syncContractFinancials(contractId, mainCategory, mainCategory);

                    // Create Setup Fee Transaction if exists
                    if (formData.setupFee && formData.setupFee > 0) {
                        await api.addTransaction({
                            description: `Setup Contrato (Cliente: ${contacts.find(c => c.id === formData.contactId)?.name})`,
                            amount: formData.setupFee,
                            type: 'income',
                            date: formData.startDate,
                            categoryId: mainCategory,
                            contactId: formData.contactId,
                            isPaid: false
                        });
                    }
                }
            }
            onSuccess(); onClose();
        } catch (error) { console.error(error); alert("Erro ao salvar contrato."); }
        finally { setLoading(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Detalhes do Contrato" : "Novo Contrato Recorrente"} className="max-w-2xl">
            <div className="space-y-6">
                {/* Wizard Steps Indicator */}
                <div className="flex items-center justify-between px-8 border-b border-slate-800 pb-4">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`flex items-center gap-2 ${step >= s ? 'text-emerald-400' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${step >= s ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-700 bg-slate-800'}`}>
                                {s}
                            </div>
                            <span className="text-xs font-bold uppercase hidden sm:block">
                                {s === 1 ? 'Cliente' : s === 2 ? 'Valores' : 'Confirmação'}
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

                {/* STEP 2: COMPOSITION */}
                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Serviços do Catálogo</h4>
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
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: TERMS */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Início da Cobrança" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Duração (Meses)</label>
                                <Input type="number" placeholder="0 = Indeterminado" value={formData.contractMonths} onChange={e => setFormData({ ...formData, contractMonths: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                            <CurrencyInput label="Taxa de Implantação / Setup (Única)" value={formData.setupFee} onValueChange={(val) => setFormData({ ...formData, setupFee: val || 0 })} />
                            <p className="text-xs text-slate-500 mt-1">Será gerada uma cobrança avulsa para este valor na data de início.</p>
                        </div>

                        <div className="flex items-center gap-2 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                            <Calendar className="text-indigo-400" size={18} />
                            <div className="text-xs text-indigo-200">
                                O sistema irá gerar automaticamente as previsões de receita no financeiro baseadas neste contrato.
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Navigation */}
                <div className="flex justify-between pt-4 border-t border-slate-800">
                    <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
                        {step === 1 ? 'Cancelar' : <><ArrowLeft size={16} className="mr-2" /> Voltar</>}
                    </Button>

                    {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !formData.contactId}>
                            Próximo <ArrowRight size={16} className="ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            {loading ? 'Salvando...' : 'Confirmar Contrato'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
