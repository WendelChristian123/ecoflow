
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CreditCard, FinancialTransaction, FinancialAccount, FinancialCategory, Contact } from '../../types';
import { Loader, Card, ProgressBar, cn, Button, Modal, Input, Select, CurrencyInput } from '../../components/Shared';
import { TransactionModal, DrilldownModal, CardModal, ConfirmationModal } from '../../components/Modals';
import { CreditCard as CardIcon, Calendar, Plus, FileText, AlertCircle, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { processTransactions, ProcessedTransaction } from '../../services/financeLogic';
import { format, parseISO, isBefore, isAfter, addMonths, startOfDay } from 'date-fns';
import { parseDateLocal } from '../../utils/formatters';
import { ptBR } from 'date-fns/locale';

// --- Local Components ---

interface InvoicePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    card: CreditCard | null;
    invoiceAmount: number;
    accounts: FinancialAccount[];
    onConfirm: (amount: number, accountId: string, date: string) => Promise<void>;
}

const InvoicePaymentModal: React.FC<InvoicePaymentModalProps> = ({ isOpen, onClose, card, invoiceAmount, accounts, onConfirm }) => {
    const [amount, setAmount] = useState<number | undefined>(invoiceAmount);
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && invoiceAmount) setAmount(invoiceAmount);
    }, [isOpen, invoiceAmount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onConfirm(amount || 0, accountId, date);
        setLoading(false);
        onClose();
    };

    if (!isOpen || !card) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Pagar Fatura - ${card.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Valor do Pagamento</label>
                    <CurrencyInput
                        value={amount}
                        onValueChange={setAmount}
                        required
                    />
                    <div className="text-xs text-slate-500 mt-1">
                        Valor Total da Fatura: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoiceAmount)}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Conta de Origem</label>
                    <Select value={accountId} onChange={e => setAccountId(e.target.value)} required>
                        <option value="">Selecione uma conta...</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.initialBalance)})</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Data do Pagamento</label>
                    <Input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                    />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {loading ? 'Processando...' : 'Confirmar Pagamento'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Page ---

export const FinancialCards: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);

    // UI States
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [selectedCardForTx, setSelectedCardForTx] = useState<CreditCard | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentModalData, setPaymentModalData] = useState<{ card: CreditCard, amount: number } | null>(null);
    const [drilldownState, setDrilldownState] = useState<{ isOpen: boolean, title: string, data: any[] }>({ isOpen: false, title: '', data: [] });

    // Management States
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch everything
            const [c, t, a, cat, cont] = await Promise.all([
                api.getCreditCards(),
                api.getFinancialTransactions(),
                api.getFinancialAccounts(),
                api.getFinancialCategories(),
                api.getContacts()
            ]);
            setCards(c);
            setTransactions(t);
            setAccounts(a);
            setCategories(cat);
            setContacts(cont);
        } catch (error) {
            console.error(error);
        } finally { setLoading(false); }
    };

    // --- Actions ---

    const handleCreate = () => {
        setEditingCard(undefined);
        setIsCardModalOpen(true);
    };

    const handleEdit = (e: React.MouseEvent, card: CreditCard) => {
        e.stopPropagation();
        setEditingCard(card);
        setIsCardModalOpen(true);
    };

    const requestDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    };

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            await api.deleteCreditCard(confirmDeleteId);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Não foi possível excluir o cartão. Verifique se existem lançamentos vinculados a ele.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    // --- Logic ---

    const getCardStats = (cardId: string, limit: number) => {
        // Used Limit = Total Expenses on Card - Total Payments (Income) on Card
        const cardTx = transactions.filter(t => t.creditCardId === cardId);
        const totalExpense = cardTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const totalPaid = cardTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

        const used = Math.max(0, totalExpense - totalPaid);
        const available = limit - used;
        const percent = Math.min(100, (used / limit) * 100);

        return { used, available, percent };
    };

    const getCardInvoices = (card: CreditCard) => {
        const processed = processTransactions(transactions, cards, 'cash');

        // Filter for THIS card's virtual invoices
        const virtualInvoices = processed.filter(t =>
            (t as ProcessedTransaction).isVirtual &&
            t.id.startsWith(`virtual-invoice-${card.id}`)
        ) as ProcessedTransaction[];

        // Sort by Date Ascending (Oldest First)
        // Use parseDateLocal for sorting to ensure correctness
        virtualInvoices.sort((a, b) => parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime());

        const today = startOfDay(new Date());

        // Split into Overdue and Current/Future
        const overdueInvoices = virtualInvoices.filter(inv => {
            const dueDate = parseDateLocal(inv.date);
            return isBefore(dueDate, today) && !inv.isPaid;
        });

        let currentInvoice = virtualInvoices.find(inv => {
            const dueDate = parseDateLocal(inv.date);
            return !isBefore(dueDate, today); // Today or Future
        });

        // Calculate Closing Date for the Current Invoice
        if (currentInvoice) {
            const dueDate = parseDateLocal(currentInvoice.date);
            let closingDate = new Date(dueDate);
            const closingDayNum = Number(card.closingDay);
            const dueDayNum = Number(card.dueDay);

            if (dueDayNum < closingDayNum) {
                closingDate = addMonths(closingDate, -1);
            }
            closingDate.setDate(closingDayNum);

            // Check status of Current Invoice
            let status: 'open' | 'closed' | 'overdue' = 'open';
            if (isAfter(today, closingDate)) status = 'closed';

            (currentInvoice as any).closingDate = closingDate;
            (currentInvoice as any).status = status;
        }

        return {
            current: currentInvoice || null,
            overdue: overdueInvoices
        };
    };

    const handlePaymentConfirm = async (amount: number, accountId: string, date: string) => {
        if (!paymentModalData || !paymentModalData.card) return;

        try {
            const expenseTx = await api.addTransaction({
                description: `Pagamento Fatura ${paymentModalData.card.name}`,
                amount: amount,
                type: 'expense',
                accountId: accountId,
                categoryId: categories.find(c => c.name.toLowerCase().includes('pagamento'))?.id || '',
                date: date,
                isPaid: true,
                totalInstallments: 1
            });

            if (expenseTx?.id) {
                await api.addTransaction({
                    description: `Pagamento Fatura (Crédito Local)`,
                    amount: amount,
                    type: 'income',
                    creditCardId: paymentModalData.card.id,
                    accountId: '',
                    categoryId: '',
                    date: date,
                    isPaid: true,
                    totalInstallments: 1,
                    originType: 'technical',
                    originId: expenseTx.id
                });
            }

            await loadData();
        } catch (err) {
            console.error(err);
            alert('Erro ao processar pagamento.');
        }
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <CardIcon className="text-emerald-500" /> Cartões de Crédito
                </h1>
                <Button className="gap-2" onClick={handleCreate}>
                    <Plus size={16} /> Novo Cartão
                </Button>
            </div>

            {cards.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-700 rounded-xl">
                    <div className="bg-slate-800 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                        <CardIcon size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-300">Nenhum cartão encontrado</h3>
                    <p className="text-slate-500 mb-4">Cadastre seus cartões para acompanhar limites e faturas.</p>
                    <Button variant="outline" onClick={handleCreate}>Cadastrar Primeiro Cartão</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {cards.map(card => {
                        const stats = getCardStats(card.id, card.limitAmount);
                        const { current, overdue } = getCardInvoices(card);
                        const invoice = current; // For backward compatibility in render below

                        // Calculate total overdue amount
                        const totalOverdue = overdue.reduce((acc, inv) => acc + inv.amount, 0);

                        return (
                            <Card key={card.id} className="p-0 overflow-hidden bg-slate-900 border-slate-800 group relative">
                                {/* Edit/Delete Overlay */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => handleEdit(e, card)} className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700 shadow-lg">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={(e) => requestDelete(e, card.id)} className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 border border-slate-700 shadow-lg">
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Card Header */}
                                <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-700 p-3 rounded-xl transform rotate-3">
                                            <CardIcon size={32} className="text-slate-200" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{card.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Final ****</span>
                                                <span>Crédito</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Limite Total</div>
                                        <div className="text-lg text-slate-200 font-bold">{fmt(card.limitAmount)}</div>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Limit Bar */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-rose-400 font-medium">Em uso: {fmt(stats.used)}</span>
                                            <span className="text-emerald-400 font-medium">Disponível: {fmt(stats.available)}</span>
                                        </div>
                                        <ProgressBar progress={stats.percent} className="h-2" colorClass={stats.percent > 90 ? 'bg-rose-500' : 'bg-emerald-500'} />
                                    </div>

                                    {/* Overdue Warning Block */}
                                    {overdue.length > 0 && (
                                        <div className="bg-rose-950/30 rounded-xl border border-rose-900/50 p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                                                        <AlertCircle size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-rose-400 uppercase">Faturas em Atraso</h4>
                                                        <p className="text-[10px] text-rose-300/70">{overdue.length} fatura(s) pendente(s)</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-rose-400">{fmt(totalOverdue)}</div>
                                                    <button
                                                        className="text-[10px] text-rose-300 hover:text-rose-200 underline mt-1"
                                                        onClick={() => setDrilldownState({
                                                            isOpen: true,
                                                            title: `Faturas em Atraso: ${card.name}`,
                                                            data: overdue // Simplistic. Ideally drilldown accepts processed transactions.
                                                        })}
                                                    >
                                                        Ver Detalhes
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Current Invoice Block */}
                                    <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-slate-100 uppercase flex items-center gap-2">
                                                <FileText size={16} className="text-indigo-400" /> Fatura Atual
                                            </h4>
                                            {invoice && (
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-1 rounded uppercase",
                                                    (invoice as any).status === 'open' ? "bg-blue-500/10 text-blue-400" :
                                                        (invoice as any).status === 'closed' ? "bg-amber-500/10 text-amber-400" :
                                                            "bg-rose-500/10 text-rose-400"
                                                )}>
                                                    {(invoice as any).status === 'open' ? 'Aberta' : (invoice as any).status === 'closed' ? 'Fechada' : 'Vencida'}
                                                </span>
                                            )}
                                        </div>

                                        {invoice ? (
                                            <div className="flex justify-between items-end">
                                                <div className="space-y-1 text-sm text-slate-400">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} /> Fecha: <span className="text-slate-200 font-medium">{(invoice as any).closingDate ? format((invoice as any).closingDate, 'dd/MM/yyyy') : '--/--'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle size={14} /> Vence: <span className={cn("font-medium", (invoice as any).status === 'overdue' ? 'text-rose-400' : 'text-slate-200')}>{format(parseISO(invoice.date), 'dd/MM/yyyy')}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-500 mb-1">Valor da Fatura</div>
                                                    <div className="text-2xl font-bold text-white mb-3">{fmt(invoice.amount)}</div>
                                                    <Button
                                                        size="sm"
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white w-full shadow-lg shadow-indigo-500/20"
                                                        onClick={() => {
                                                            setPaymentModalData({ card, amount: invoice.amount });
                                                            setIsPaymentModalOpen(true);
                                                        }}
                                                    >
                                                        Pagar Fatura
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-slate-500 text-sm">
                                                Nenhuma fatura futura gerada ainda.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="bg-slate-900/50 p-4 border-t border-slate-800 flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 text-xs border-slate-700 hover:bg-slate-800 text-slate-300"
                                        onClick={() => {
                                            setSelectedCardForTx(card);
                                            setIsTransactionModalOpen(true);
                                        }}
                                    >
                                        <Plus size={14} className="mr-2" /> Novo Lançamento
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 text-xs border-slate-700 hover:bg-slate-800 text-slate-300"
                                        onClick={() => setDrilldownState({
                                            isOpen: true,
                                            title: `Extrato: ${card.name}`,
                                            // Show clean list (no technical)
                                            data: transactions.filter(t => t.creditCardId === card.id && t.originType !== 'technical' && !t.description.includes('Pagamento Fatura (Crédito Local)'))
                                        })}
                                    >
                                        <FileText size={14} className="mr-2" /> Relatório
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="px-2 text-slate-500 hover:text-emerald-500 hover:bg-slate-800"
                                        title="Corrigir Saldo (Limpar Dados Antigos)"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('Deseja limpar registros de pagamentos antigos/inválidos deste cartão para corrigir o saldo "Em Uso"? Apenas faça isso se o limite estiver incorreto.')) {
                                                await api.cleanupCardTechnicalTransactions(card.id);
                                                loadData();
                                            }
                                        }}
                                    >
                                        <RefreshCw size={14} />
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modals */}

            <TransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => { setIsTransactionModalOpen(false); setSelectedCardForTx(null); }}
                onSuccess={loadData}
                accounts={accounts}
                categories={categories}
                cards={cards}
                contacts={contacts}
                initialData={{
                    type: 'expense',
                    creditCardId: selectedCardForTx?.id,
                    accountId: selectedCardForTx ? undefined : accounts[0]?.id
                }}
            />

            <InvoicePaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                card={paymentModalData?.card || null}
                invoiceAmount={paymentModalData?.amount || 0}
                accounts={accounts}
                onConfirm={handlePaymentConfirm}
            />

            <DrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState({ ...drilldownState, isOpen: false })}
                title={drilldownState.title}
                type="finance"
                data={drilldownState.data}
            />

            <CardModal
                isOpen={isCardModalOpen}
                onClose={() => setIsCardModalOpen(false)}
                onSuccess={loadData}
                initialData={editingCard}
            />

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={executeDelete}
                title="Excluir Cartão"
            />

        </div>
    );
};
