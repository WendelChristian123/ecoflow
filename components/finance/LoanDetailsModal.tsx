import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Circle, ArrowUpCircle, ArrowDownCircle, Info, Landmark, Calendar, Banknote, DollarSign, Edit3, Trash2, AlertTriangle, Building2 } from 'lucide-react';
import { Modal, Card, Button } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { useRBAC } from '../../context/RBACContext';
import { useCompany } from '../../context/CompanyContext';
import { api } from '../../services/api';
import { format } from 'date-fns';
import { formatDate } from '../../utils/formatters';
import { FinancialAccount } from '../../types';

interface LoanDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    loan: any;
    onUpdate: () => void; // Trigger list refresh
    onEdit?: (loan: any) => void;
}

export const LoanDetailsModal: React.FC<LoanDetailsModalProps> = ({ isOpen, onClose, loan, onUpdate, onEdit }) => {
    const { can } = useRBAC();
    const { currentCompany } = useCompany();
    const [installments, setInstallments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPaying, setIsPaying] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

    // Inner payment modal state
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
    const [paymentDiscount, setPaymentDiscount] = useState(0);
    const [paymentSurcharge, setPaymentSurcharge] = useState(0);
    const [partialPayment, setPartialPayment] = useState<number | null>(null);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentAccountId, setPaymentAccountId] = useState('');

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (isOpen && loan) {
            loadInstallments();
            loadAccounts();
        }
    }, [isOpen, loan]);

    const loadInstallments = async () => {
        try {
            setIsLoading(true);
            const data = await api.getLoanInstallments(loan.id);
            setInstallments(data);
        } catch (error) {
            console.error("Failed to load installments:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadAccounts = async () => {
        try {
            const data = await api.getFinancialAccounts(currentCompany?.id);
            setAccounts(data || []);
        } catch (error) {
            console.error("Failed to load accounts:", error);
        }
    };

    const handleOpenPayment = (inst: any) => {
        setSelectedInstallment(inst);
        setPaymentDiscount(inst.discountAmount || inst.discount_amount || 0);
        setPaymentSurcharge(0);
        setPartialPayment(null);
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentAccountId(inst.accountId || loan.accountId || '');
        setPaymentModalOpen(true);
    };

    const confirmPayment = async () => {
        if (!selectedInstallment) return;
        try {
            setIsPaying(selectedInstallment.id);
            
            const originalGross = (selectedInstallment.grossAmount || selectedInstallment.gross_amount || selectedInstallment.amount) + paymentSurcharge;
            const fullNet = originalGross - paymentDiscount;
            const isPartial = partialPayment !== null && partialPayment > 0 && partialPayment < fullNet;

            if (isPartial) {
                // CREATE a new paid transaction for the partial amount
                const newRemainingAmount = fullNet - partialPayment;
                
                await api.addTransaction({
                    description: `${selectedInstallment.description} (Pgto Parcial)`,
                    amount: partialPayment,
                    grossAmount: partialPayment,
                    discountAmount: 0,
                    type: selectedInstallment.type || (loan.type === 'payable' ? 'expense' : 'income'),
                    date: paymentDate,
                    isPaid: true,
                    contactId: selectedInstallment.contact_id || loan.contact?.id,
                    accountId: paymentAccountId || undefined,
                    originType: 'loan',
                    originId: loan.id,
                });

                // UPDATE original installment: reduce amount, keep original due date
                await api.updateTransaction({
                    id: selectedInstallment.id,
                    isPaid: false,
                    date: selectedInstallment.date,
                    discountAmount: paymentDiscount,
                    grossAmount: originalGross,
                    amount: newRemainingAmount,
                    accountId: paymentAccountId || undefined
                } as any, "single");

                // Reload all installments to get the new partial payment entry
                await loadInstallments();
            } else {
                // Full payment - just mark as paid
                const finalAmount = fullNet;
                await api.updateTransaction({
                    id: selectedInstallment.id,
                    isPaid: true,
                    date: paymentDate,
                    discountAmount: paymentDiscount,
                    grossAmount: originalGross,
                    amount: finalAmount,
                    accountId: paymentAccountId || undefined
                } as any, "single");

                setInstallments(prev => prev.map(i => i.id === selectedInstallment.id ? { 
                    ...i, 
                    isPaid: true,
                    is_paid: true,
                    discountAmount: paymentDiscount, 
                    discount_amount: paymentDiscount,
                    grossAmount: originalGross,
                    gross_amount: originalGross,
                    amount: finalAmount,
                    accountId: paymentAccountId
                } : i));
            }

            onUpdate();
            setPaymentModalOpen(false);
        } catch (error) {
            console.error("Failed to pay installment:", error);
            alert("Erro ao baixar parcela.");
        } finally {
            setIsPaying(null);
        }
    };

    const handleDelete = async (mode: 'all' | 'keep_paid') => {
        try {
            setIsDeleting(true);
            await api.deleteLoan(loan.id, mode);
            setDeleteModalOpen(false);
            onClose();
            onUpdate();
        } catch (error) {
            console.error('Failed to delete loan:', error);
            alert('Erro ao excluir contrato.');
        } finally {
            setIsDeleting(false);
        }
    };


    if (!loan) return null;

    const paidInstallments = installments.filter(i => i.isPaid || i.is_paid);
    const unpaidInstallments = installments.filter(i => !(i.isPaid || i.is_paid));

    const paidCount = paidInstallments.length;
    const totalCount = installments.length;
    const progress = totalCount === 0 ? 0 : Math.round((paidCount / totalCount) * 100);

    const totalFromPaid = paidInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalActuallyPaid = totalFromPaid;

    const totalDiscountApplied = installments.reduce((acc, curr) => acc + (curr.discountAmount || curr.discount_amount || 0), 0);
    const remainingAmount = Math.max(0, loan.totalAmount - totalActuallyPaid - totalDiscountApplied);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Helper: compute discount distribution (interest first, then capital)
    const computeDiscountBreakdown = (capital: number, interest: number, discount: number) => {
        let discountOnInterest = 0;
        let discountOnCapital = 0;
        if (interest > 0) {
            discountOnInterest = Math.min(discount, interest);
            discountOnCapital = Math.max(0, discount - discountOnInterest);
        } else {
            discountOnCapital = Math.min(discount, capital);
        }
        return { discountOnInterest, discountOnCapital };
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Contrato" className="max-w-4xl">
            <div className="space-y-6">
                
                {/* Header Information */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${loan.type === 'payable' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {loan.type === 'payable' ? <ArrowDownCircle size={40} /> : <ArrowUpCircle size={40} />}
                        </div>
                        <div className="text-left">
                            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{loan.name}</h2>
                            <p className="text-muted-foreground mt-1">{loan.type === 'payable' ? 'Dívida a Pagar com' : 'Empréstimo a Receber de'} <strong className="text-foreground">{loan.contact?.name || 'Não informado'}</strong></p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 bg-secondary/20 p-4 rounded-2xl border border-border w-full md:w-auto">
                        <div className="text-left">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">Valor Final</p>
                            <p className="text-3xl font-black text-foreground">{formatCurrency(loan.totalAmount)}</p>
                        </div>
                        <div className="flex flex-row flex-wrap sm:flex-col gap-2 w-full sm:w-auto">
                            {onEdit && can('finance.loans', 'edit') && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => { onClose(); onEdit(loan); }}
                                    className="flex-1 sm:flex-none justify-center"
                                >
                                    <Edit3 size={14} className="mr-1.5" />
                                    Editar
                                </Button>
                            )}
                            {can('finance.loans', 'delete') && (
                                <Button 
                                    variant="danger" 
                                    size="sm" 
                                    onClick={() => setDeleteModalOpen(true)}
                                    className="flex-1 sm:flex-none justify-center"
                                >
                                    <Trash2 size={14} className="mr-1.5" />
                                    Excluir
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-secondary/30 p-3 rounded-xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1"><Landmark size={12}/> Capital</span>
                        <span className="font-semibold text-foreground">{formatCurrency(loan.principalAmount)}</span>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1"><Banknote size={12}/> Juros Formados</span>
                        <span className={`font-semibold ${loan.interestAmount >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {loan.interestAmount > 0 ? '+' : ''}{formatCurrency(loan.interestAmount)}
                        </span>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1"><DollarSign size={12}/> Desconto</span>
                        <span className="font-semibold text-rose-500">
                            - {formatCurrency(loan.discountAmount)}
                        </span>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1"><Calendar size={12}/> Venc. Inicial</span>
                        <span className="font-semibold text-foreground">
                            {formatDate(loan.firstDueDate, 'dd/MM/yyyy')}
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <Card className="p-4 border border-border">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-sm">Progresso do Contrato</h4>
                        <span className="text-sm font-bold text-primary">{paidCount} de {totalCount} Pagas ({progress}%)</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                        <div 
                            className="bg-primary h-3 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
                        <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold text-primary">Total Pago</p>
                            <p className="font-semibold text-primary">{formatCurrency(Math.max(0, totalActuallyPaid))}</p>
                        </div>
                        <div className="text-center border-l border-r border-border/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Descontos Obtidos</p>
                            <p className="font-semibold text-rose-500">{totalDiscountApplied > 0 ? '-' : ''}{formatCurrency(totalDiscountApplied)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold text-amber-500">Resta Pagar</p>
                            <p className="font-semibold text-amber-500">{formatCurrency(remainingAmount)}</p>
                        </div>
                    </div>
                </Card>

                {/* Installments List */}
                <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                        Cronograma de Parcelas
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{totalCount} registros</span>
                    </h4>

                    {isLoading ? (
                        <div className="text-center py-6 text-sm text-muted-foreground animate-pulse">
                            Carregando parcelas...
                        </div>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                            {installments.map((inst) => (
                                <div key={inst.id} className={`flex items-center justify-between p-3 rounded-xl border ${inst.isPaid ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'} transition-colors`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${inst.isPaid ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-secondary'}`}>
                                            {inst.isPaid ? <CheckCircle size={18} /> : <Circle size={18} />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{inst.description}</span>
                                            <span className="text-xs text-muted-foreground">
                                            Vencimento: {formatDate(inst.date, 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className={`font-bold ${inst.isPaid ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                {formatCurrency(inst.amount)}
                                            </span>
                                            {inst.interestAmount > 0 && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    {formatCurrency(inst.capitalAmount)} + {formatCurrency(inst.interestAmount)} juros
                                                </p>
                                            )}
                                        </div>
                                        {!inst.isPaid && can('finance.transactions', 'edit') ? (
                                            <Button 
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenPayment(inst)}
                                                disabled={isPaying === inst.id}
                                                className="text-primary bg-primary/10 hover:bg-primary/20 min-w-[80px]"
                                            >
                                                {isPaying === inst.id ? 'Baixando...' : 'Pagar'}
                                            </Button>
                                        ) : (
                                            <span className="px-3 py-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 rounded-lg">
                                                Paga
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Message */}
                <div className="bg-amber-500/10 text-amber-500 text-xs p-3 rounded-xl flex items-start gap-2 border border-amber-500/20">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <span>O botão "Pagar" no modal altera o status da parcela rapidamente. Para selecionar de qual conta bancária o valor saiu (ou renegociar o valor da tarifa), utilize a aba de Lançamentos do Financeiro.</span>
                </div>

            </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir Contrato">
                <div className="space-y-5">
                    <div className="flex items-start gap-3 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                        <AlertTriangle size={24} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-rose-500">Atenção!</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Você está prestes a excluir o contrato <strong className="text-foreground">{loan.name}</strong>. Escolha como deseja proceder:
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => handleDelete('keep_paid')}
                            disabled={isDeleting}
                            className="w-full text-left p-4 rounded-xl border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                        >
                            <p className="text-sm font-bold text-foreground group-hover:text-amber-500 transition-colors">Excluir contrato, mas manter lançamentos pagos</p>
                            <p className="text-xs text-muted-foreground mt-1">O contrato e as parcelas em aberto serão removidos. Os lançamentos já pagos permanecem no financeiro e nos relatórios.</p>
                        </button>

                        <button
                            onClick={() => handleDelete('all')}
                            disabled={isDeleting}
                            className="w-full text-left p-4 rounded-xl border border-border hover:border-rose-500/50 hover:bg-rose-500/5 transition-all group"
                        >
                            <p className="text-sm font-bold text-foreground group-hover:text-rose-500 transition-colors">Excluir tudo (contrato + todos os lançamentos)</p>
                            <p className="text-xs text-muted-foreground mt-1">Remove o contrato e TODOS os lançamentos vinculados, inclusive os já pagos. Esta ação não pode ser desfeita.</p>
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        )}

        {/* Nested Payment Confirmation Modal */}
        {paymentModalOpen && selectedInstallment && (() => {
            const capital = selectedInstallment.capitalAmount || selectedInstallment.amount;
            const baseInterest = selectedInstallment.interestAmount || 0;
            const interest = baseInterest + paymentSurcharge;
            const hasInterest = interest > 0;
            const { discountOnInterest, discountOnCapital } = computeDiscountBreakdown(capital, interest, paymentDiscount);
            const capitalAfterDiscount = capital - discountOnCapital;
            const interestAfterDiscount = interest - discountOnInterest;
            const totalAfterDiscount = capitalAfterDiscount + interestAfterDiscount;
            const isPartial = partialPayment !== null && partialPayment > 0 && partialPayment < totalAfterDiscount;
            const remaining = isPartial ? totalAfterDiscount - partialPayment : 0;

            const selectedAccount = accounts.find(a => a.id === paymentAccountId);

            return (
            <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Confirmar Baixa" size="md">
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Você está quitando a parcela: <strong className="text-foreground">{selectedInstallment.description}</strong></p>
                    
                    {/* Values breakdown */}
                    <div className="bg-secondary/30 p-4 rounded-xl space-y-3 border border-border">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Vencimento Original:</span>
                            <span className="font-semibold text-foreground">
                            {formatDate(selectedInstallment.date, 'dd/MM/yyyy')}
                            </span>
                        </div>

                        {/* Payment date - always visible */}
                        <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/50">
                            <label className="text-sm text-foreground font-semibold">Data da Baixa</label>
                            <input 
                                type="date" 
                                className="bg-card border border-input text-foreground rounded-lg px-3 py-2 max-w-[160px] text-right focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-all font-medium text-sm"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                            />
                        </div>

                        {/* Capital */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <Landmark size={13} className="text-blue-400" /> Valor Capital:
                            </span>
                            <div className="text-right">
                                <span className="font-semibold">{formatCurrency(capital)}</span>
                                {discountOnCapital > 0 && (
                                    <span className="text-xs text-rose-400 ml-2">(-{formatCurrency(discountOnCapital)})</span>
                                )}
                            </div>
                        </div>

                        {/* Interest */}
                        {hasInterest && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <Banknote size={13} className="text-amber-400" /> Juros:
                                </span>
                                <div className="text-right">
                                    <span className="font-semibold text-amber-400">{formatCurrency(interest)}</span>
                                    {paymentSurcharge > 0 && (
                                        <span className="text-xs text-emerald-400 ml-1">(+{formatCurrency(paymentSurcharge)} acrésc.)</span>
                                    )}
                                    {discountOnInterest > 0 && (
                                        <span className="text-xs text-rose-400 ml-1">(-{formatCurrency(discountOnInterest)})</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Total line */}
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50">
                            <span className="font-semibold text-foreground">Total da Parcela:</span>
                            <span className="font-bold text-foreground">{formatCurrency(totalAfterDiscount)}</span>
                        </div>

                        {/* Discount input */}
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
                            <div>
                                <label className="text-sm text-foreground font-semibold">Desconto (R$)</label>
                                {paymentDiscount > 0 && hasInterest && (
                                    <p className="text-[10px] text-rose-400 mt-0.5">Desconto aplicado nos juros primeiro</p>
                                )}
                            </div>
                            <input 
                                type="number" 
                                min="0" 
                                step="0.01"
                                className="bg-card border border-input text-foreground rounded-lg px-3 py-2 max-w-[140px] text-right focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-all font-medium text-sm"
                                value={paymentDiscount}
                                onChange={(e) => setPaymentDiscount(Number(e.target.value))}
                            />
                        </div>

                        {/* Surcharge (late fee) */}
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
                            <div>
                                <label className="text-sm text-foreground font-semibold">Acréscimo / Multa (R$)</label>
                                {paymentSurcharge > 0 && (
                                    <p className="text-[10px] text-amber-400 mt-0.5">Adicionado ao valor dos juros</p>
                                )}
                            </div>
                            <input 
                                type="number" 
                                min="0" 
                                step="0.01"
                                className="bg-card border border-input text-foreground rounded-lg px-3 py-2 max-w-[140px] text-right focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-all font-medium text-sm"
                                value={paymentSurcharge || ''}
                                onChange={(e) => setPaymentSurcharge(Number(e.target.value) || 0)}
                            />
                        </div>

                        {/* Partial payment */}
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
                            <label className="text-sm text-amber-500 font-semibold">Pagamento Parcial (R$)</label>
                            <input 
                                type="number" 
                                min="0" 
                                step="0.01"
                                placeholder="Valor total"
                                className="bg-card border border-input text-foreground rounded-lg px-3 py-2 max-w-[140px] text-right focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-all font-medium text-sm placeholder:text-muted-foreground"
                                value={partialPayment ?? ''}
                                onChange={(e) => setPartialPayment(e.target.value ? Number(e.target.value) : null)}
                            />
                        </div>

                        {/* Bank Account selector */}
                        <div className="pt-3 border-t border-border/50">
                            <FilterSelect
                                inlineLabel="Conta Bancária"
                                value={paymentAccountId}
                                onChange={(val) => setPaymentAccountId(String(val))}
                                options={[{ value: '', label: 'Nenhuma conta selecionada...' }, ...accounts.map(a => ({
                                    value: a.id,
                                    label: a.name
                                }))]}
                                className="w-full text-sm"
                                searchable
                            />
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="space-y-2">
                        {isPartial && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-amber-500 font-semibold">Valor Pago Agora:</span>
                                <span className="text-amber-500 font-bold">{formatCurrency(partialPayment)}</span>
                            </div>
                        )}
                        {isPartial && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-rose-500 font-semibold">Saldo Restante:</span>
                                <span className="text-rose-500 font-bold">{formatCurrency(remaining)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-border/50">
                            <span>{isPartial ? 'Saldo Remanescente:' : 'Valor Finalizado:'}</span>
                            <span className={isPartial ? 'text-amber-500' : 'text-primary'}>
                                {formatCurrency(isPartial ? remaining : totalAfterDiscount)}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="secondary" onClick={() => setPaymentModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={confirmPayment}
                            disabled={isPaying === selectedInstallment.id}
                        >
                            {isPaying === selectedInstallment.id ? 'Baixando...' : 'Confirmar e Pagar'}
                        </Button>
                    </div>
                </div>
            </Modal>
            );
        })()}
        </>
    );
};
