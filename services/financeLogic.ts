import { FinancialTransaction, CreditCard, TenantSettings } from '../types';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { parseDateLocal } from '../utils/formatters';

export interface ProcessedTransaction extends FinancialTransaction {
    isVirtual?: boolean;
    virtualChildren?: FinancialTransaction[];
    isCollapsed?: boolean;
}

export const processTransactions = (
    transactions: FinancialTransaction[],
    cards: CreditCard[],
    mode: 'competence' | 'cash' = 'competence' // Default to competence
): ProcessedTransaction[] => {

    // 1. Separate regular transactions from Credit Card Purchase transactions
    const regularTransactions = transactions.filter(t => !t.creditCardId);

    // 2. Filter Credit Card Transactions
    const cardTransactions = transactions.filter(t => t.creditCardId);
    if (cardTransactions.length === 0) return regularTransactions;

    // 3. Process based on Mode
    if (mode === 'competence') {
        // COMPETENCE MODE: Returns individual transactions (Status Quo)
        return transactions.map(t => ({ ...t, isVirtual: false }));
    }

    // CASH MODE:
    // Hides individual card expense transactions.
    // Generates a "Virtual Invoice" transaction for the Invoice Due Date.

    const processed: ProcessedTransaction[] = [...regularTransactions];

    // Group purchases by Card and Invoice Month (Due Date)
    const groupedByInvoice: Record<string, {
        card: CreditCard,
        dueDate: string,
        total: number,
        paidAmount: number,
        children: FinancialTransaction[]
    }> = {};

    const getCard = (id: string) => cards.find(c => c.id === id);

    cardTransactions.forEach(t => {
        // Allow expenses and incomes (payments/refunds)
        if (t.type !== 'expense' && t.type !== 'income') {
            processed.push(t);
            return;
        }

        const card = getCard(t.creditCardId!);
        if (!card) { // Orphaned logic
            processed.push(t);
            return;
        }

        // Determine Invoice Bucket
        // Logic:
        // For EXPENSES: Purchase Date decide invoice.
        // For PAYMENTS (Income): Date decide invoice?
        // User pays on day X. If X is before Closing, it applies to CURRENT invoice.
        // If X is after Closing, it applies to NEXT invoice? This is ambiguous.
        // SIMPLIFICATION: We assume the Payment Transaction has a date aligned with the Invoice it's paying
        // OR we use the same closing day logic to bucket it.

        // Fix: Use parseDateLocal to ensure consistent day extraction ignoring Timezones
        const txDate = parseDateLocal(t.date);
        const day = txDate.getDate();

        const dueDay = Number(card.dueDay);
        const closingDay = Number(card.closingDay);

        // 1. Determine Invoice Reference Month
        // OBS: User defined "Closing Day" as "Best Shopping Day".
        // Therefore, if purchase equals Closing Day, it goes to Next Month.
        let invoiceMonth = txDate;
        if (day >= closingDay) {
            invoiceMonth = addMonths(txDate, 1);
        }

        // 2. Determine Due Date (Key)
        let dueMonth = invoiceMonth;
        if (dueDay < closingDay) {
            dueMonth = addMonths(invoiceMonth, 1);
        }

        // Reconstruction safe due date
        const dueDateObj = new Date(dueMonth.getFullYear(), dueMonth.getMonth(), dueDay);
        const dueDateStr = format(dueDateObj, 'yyyy-MM-dd');

        const key = `${card.id}-${dueDateStr}`;

        if (!groupedByInvoice[key]) {
            groupedByInvoice[key] = {
                card,
                dueDate: dueDateStr,
                total: 0,
                paidAmount: 0,
                children: []
            };
        }

        if (t.type === 'expense') {
            groupedByInvoice[key].total += t.amount;
        } else if (t.type === 'income' && t.isPaid) {
            // Incomes (Payments) reduce the effective invoice total for Cash projection?
            // Or do we track them separate?
            // "Limit liberado apenas do valor pago". 
            // If we just subtract, the 'amount' becomes (Total - Paid). 
            // If Paid >= Total, Amount <= 0.
            groupedByInvoice[key].paidAmount += t.amount;
        }

        groupedByInvoice[key].children.push(t);
    });

    // Create Virtual Invoice Transactions
    Object.values(groupedByInvoice).forEach(group => {
        const remainingAmount = group.total - group.paidAmount;
        const isFullyPaid = remainingAmount <= 0.01; // epsilon

        // In Cash Mode, we only want to show the 'Payment' event as the expense, OR the 'Invoice' as the commitment?
        // Spec: "Fatura aparece como compromisso... Pagamento da fatura gera despesa".
        // This implies:
        // 1. We show the Invoice (Virtual) as a "Future Expense" (Unpaid).
        // 2. If we pay it, we have a REAL Expense (Transaction). 
        // 3. Do we show both? No, that double counts.
        // 4. We should hide the Virtual Invoice IF it is covered by a Real Payment?
        //    OR update the Virtual Invoice to specific 'paid' state?

        // Strategy:
        // The Virtual Invoice represents the "Bill to be paid".
        // Amount = Total Purchases.
        // If we have payments (Real Expenses elsewhere?), we link them?
        // Our 'Income' offset on the card is internal bookkeeping.

        // Let's output the Virtual Invoice with `isPaid` determined by the offset.
        // And keep the Amount as the Total Expense? 
        // No, in Cash Mode, the "Expense" is the Payment.
        // If we show a Virtual Invoice of 1000 and a Payment of 1000.
        // Total Expense = 2000? Wrong.
        // So the Virtual Invoice must disappear or become 0 effectively when paid?
        // Spec says: "Pagamento da fatura gera despesa".
        // So the Real Payment Transaction (Bank->Expense) IS the record.
        // The Virtual Invoice is just a placeholder *until* paid.

        // Therefore: The Virtual Invoice Amount should be `Remaining Amount`.
        // If 0, it doesn't generate a Virtual Transaction (or generates one with 0 value/paid).

        if (remainingAmount > 0.01) {
            processed.push({
                id: `virtual-invoice-${group.card.id}-${group.dueDate}`,
                description: `Fatura – ${group.card.name}`,
                amount: remainingAmount, // Only show what is LEFT to pay
                type: 'expense',
                date: group.dueDate,
                isPaid: false,
                accountId: group.children[0]?.accountId || '', // Fallback
                categoryId: '', // Needs a category?
                isVirtual: true,
                virtualChildren: group.children
            } as ProcessedTransaction);
        }

        // What if fully paid? We don't need a virtual invoice. 
        // The Real Payment (Expense) transaction handles the "Cash Flow".
        // The Card "Compromisso" is gone.
    });

    return processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
