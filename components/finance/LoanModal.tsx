import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Landmark, Check, AlertCircle } from 'lucide-react';
import { Modal, Input, Button, Card, CurrencyInput, Select } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { api } from '../../services/api';

interface LoanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    editingLoan?: any;
}

export const LoanModal: React.FC<LoanModalProps> = ({ isOpen, onClose, onSave, editingLoan }) => {
    const { currentCompany } = useCompany();
    const [isLoading, setIsLoading] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        name: '',
        type: 'payable',
        contactId: '',
        categoryId: '',
        accountId: '',
        firstDueDate: new Date().toISOString().split('T')[0],
        principalAmount: 0,
        installmentsCount: 1,
        installmentAmount: 0,
        discountAmount: 0,
        interestCategoryId: '',
        isCapitalSettled: false,
        setupAccountId: '',
        setupCategoryId: ''
    });

    // Load necessary dependencies like contacts
    useEffect(() => {
        if (isOpen && currentCompany?.id) {
            loadContacts();
            if (editingLoan) {
                setFormData({
                    name: editingLoan.name || '',
                    type: editingLoan.type || 'payable',
                    contactId: editingLoan.contactId || editingLoan.contact_id || '',
                    categoryId: editingLoan.categoryId || editingLoan.category_id || '',
                    accountId: editingLoan.accountId || editingLoan.account_id || '',
                    firstDueDate: editingLoan.firstDueDate || editingLoan.first_due_date || new Date().toISOString().split('T')[0],
                    principalAmount: editingLoan.principalAmount || editingLoan.principal_amount || 0,
                    installmentsCount: editingLoan.installmentsCount || editingLoan.installments_count || 1,
                    installmentAmount: editingLoan.installmentAmount || editingLoan.installment_amount || 0,
                    discountAmount: editingLoan.discountAmount || editingLoan.discount_amount || 0,
                    interestCategoryId: editingLoan.interestCategoryId || editingLoan.interest_category_id || '',
                    isCapitalSettled: editingLoan.isCapitalSettled || false,
                    setupAccountId: editingLoan.setupAccountId || '',
                    setupCategoryId: editingLoan.setupCategoryId || ''
                });
            } else {
                resetForm();
            }
        } else {
            resetForm();
        }
    }, [isOpen, currentCompany?.id, editingLoan]);

    const loadContacts = async () => {
        try {
            const [contactsData, categoriesData, accountsData] = await Promise.all([
                api.getContacts(currentCompany?.id),
                api.getFinancialCategories(currentCompany?.id),
                api.getFinancialAccounts(currentCompany?.id)
            ]);
            setContacts(contactsData || []);
            setCategories(categoriesData || []);
            setAccounts(accountsData || []);
        } catch (error) {
            console.error("Failed to load contacts/categories/accounts", error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'payable',
            contactId: '',
            categoryId: '',
            accountId: '',
            firstDueDate: new Date().toISOString().split('T')[0],
            principalAmount: 0,
            installmentsCount: 1,
            installmentAmount: 0,
            discountAmount: 0,
            interestCategoryId: '',
            isCapitalSettled: false,
            setupAccountId: '',
            setupCategoryId: ''
        });
    };

    // Derived logic
    const grossTotalWithoutDiscount = formData.installmentsCount * formData.installmentAmount;
    const finalTotalAmount = grossTotalWithoutDiscount - formData.discountAmount;
    const interestAmount = finalTotalAmount - formData.principalAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (editingLoan) {
                await api.updateLoan(editingLoan.id, {
                    ...formData,
                    interestAmount,
                    totalAmount: finalTotalAmount
                });
            } else {
                await api.addLoan({
                    ...formData,
                    interestAmount,
                    totalAmount: finalTotalAmount
                });
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to save loan:', error);
            alert('Erro ao salvar dívida/empréstimo.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingLoan ? 'Editar Contrato' : 'Nova Dívida | Empréstimo'} className="max-w-4xl">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                    {/* LEFT COLUMN: Basic Info */}
                    <div className="space-y-5">
                        <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">Informações Iniciais</h4>
                            <FilterSelect
                                inlineLabel="Tipo de Contrato"
                                value={formData.type}
                                onChange={(val) => setFormData({ ...formData, type: String(val) })}
                                options={[
                                    { value: 'payable', label: 'A Pagar (Dívida)' },
                                    { value: 'receivable', label: 'A Receber (Empréstimo)' }
                                ]}
                                className="w-full"
                            />

                            <FilterSelect
                                inlineLabel={formData.type === 'payable' ? 'Credor / Fornecedor' : 'Devedor / Cliente'}
                                value={formData.contactId}
                                onChange={(val) => setFormData({ ...formData, contactId: String(val) })}
                                options={contacts.map(c => ({
                                    value: c.id, 
                                    label: `${c.name} ${c.fantasyName ? `(${c.fantasyName})` : ''}`
                                }))}
                                placeholder="Selecione um contato"
                                searchable
                                className="w-full"
                            />

                            <FilterSelect
                                inlineLabel="Categoria"
                                value={formData.categoryId}
                                onChange={(val) => setFormData({ ...formData, categoryId: String(val) })}
                                options={categories
                                    .filter(c => c.type === (formData.type === 'payable' ? 'expense' : 'income'))
                                    .map(c => ({
                                        value: c.id, 
                                        label: c.name
                                    }))}
                                placeholder="Selecione uma categoria"
                                searchable
                                className="w-full"
                            />

                            <Input
                                label="Descrição Curta (Opcional)"
                                placeholder={formData.type === 'payable' ? 'Ex: Empréstimo Carro' : 'Ex: Dinheiro emprestado pro João'}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />

                            <Input
                                label="Vencimento Inicial (1ª Parcela)"
                                type="date"
                                value={formData.firstDueDate}
                                onChange={(e) => setFormData({ ...formData, firstDueDate: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Financial Details */}
                    <div className="space-y-5 flex flex-col">
                        <div className="bg-secondary/30 p-5 rounded-xl border border-border shadow-sm flex-1">
                            <h4 className="text-sm font-semibold mb-4 text-foreground flex flex-col">
                                Estrutura do Contrato
                                <span className="text-xs text-muted-foreground font-normal mt-1">
                                    Preencha o capital, quantidade e o valor das parcelas que o sistema calcula os juros automaticamente.
                                </span>
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <CurrencyInput
                                    label="1. Valor Capital (Emprestado)"
                                    value={formData.principalAmount}
                                    onValueChange={(val) => setFormData({ ...formData, principalAmount: val || 0 })}
                                    required
                                />
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">2. Qtd Parcelas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full h-11 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        value={formData.installmentsCount || ''}
                                        onChange={(e) => setFormData({ ...formData, installmentsCount: parseInt(e.target.value) || 1 })}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <CurrencyInput
                                    label="3. Valor da Parcela"
                                    value={formData.installmentAmount}
                                    onValueChange={(val) => setFormData({ ...formData, installmentAmount: val || 0 })}
                                    required
                                />
                                <CurrencyInput
                                    label="Desconto Final"
                                    value={formData.discountAmount}
                                    onValueChange={(val) => setFormData({ ...formData, discountAmount: val || 0 })}
                                    className="text-rose-500"
                                />
                                <div className="sm:col-span-2">
                                    <FilterSelect
                                        inlineLabel="Conta de Pagamento"
                                        value={formData.accountId}
                                        onChange={(val) => setFormData({ ...formData, accountId: String(val) })}
                                        options={[{ value: '', label: 'Selecione uma conta bancária...' }, ...accounts.map(a => ({
                                            value: a.id,
                                            label: a.name
                                        }))]}
                                        className="w-full text-sm"
                                        searchable
                                    />
                                </div>
                            </div>
                            
                            {interestAmount > 0 && (
                                <div className="mt-4 pt-4 border-t border-border">
                                    <FilterSelect
                                        inlineLabel="Categoria dos Juros (Opcional)"
                                        value={formData.interestCategoryId}
                                        onChange={(val) => setFormData({ ...formData, interestCategoryId: String(val) })}
                                        options={[{ value: '', label: 'Não separar (manter junto ao Capital)' }, ...categories
                                            .filter(c => c.type === (formData.type === 'payable' ? 'expense' : 'income'))
                                            .map(c => ({
                                                value: c.id, 
                                                label: c.name
                                            }))]}
                                        placeholder="Selecione..."
                                        searchable
                                        className="w-full text-sm"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1.5 ml-2">
                                        Ao selecionar uma categoria, o sistema dividirá automaticamente o valor das parcelas na DRE, separando Capital e Juros.
                                    </p>
                                </div>
                            )}

                            {/* Capital Settlement Checkbox & Fields */}
                            <div className="mt-4 pt-4 border-t border-border">
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.isCapitalSettled}
                                        onChange={(e) => setFormData({ ...formData, isCapitalSettled: e.target.checked })}
                                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-foreground">
                                        O valor capital ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.principalAmount || 0)}) já movimentou alguma conta?
                                    </span>
                                </label>
                                
                                {formData.isCapitalSettled && (
                                    <div className="bg-background/50 border border-border p-3 rounded-lg grid grid-cols-1 gap-3">
                                        <p className="text-[11px] text-muted-foreground">
                                            Um lançamento de {formData.type === 'payable' ? 'Receita' : 'Despesa'} no valor exato do Capital será criado automaticamente e marcado como pago hoje.
                                        </p>
                                        <FilterSelect
                                            inlineLabel="Destino/Origem:"
                                            value={formData.setupAccountId}
                                            onChange={(val) => setFormData({ ...formData, setupAccountId: String(val) })}
                                            options={[{ value: '', label: 'Selecione a Conta Bancária' }, ...accounts.map(a => ({
                                                value: a.id,
                                                label: a.name
                                            }))]}
                                            className="w-full text-sm"
                                            searchable
                                        />
                                        <FilterSelect
                                            inlineLabel="Categoria (Setup):"
                                            value={formData.setupCategoryId}
                                            onChange={(val) => setFormData({ ...formData, setupCategoryId: String(val) })}
                                            options={[{ value: '', label: 'Selecione a Categoria...' }, ...categories
                                                .filter(c => c.type === (formData.type === 'payable' ? 'income' : 'expense'))
                                                .map(c => ({
                                                    value: c.id, 
                                                    label: c.name
                                                }))]}
                                            className="w-full text-sm"
                                            searchable
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Block */}
                        <div className="bg-card p-4 rounded-xl border-l-4 border-primary shadow-sm">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Valor Bruto S/ Desc:</span>
                                    <span className="font-semibold text-foreground">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grossTotalWithoutDiscount)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Total de Desconto:</span>
                                    <span className="font-semibold text-rose-500">
                                        - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.discountAmount)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Juros Gerados:</span>
                                    <span className={`font-semibold ${interestAmount >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(interestAmount)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-primary font-bold uppercase tracking-wider text-[10px]">Valor Líquido Final:</span>
                                    <span className="font-black text-xl text-primary leading-none mt-1">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotalAmount)}
                                    </span>
                                </div>
                            </div>
                            {(installmentsCount => installmentsCount > 0 ? (
                            <div className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-3 flex items-start gap-2">
                                <AlertCircle size={14} className="shrink-0 text-primary mt-0.5" />
                                <span>Serão geradas <strong>{installmentsCount}</strong> parcelas a partir do dia {formData.firstDueDate.split('-').reverse().join('/')}. Qualquer renegociação ou avanço de parcelas futuras deverá ser feita no próprio contrato ou nos lançamentos.</span>
                            </div>) : null)(formData.installmentsCount)}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border">
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isLoading || formData.principalAmount <= 0 || formData.installmentAmount <= 0}
                        className="min-w-[120px]"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check size={16} className="mr-2" />
                                Salvar Contrato
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
