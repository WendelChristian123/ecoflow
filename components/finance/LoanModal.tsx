import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Landmark, Check, AlertCircle } from 'lucide-react';
import { Modal, Input, Button, Card, CurrencyInput, Select } from '../Shared';
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
    
    const [formData, setFormData] = useState({
        name: '',
        type: 'payable',
        contactId: '',
        firstDueDate: new Date().toISOString().split('T')[0],
        principalAmount: 0,
        installmentsCount: 1,
        installmentAmount: 0,
        discountAmount: 0
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
                    firstDueDate: editingLoan.firstDueDate || editingLoan.first_due_date || new Date().toISOString().split('T')[0],
                    principalAmount: editingLoan.principalAmount || editingLoan.principal_amount || 0,
                    installmentsCount: editingLoan.installmentsCount || editingLoan.installments_count || 1,
                    installmentAmount: editingLoan.installmentAmount || editingLoan.installment_amount || 0,
                    discountAmount: editingLoan.discountAmount || editingLoan.discount_amount || 0
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
            const data = await api.getContacts(currentCompany?.id);
            setContacts(data);
        } catch (error) {
            console.error("Failed to load contacts", error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'payable',
            contactId: '',
            firstDueDate: new Date().toISOString().split('T')[0],
            principalAmount: 0,
            installmentsCount: 1,
            installmentAmount: 0,
            discountAmount: 0
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
        <Modal isOpen={isOpen} onClose={onClose} title={editingLoan ? 'Editar Contrato' : 'Nova Dívida | Empréstimo'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="flex gap-4">
                    <div className="flex-1">
                        <Select
                            label="Tipo de Contrato"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            required
                        >
                            <option value="payable">A Pagar (Dívida)</option>
                            <option value="receivable">A Receber (Empréstimo)</option>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Descrição Curta (Opcional)"
                        placeholder={formData.type === 'payable' ? 'Ex: Empréstimo Carro' : 'Ex: Dinheiro emprestado pro João'}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />

                    <Select
                        label={formData.type === 'payable' ? 'Credor / Fornecedor' : 'Devedor / Cliente'}
                        value={formData.contactId}
                        onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                    >
                        <option value="">Selecione um contato</option>
                        {contacts.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.fantasyName ? `(${c.fantasyName})` : ''}</option>
                        ))}
                    </Select>
                </div>

                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                    <h4 className="text-sm font-semibold mb-4 text-foreground flex flex-col">
                        Detalhes do Contrato
                        <span className="text-xs text-muted-foreground font-normal">
                            Preencha o capital, quantidade e o valor das parcelas que o sistema calcula o resto.
                        </span>
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <CurrencyInput
                            label="1. Valor Capital (Pego/Emprestado)"
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
                        <CurrencyInput
                            label="3. Valor de cada Parcela"
                            value={formData.installmentAmount}
                            onValueChange={(val) => setFormData({ ...formData, installmentAmount: val || 0 })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Vencimento Inicial (1ª Parcela)"
                            type="date"
                            value={formData.firstDueDate}
                            onChange={(e) => setFormData({ ...formData, firstDueDate: e.target.value })}
                            required
                        />
                        <CurrencyInput
                            label="Desconto sobre o Contrato"
                            value={formData.discountAmount}
                            onValueChange={(val) => setFormData({ ...formData, discountAmount: val || 0 })}
                            className="text-rose-500"
                        />
                    </div>
                </div>

                <div className="bg-secondary/10 p-4 rounded-xl border-l-4 border-primary">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground">Valor Bruto Sem Desconto:</span>
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
                            <span className="text-[10px] text-muted-foreground">
                                (Comparação do Total a Pagar contra o Capital Inicial)
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-primary font-bold uppercase tracking-wider">Valor Líquido Final:</span>
                            <span className="font-bold text-lg text-primary">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotalAmount)}
                            </span>
                        </div>
                    </div>
                    {(installmentsCount => installmentsCount > 0 ? (
                    <div className="mt-3 text-xs text-muted-foreground border-t border-border/50 pt-2 flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 text-primary mt-0.5" />
                        <span>Este contrato irá gerar <strong>{installmentsCount}</strong> parcelas a partir do dia {formData.firstDueDate.split('-').reverse().join('/')} na aba de Lançamentos do Financeiro. Toda edição futura deverá ser feita no próprio contrato ou nas parcelas caso haja avanço de parcelas ou renegociações esporádicas.</span>
                    </div>) : null)(formData.installmentsCount)}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-border"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || formData.principalAmount <= 0 || formData.installmentAmount <= 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center min-w-[120px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check size={16} className="mr-2" />
                                Salvar Contrato
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
