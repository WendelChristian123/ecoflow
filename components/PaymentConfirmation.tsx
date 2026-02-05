import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Button } from './Shared';
import { api, getErrorMessage } from '../services/api';
import { format, parseISO, isSameDay, startOfDay } from 'date-fns';
import { Calendar, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { FinancialTransaction } from '../types';

interface PaymentConfirmationProps {
    transaction: FinancialTransaction | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string) => Promise<void>;
    isLoading?: boolean;
}

export const PaymentDateConfirmModal: React.FC<PaymentConfirmationProps> = ({
    transaction,
    isOpen,
    onClose,
    onConfirm,
    isLoading = false
}) => {
    if (!transaction) return null;

    const today = new Date();
    const dueDate = transaction.date ? parseISO(transaction.date.split('T')[0]) : new Date();

    // Formatting for display
    const formattedToday = format(today, 'dd/MM/yyyy');
    const formattedDueDate = format(dueDate, 'dd/MM/yyyy');

    return createPortal(
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirmar Pagamento"
            className="max-w-md"
        >
            <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 py-4">
                    <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 flex items-center justify-center">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Data de Baixa</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                            A data de hoje é diferente da data de vencimento. Qual data deseja considerar para o pagamento?
                        </p>
                    </div>
                </div>

                <div className="grid gap-3">
                    <button
                        onClick={() => onConfirm(format(today, 'yyyy-MM-dd'))}
                        className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group group-hover:shadow-sm"
                        disabled={isLoading}
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CheckCircle2 size={20} />
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Data de Hoje</span>
                                <span className="block text-xs text-muted-foreground">{formattedToday} (Realizado Agora)</span>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-500 opacity-50 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                    </button>

                    <button
                        onClick={() => onConfirm(transaction.date ? transaction.date.split('T')[0] : format(today, 'yyyy-MM-dd'))}
                        className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group group-hover:shadow-sm"
                        disabled={isLoading}
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Calendar size={20} />
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-semibold text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-400">Data de Vencimento</span>
                                <span className="block text-xs text-muted-foreground">{formattedDueDate} (Mantém Original)</span>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-500 opacity-50 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                    </button>
                </div>

                <div className="flex justify-center pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading} className="text-muted-foreground hover:text-foreground">
                        Cancelar
                    </Button>
                </div>
            </div>
        </Modal>,
        document.body
    );
};

export const usePaymentConfirmation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [onSuccessCallback, setOnSuccessCallback] = useState<((transactionId: string, newStatus: boolean) => void) | null>(null);

    const handleConfirmPayment = async (transaction: FinancialTransaction, onSuccess?: (id: string, status: boolean) => void) => {
        // If unpaying (marking as pending), just do it direct.
        if (transaction.isPaid) {
            try {
                await api.toggleTransactionStatus(transaction.id, false);
                if (onSuccess) onSuccess(transaction.id, false);
            } catch (error) {
                console.error("Error toggling status:", error);
                alert(`Erro ao atualizar: ${getErrorMessage(error)}`);
            }
            return;
        }

        const today = startOfDay(new Date());
        // Fix date string potentially including time or being UTC
        const txDatePart = transaction.date ? transaction.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
        const dueDate = startOfDay(parseISO(txDatePart));

        // Logic 1: Exact Match -> Auto Confirm
        if (isSameDay(today, dueDate)) {
            try {
                await api.toggleTransactionStatus(transaction.id, true, format(today, 'yyyy-MM-dd'));
                if (onSuccess) onSuccess(transaction.id, true);
            } catch (error) {
                console.error("Error confirming payment:", error);
                alert(`Erro: ${getErrorMessage(error)}`);
            }
            return;
        }

        // Logic 2: Mismatch -> Open Modal
        setSelectedTransaction(transaction);
        setOnSuccessCallback(() => onSuccess || null);
        setIsOpen(true);
    };

    const handleDateSelection = async (date: string) => {
        if (!selectedTransaction) return;
        setIsLoading(true);
        try {
            // We use toggleTransactionStatus but passing the specific paidAt date
            // Assuming the API supports a 3rd argument for date or we update the object
            // The request was: "update paidAt". 
            // Checking api.toggleTransactionStatus signature might be needed. 
            // Ideally: api.updateTransaction({ ...tx, isPaid: true, paidAt: date }) or similar.
            // The prompt implies we should persist this date.

            // NOTE: Using toggleTransactionStatus which likely accepts a date string optionally 
            // OR finding the update method.
            // For now assuming: api.toggleTransactionStatus(id, true, date) exists or I will verify it.
            // Based on previous Modals code: api.toggleTransactionStatus(item.id, newStatus);
            // I'll check api.ts in next step to ensure it accepts date. Assuming yes or I extend it.

            await api.toggleTransactionStatus(selectedTransaction.id, true, date);

            if (onSuccessCallback) onSuccessCallback(selectedTransaction.id, true);
            setIsOpen(false);
            setSelectedTransaction(null);
        } catch (error) {
            console.error("Error confirming with date:", error);
            alert(`Erro ao confirmar: ${getErrorMessage(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isOpen,
        selectedTransaction,
        isLoading,
        confirmPayment: handleConfirmPayment,
        closeModal: () => setIsOpen(false),
        handleDateSelection,
        ConfirmationModalComponent: (
            <PaymentDateConfirmModal
                transaction={selectedTransaction}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={handleDateSelection}
                isLoading={isLoading}
            />
        )
    };
};
