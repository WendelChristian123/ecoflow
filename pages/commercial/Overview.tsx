
import React, { useState, useMemo, useEffect } from 'react';
import { translateQuoteStatus } from '../../utils/i18n';
import { api } from '../../services/api';
import { Quote, User, Contact, CatalogItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Loader, Badge, StatCard } from '../../components/Shared';
import { TrendingUp, DollarSign, FileText, Plus, BarChart2, PieChart, X, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay } from 'date-fns';
import { formatDate, parseDateLocal } from '../../utils/formatters';
import { Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie } from 'recharts';
import { CommercialReportModal } from '../../components/Reports/CommercialReportModal';
import { QuoteModal, QuoteApprovalModal, RecurringModal } from '../../components/CommercialModals';
import { TransactionModal } from '../../components/Modals';
import { commercialLogic } from '../../services/commercialLogic';
import { kanbanService } from '../../services/kanbanService';
import { KanbanStage, FinancialCategory, FinancialAccount, RecurringService } from '../../types';



// Internal Drilldown Modal
interface DrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    quotes: Quote[];
    users: User[];
    onQuoteClick: (q: Quote) => void;
}

const DrilldownModal: React.FC<DrilldownModalProps> = ({ isOpen, onClose, title, quotes, users, onQuoteClick }) => {
    if (!isOpen) return null;

    const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'N/A';
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-card rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 flex justify-between items-center bg-muted/20 rounded-t-xl">
                    <h3 className="text-lg font-bold text-foreground">{title}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {quotes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                            <FileText size={32} className="opacity-20" />
                            <span>Nenhum orçamento encontrado nesta categoria.</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {quotes.map(q => (
                                <div key={q.id}
                                    onClick={() => onQuoteClick(q)}
                                    className="bg-card p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 hover:shadow-sm cursor-pointer transition-all group hover:bg-accent/50"
                                >
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                            #{q.id.substring(0, 4)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-foreground">{q.customerName || q.contact?.name || 'Cliente sem nome'}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                {formatDate(q.date || q.createdAt)} {q.validUntil ? ` • Venc: ${formatDate(q.validUntil)}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{fmt(q.totalValue)}</div>
                                        <Badge variant={q.status === 'approved' ? 'success' : q.status === 'rejected' ? 'error' : (q.validUntil && parseDateLocal(q.validUntil) < startOfDay(new Date())) ? 'neutral' : 'warning'}>
                                            {(q.status === 'approved' ? 'NEGÓCIO FECHADO' : q.status === 'rejected' ? 'NEGÓCIO PERDIDO' : (q.validUntil && parseDateLocal(q.validUntil) < startOfDay(new Date())) ? 'VENCIDO' : (q.stage?.name || translateQuoteStatus(q.status))).toUpperCase()}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// Helper for classes
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export const CommercialOverview: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Data
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [kanbanStages, setKanbanStages] = useState<KanbanStage[]>([]);

    // UI State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Drilldown State
    const [drilldownType, setDrilldownType] = useState<string | null>(null);
    const [editingQuote, setEditingQuote] = useState<Quote | undefined>(undefined);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

    // Approval Workflow State
    const [approvedQuote, setApprovedQuote] = useState<Quote | undefined>(undefined);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [transactionInitialData, setTransactionInitialData] = useState<any>(undefined);
    const [recurringInitialData, setRecurringInitialData] = useState<Partial<RecurringService> | undefined>(undefined);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // Lazy check for expiration
            await commercialLogic.checkAndEnforceQuoteExpiration();

            const [fetchedQuotes, fetchedUsers, fetchedContacts, fetchedCatalog, kbs, fc, acc] = await Promise.all([
                api.getQuotes(),
                api.getUsers(),
                api.getContacts(),
                api.getCatalogItems(),
                kanbanService.listKanbans('crm'),
                api.getFinancialCategories(),
                api.getFinancialAccounts()
            ]);
            setQuotes(fetchedQuotes);
            setUsers(fetchedUsers || []);
            setContacts(fetchedContacts || []);
            setCatalog(fetchedCatalog || []);
            setFinancialCategories(fc);
            setAccounts(acc);
            
            const allStages = kbs.reduce((acc: KanbanStage[], k) => {
                if (k.stages) return [...acc, ...k.stages];
                return acc;
            }, []);
            setKanbanStages(allStages);
        } catch (error) {
            console.error('Error loading commercial data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprovalFlow = async (quote: Quote) => {
        let currentQuote = { ...quote };
        if (!currentQuote.contactId) {
            try {
                const newContact = await api.addContact({
                    name: currentQuote.customerName || 'Cliente Novo',
                    phone: currentQuote.customerPhone,
                    scope: 'client',
                    type: 'pj'
                });
                setContacts(prev => [...prev, newContact]);
                await api.updateQuote({ id: currentQuote.id, contactId: newContact.id } as any, null as any);
                currentQuote.contactId = newContact.id;
                currentQuote.contact = newContact;
                setQuotes(prev => prev.map(q => q.id === currentQuote.id ? { ...q, contactId: newContact.id, contact: newContact } : q));
            } catch (error) {
                console.error("Failed to auto-create contact", error);
                alert("Erro ao criar contato automaticamente. Verifique os dados do cliente.");
                return;
            }
        }
        setApprovedQuote(currentQuote);
        setIsApprovalModalOpen(true);
    };

    const handleApprovalDecision = (option: 'contract' | 'finance') => {
        setIsApprovalModalOpen(false);
        if (!approvedQuote) return;

        if (option === 'finance') {
            const firstItem = approvedQuote.items?.[0];
            const catItem = catalog.find(c => c.id === firstItem?.catalogItemId);

            setTransactionInitialData({
                description: `Venda: ${approvedQuote.contact?.name || approvedQuote.customerName} (Orç #${approvedQuote.id.substring(0, 4)})`,
                amount: approvedQuote.totalValue,
                type: 'income',
                date: new Date().toISOString().split('T')[0],
                contactId: approvedQuote.contactId,
                categoryId: catItem?.financialCategoryId || ''
            });
            setIsTransactionModalOpen(true);
        } else {
            setRecurringInitialData({
                contactId: approvedQuote.contactId,
                startDate: new Date().toISOString().split('T')[0],
                description: `Contrato Ref. Orçamento #${approvedQuote.id.substring(0, 4)}`,
                amount: approvedQuote.totalValue,
                active: true,
                contractMonths: 12
            });
            setIsRecurringModalOpen(true);
        }
    };

    // --- KPI CALCULATIONS ---
    const kpiData = useMemo(() => {
        const totalQuotes = quotes.length;
        const now = new Date();
        
        const approved = quotes.filter(q => q.status === 'approved' || kanbanStages.find(s => s.id === q.kanbanStageId)?.systemStatus === 'approved');
        const rejected = quotes.filter(q => q.status === 'rejected' || kanbanStages.find(s => s.id === q.kanbanStageId)?.systemStatus === 'rejected');
        
        const overdue = quotes.filter(q => {
            const st = kanbanStages.find(s => s.id === q.kanbanStageId)?.systemStatus || q.status;
            return st === 'expired' || (st !== 'approved' && st !== 'rejected' && q.validUntil && new Date(q.validUntil) < now);
        });

        const open = quotes.filter(q => {
            const st = kanbanStages.find(s => s.id === q.kanbanStageId)?.systemStatus || q.status;
            return ['draft', 'sent'].includes(st) && !(q.validUntil && new Date(q.validUntil) < now);
        });

        const conversionRate = totalQuotes > 0 ? (approved.length / totalQuotes) * 100 : 0;

        return {
            totalQuotes,
            conversionRate,
            approvedCount: approved.length,
            lostCount: rejected.length,
            overdueCount: overdue.length,
            openCount: open.length,
            listApproved: approved,
            listLost: rejected,
            listOverdue: overdue,
            listOpen: open,
            listTotal: quotes
        };
    }, [quotes, kanbanStages]);

    // --- CHARTS DATA ---
    const STATUS_COLORS: Record<string, string> = {
        'rascunho': '#64748b',       // slate-500
        'enviado': '#3b82f6',        // blue-500
        'visualizado': '#3b82f6',    // blue-500
        'negociação': '#f59e0b',     // amber-500
        'em negociação': '#f59e0b',  // amber-500
        'negócio fechado': '#10b981',// emerald-500
        'negócio perdido': '#f43f5e',// rose-500
        'vencido': '#64748b',        // slate-500
        'vencidos': '#64748b',       // slate-500
    };
    const DEFAULT_COLOR = '#64748b'; // Fallback to slate

    const statusDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        quotes.forEach(q => {
            let s = q.status;
            const stage = kanbanStages.find(st => st.id === q.kanbanStageId) || kanbanStages.find(st => st.systemStatus === q.status);
            
            if (stage) {
                s = stage.name;
            } else {
                const isOverdue = q.status === 'expired' || (q.validUntil && new Date(q.validUntil) < new Date());
                if (isOverdue && !['approved', 'rejected'].includes(q.status)) {
                    s = 'Vencidos';
                } else {
                    if (s === 'draft') s = 'Rascunho';
                    else if (s === 'sent') s = 'Enviado';
                    else if (s === 'viewed') s = 'Visualizado';
                    else if (s === 'negotiation') s = 'Em Negociação';
                    else if (s === 'approved') s = 'Negócio Fechado';
                    else if (s === 'rejected') s = 'Negócio Perdido';
                    else s = 'Desconhecido';
                }
            }
            counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => {
                const lowerName = name.toLowerCase();
                let finalColor = STATUS_COLORS[lowerName] || DEFAULT_COLOR;

                return { name, value, color: finalColor };
            })
            .sort((a, b) => b.value - a.value);
    }, [quotes, kanbanStages]);

    const recentActivity = useMemo(() => {
        return [...quotes]
            .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
            .slice(0, 50); // Show more since we have space
    }, [quotes]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <Loader />
            </div>
        );
    }



    // Drilldown Helper
    const getDrilldownData = () => {
        switch (drilldownType) {
            case 'total': return { title: 'Todos os Orçamentos', list: kpiData.listTotal };
            case 'negotiation': return { title: 'Em Negociação (Vigentes)', list: kpiData.listOpen };
            case 'approved': return { title: 'Negócios Fechados', list: kpiData.listApproved };
            case 'lost': return { title: 'Negócios Perdidos', list: kpiData.listLost };
            case 'overdue': return { title: 'Orçamentos Vencidos', list: kpiData.listOverdue };
            default: return { title: '', list: [] };
        }
    };

    const drilldownInfo = getDrilldownData();

    return (
        <div className="flex-1 flex flex-col gap-3 pt-3 pr-2 overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-3">
                <div>
                    <h1 className="text-lg font-bold text-foreground tracking-tight">Dashboard Comercial</h1>
                    <p className="text-muted-foreground text-[10px]">Visão geral de performance.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <Button variant="secondary" className="gap-1.5 h-7 text-[10px]" onClick={() => setIsReportModalOpen(true)}>
                        <FileText size={14} className="text-primary" /> Relatórios
                    </Button>
                    <Button className="h-7 text-[10px] gap-1.5 shadow-lg shadow-success/20" onClick={() => { setEditingQuote(undefined); setIsQuoteModalOpen(true); }}>
                        <Plus size={14} /> Novo Orçamento
                    </Button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
                <div onClick={() => setDrilldownType('negotiation')} className="cursor-pointer h-full">
                    <StatCard
                        title="Em Negociação"
                        value={kpiData.openCount}
                        icon={TrendingUp}
                        variant="warning"
                        subtitle="Abertos"
                        size="sm"
                        className="h-full"
                    />
                </div>
                <div onClick={() => setDrilldownType('approved')} className="cursor-pointer h-full">
                    <StatCard
                        title="Negócio Fechado"
                        value={kpiData.approvedCount}
                        icon={CheckCircle}
                        variant="success"
                        subtitle="Aprovados"
                        size="sm"
                        className="h-full"
                    />
                </div>
                <div onClick={() => setDrilldownType('lost')} className="cursor-pointer h-full">
                    <StatCard
                        title="Negócio Perdido"
                        value={kpiData.lostCount}
                        icon={XCircle}
                        variant="danger"
                        subtitle="Rejeitados"
                        size="sm"
                        className="h-full"
                    />
                </div>
                <div onClick={() => setDrilldownType('overdue')} className="cursor-pointer h-full">
                    <StatCard
                        title="Vencidos"
                        value={kpiData.overdueCount}
                        icon={XCircle}
                        variant="danger"
                        subtitle="Expirados"
                        size="sm"
                        className="h-full"
                    />
                </div>
                <StatCard
                    title="Taxa de Conversão"
                    value={`${kpiData.conversionRate.toFixed(1)}%`}
                    icon={BarChart2}
                    variant={kpiData.conversionRate >= 50 ? 'success' : kpiData.conversionRate >= 20 ? 'warning' : 'danger'}
                    subtitle="Aprov / Total"
                    size="sm"
                    className="h-full"
                />
            </div>

            {/* Main Content Area (Chart) */}
            <div className="flex-1 min-h-0">
                {/* Chart Section */}
                <Card variant="solid" className="flex flex-col h-full overflow-hidden p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2 shrink-0">
                        <PieChart size={16} className="text-primary" /> Distribuição por Status
                    </h3>
                    <div className="flex-1 w-full min-h-0 relative flex flex-col md:flex-row items-stretch gap-3 overflow-y-auto md:overflow-hidden pb-3 md:pb-0">
                        {/* Chart Area */}
                        <div className="h-64 md:h-full min-h-[250px] w-full md:w-1/2 relative shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                    />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            {/* Center Label */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <span className="text-2xl font-black text-foreground">{kpiData.totalQuotes}</span>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total</div>
                                </div>
                            </div>
                        </div>

                        {/* Legend Area with Progress Bars */}
                        <div className="w-full md:w-1/2 md:flex-1 h-auto md:h-full overflow-y-visible md:overflow-y-auto custom-scrollbar flex flex-col justify-center pr-2 gap-2.5 shrink-0">
                            {statusDistribution.length > 0 ? statusDistribution.map((item, idx) => {
                                const percentage = Math.round((item.value / kpiData.totalQuotes) * 100);
                                return (
                                    <div key={idx} className="group p-2.5 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                                        {/* Top Row: Icon, Name, Count, Percentage */}
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                                                    <span className="text-[11px] font-semibold text-foreground">{item.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-foreground tabular-nums">{item.value}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground w-8 text-right tabular-nums">
                                                    {percentage}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: item.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center text-sm text-muted-foreground italic">Sem dados para exibir</div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Modals */}
            <CommercialReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                quotes={quotes}
                users={users}
            />

            <DrilldownModal
                isOpen={!!drilldownType}
                onClose={() => setDrilldownType(null)}
                title={drilldownInfo.title}
                quotes={drilldownInfo.list}
                users={users}
                onQuoteClick={(q) => {
                    setEditingQuote(q);
                    setIsQuoteModalOpen(true);
                }}
            />

            {/* Note: QuoteModal is complex, assuming it adapts or has its own internal styles. 
                We might need to check it if it uses hardcoded colors. */}
            <QuoteModal
                isOpen={isQuoteModalOpen}
                onClose={() => setIsQuoteModalOpen(false)}
                onSuccess={(savedQuote) => {
                    loadData();
                    if (savedQuote && savedQuote.status === 'approved') {
                        handleApprovalFlow(savedQuote);
                    }
                }}
                contacts={contacts}
                catalog={catalog}
                initialData={editingQuote}
            />

            <QuoteApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                onOptionSelected={handleApprovalDecision}
            />

            <TransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                onSuccess={() => { loadData(); }}
                contacts={contacts}
                categories={financialCategories}
                accounts={accounts}
                initialData={transactionInitialData}
            />

            <RecurringModal
                isOpen={isRecurringModalOpen}
                onClose={() => setIsRecurringModalOpen(false)}
                onSave={loadData}
                contacts={contacts}
                catalog={catalog}
                financialCategories={financialCategories}
                bankAccounts={accounts}
                initialData={recurringInitialData}
            />
        </div>
    );
};
