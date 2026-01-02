
import { processTransactions } from '../services/financeLogic';
import { FinancialTransaction, CreditCard } from '../types';

// Mocks
const mockCard: CreditCard = {
    id: 'card1',
    name: 'Nubank - PJ',
    closingDay: 1, // Closes on the 1st
    dueDay: 7,     // Due on the 7th
    limit: 5000,
    accountId: 'acc1',
    color: 'purple',
    tenantId: 'tenant1'
};

const mockTransactions: FinancialTransaction[] = [
    // 1. Regular Expense (Should stay)
    {
        id: 't1', description: 'Regular Expense', amount: 100, type: 'expense', date: '2026-01-10', isPaid: true, accountId: 'acc1', tenantId: 'tenant1'
    },
    // 2. Card Expense - Current Invoice (Purchased Jan 2nd, closes Jan 1st - Belongs to FEB Invoice? No Wait.)
    // Closing Day 1. Purchase Day 2.
    // Invoice for Jan closes Jan 1. So Jan 2 purchase is for Feb Invoice.
    // Let's adjust mock to be clearer.
    // Closing Day 25. Due Day 5.
];

const mockCardStandard: CreditCard = {
    id: 'card_standard',
    name: 'Standard Card',
    closingDay: 25,
    dueDay: 5,
    limit: 1000,
    accountId: 'acc1',
    color: 'blue',
    tenantId: 'tenant1'
};

// SCENARIO 1: Purchase BEFORE Closing Day
// Purchase: Jan 10. Closing: Jan 25. Due: Feb 5.
// Result: Invoice Date should be Feb 5?
// Wait. Usually:
// Jan 10 purchase.
// Current period: Dec 25 to Jan 25.
// Invoice closes Jan 25.
// Due date usually is next month? Or same month?
// Common Brazil: Closes 25th, Due 5th of NEXT month.
// Let's check logic in financeLogic.ts:
// if (day > closingDay) dueMonth = addMonths(purchaseDate, 1);
// else dueMonth = purchaseDate?
// If purchase Jan 10 (day 10) <= Closing (25): dueMonth = Jan.
// then dueDate = Jan 5.
// Wait. If I buy in Jan 10, and due day is 5, Jan 5 is past. It must be Feb 5.
// The logic `dueDateObj = new Date(dueMonth.getFullYear(), dueMonth.getMonth(), dueDay)`
// If dueMonth is Jan, result is Jan 5.
// Logic seems FLOCKED if Due Day < Closing Day (Standard).
// If Closing is 25, Due is 5.
// Purchase Jan 10.
// Is in "Jan Invoice"?
// Yes, closed Jan 25.
// Paid Feb 5.
// Code does: day(10) <= closing(25) -> dueMonth = Jan.
// Result: Jan 5. -> WRONG. Should be Feb 5.

// SCENARIO 2: Purchase AFTER Closing Day
// Purchase: Jan 26. Closing: Jan 25.
// day(26) > closing(25) -> dueMonth = Feb.
// Result: Feb 5. -> Correct.

console.log("--- STARTING TESTS ---");

const t_before_closing: FinancialTransaction = {
    id: 't_before', description: 'Before Closing', amount: 50, type: 'expense', date: '2026-01-10', isPaid: false, creditCardId: 'card_standard', accountId: 'acc1', tenantId: 't1'
};

const t_after_closing: FinancialTransaction = {
    id: 't_after', description: 'After Closing', amount: 75, type: 'expense', date: '2026-01-26', isPaid: false, creditCardId: 'card_standard', accountId: 'acc1', tenantId: 't1'
};

const allTrans = [t_before_closing, t_after_closing];

// TEST 1: Competence Mode
console.log("\n[TEST 1] Competence Mode");
const res_comp = processTransactions(allTrans, [mockCardStandard], 'competence');
console.log("Count:", res_comp.length); // Should be 2
console.log("Items:", res_comp.map(t => `${t.description} - ${t.date}`));

// TEST 2: Cash Mode
console.log("\n[TEST 2] Cash Mode");
const res_cash = processTransactions(allTrans, [mockCardStandard], 'cash');
console.log("Count:", res_cash.length); // Should be 2 virtual invoices?
// Analyze expected:
// t_before (Jan 10): Closes Jan 25. Due: ??? (Current logic: Jan 5 - PAST).
// t_after (Jan 26): Closes Feb 25. Due: Feb 5.

res_cash.forEach(t => {
    console.log(`[Virtual] ${t.description} - Date: ${t.date} - Amt: ${t.amount}`);
    if (t.virtualChildren) {
        console.log(`   Contains: ${t.virtualChildren.map(c => c.description).join(', ')}`);
    }
});

// Logic Check for "Due Day < Closing Day" anomaly.
// If valid/real world: Closing 25 Jan. Payment 05 Feb.
// My logic: if dueDay < closingDay, always add 1 month?
// Or does the user configure this? Currently logic is implicit.
// Let's assume most cards Due Day is AFTER Closing Day in the calendar flow.
// If Closing=25, Due=5. 5 < 25.
// So for Jan invoice (Jan 25 close), Due is Feb 5.
// Logic needs to handle "Due Day < Closing Day implies Next Month".

