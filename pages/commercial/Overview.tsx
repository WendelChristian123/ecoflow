
import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../../services/api';
import { Quote, User, Contact, CatalogItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Loader, Badge } from '../../components/Shared';
import { TrendingUp, DollarSign, FileText, Plus, BarChart2, PieChart, X, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie } from 'recharts';
import { CommercialReportModal } from '../../components/Reports/CommercialReportModal';
import { QuoteModal } from '../../components/CommercialModals'; // Imported from Modals

// Components
const KpiCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate';
    subtitle?: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
    const colors = {
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'hover:border-emerald-500/50', header: 'bg-emerald-500' },
        rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'hover:border-rose-500/50', header: 'bg-rose-500' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'hover:border-amber-500/50', header: 'bg-amber-500' },
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'hover:border-indigo-500/50', header: 'bg-indigo-500' },
        slate: { bg: 'bg-secondary', text: 'text-muted-foreground', border: 'hover:border-border', header: 'bg-slate-600' },
    };

    const theme = colors[color];

    return (
        <Card
            variant="solid"
            noPadding={true}
            onClick={onClick}
            className={cn(
                "relative overflow-hidden flex flex-col justify-between h-full transition-all group",
                onClick ? `cursor-pointer hover:shadow-lg hover:-translate-y-1 ${theme.border}` : ""
            )}
        >
            {/* 🎨 Header Bar with Module Name */}
            <div className={cn(
                "px-4 py-2.5 flex items-center justify-between border-b border-white/10 transition-all",
                theme.header
            )}>
                <span className="text-[11px] uppercase tracking-widest text-white font-bold">{title}</span>
                <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg">
                    <div className="text-white">
                        {icon}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 flex flex-col justify-between flex-1 relative z-10">
                <div className="mt-auto">
                    <div className="text-2xl font-black text-foreground tracking-tight">{value}</div>
                    {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
                </div>
            </div>
        </Card>
    );
};

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20 rounded-t-xl">
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
                                    className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border font-mono text-xs text-muted-foreground group-hover:text-foreground group-hover:border-primary/20 transition-colors">
                                            #{q.id.substring(0, 4)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-foreground">{q.clientName || 'Cliente sem nome'} ({q.title})</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                {format(parseISO(q.createdAt || q.date), 'dd/MM/yyyy')} • {getUserName(q.userId)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{fmt(q.totalValue)}</div>
                                        <Badge variant={q.status === 'approved' ? 'success' : q.status === 'rejected' ? 'error' : 'warning'}>
                                            {q.status.toUpperCase()}
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

    // UI State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Drilldown State
    const [drilldownType, setDrilldownType] = useState<'total' | 'negotiation' | 'approved' | 'rejected' | null>(null);
    const [editingQuote, setEditingQuote] = useState<Quote | undefined>(undefined);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [fetchedQuotes, fetchedUsers, fetchedContacts, fetchedCatalog] = await Promise.all([
                api.getQuotes(),
                api.getUsers(),
                api.getContacts(),
                api.getCatalogItems()
            ]);
            setQuotes(fetchedQuotes);
            setUsers(fetchedUsers || []);
            setContacts(fetchedContacts || []);
            setCatalog(fetchedCatalog || []);
        } catch (error) {
            console.error('Error loading commercial data', error);
        } finally {
            setLoading(false);
        }
    };

    // --- KPI CALCULATIONS ---
    const kpiData = useMemo(() => {
        const totalQuotes = quotes.length;
        const approved = quotes.filter(q => q.status === 'approved');
        const rejected = quotes.filter(q => q.status === 'rejected');
        const open = quotes.filter(q => ['draft', 'sent', 'negotiation', 'viewed'].includes(q.status));
        const pipelineValue = open.reduce((acc, q) => acc + q.totalValue, 0);
        const conversionRate = totalQuotes > 0 ? (approved.length / totalQuotes) * 100 : 0;

        return {
            totalQuotes,
            approvedCount: approved.length,
            rejectedCount: rejected.length,
            openCount: open.length, // Negotiation
            pipelineValue,
            conversionRate,
            // Lists for drilldown
            listApproved: approved,
            listRejected: rejected,
            listOpen: open,
            listTotal: quotes
        };
    }, [quotes]);

    // --- CHARTS DATA ---
    const STATUS_COLORS: Record<string, string> = {
        'Rascunho': '#64748b',   // slate-500
        'Enviado': '#f59e0b',    // amber-500
        'Visualizado': '#3b82f6', // blue-500
        'Negociação': '#6366f1', // indigo-500
        'Aprovado': '#10b981',   // emerald-500
        'Rejeitado': '#f43f5e',  // rose-500
    };
    const DEFAULT_COLOR = '#94a3b8';

    const statusDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        quotes.forEach(q => {
            const s = q.status === 'draft' ? 'Rascunho' :
                q.status === 'sent' ? 'Enviado' :
                    q.status === 'viewed' ? 'Visualizado' :
                        q.status === 'negotiation' ? 'Negociação' :
                            q.status === 'approved' ? 'Aprovado' :
                                q.status === 'rejected' ? 'Rejeitado' : q.status;
            counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ 
                name, 
                value, 
                color: STATUS_COLORS[name] || DEFAULT_COLOR 
            }))
            .sort((a, b) => b.value - a.value);
    }, [quotes]);

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
            case 'negotiation': return { title: 'Em Negociação', list: kpiData.listOpen };
            case 'approved': return { title: 'Orçamentos Aprovados', list: kpiData.listApproved };
            case 'rejected': return { title: 'Orçamentos Rejeitados', list: kpiData.listRejected };
            default: return { title: '', list: [] };
        }
    };

    const drilldownInfo = getDrilldownData();

    return (
        <div className="h-[calc(100vh-64px)] bg-background text-foreground p-6 overflow-hidden flex flex-col gap-6 custom-scrollbar">

            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Comercial</h1>
                    <p className="text-muted-foreground text-sm">Visão geral de performance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" className="gap-2 h-9 text-sm" onClick={() => setIsReportModalOpen(true)}>
                        <FileText size={16} className="text-primary" /> Relatórios
                    </Button>
                    <Button className="h-9 text-sm gap-2 shadow-lg shadow-emerald-500/20" onClick={() => { setEditingQuote(undefined); setIsQuoteModalOpen(true); }}>
                        <Plus size={16} /> Novo Orçamento
                    </Button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 shrink-0">
                <KpiCard
                    title="Total Orçamentos"
                    value={kpiData.totalQuotes}
                    icon={<FileText size={18} />}
                    color="slate"
                    subtitle="Base total"
                    onClick={() => setDrilldownType('total')}
                />
                <KpiCard
                    title="Em Negociação"
                    value={kpiData.openCount}
                    icon={<TrendingUp size={18} />}
                    color="amber"
                    subtitle="Abertos"
                    onClick={() => setDrilldownType('negotiation')}
                />
                <KpiCard
                    title="Aprovados"
                    value={kpiData.approvedCount}
                    icon={<CheckCircle size={18} />}
                    color="emerald"
                    subtitle="Fechados"
                    onClick={() => setDrilldownType('approved')}
                />
                <KpiCard
                    title="Rejeitados"
                    value={kpiData.rejectedCount}
                    icon={<XCircle size={18} />}
                    color="rose"
                    subtitle="Perdidos"
                    onClick={() => setDrilldownType('rejected')}
                />
                <KpiCard
                    title="Taxa de Conversão"
                    value={`${kpiData.conversionRate.toFixed(1)}%`}
                    icon={<BarChart2 size={18} />}
                    color="indigo"
                    subtitle="Aprov / Total"
                // No drilldown for rate
                />
            </div>

            {/* Main Content Area (Chart) */}
            <div className="flex-1 min-h-0">
                {/* Chart Section */}
                <Card variant="solid" className="flex flex-col h-full overflow-hidden">
                    <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 shrink-0">
                        <PieChart size={18} className="text-primary" /> Distribuição por Status
                    </h3>
                    <div className="flex-1 w-full min-h-0 relative flex items-center gap-4">
                        {/* Chart Area */}
                        <div className="h-full aspect-square relative shrink-0">
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
                                    <span className="text-3xl font-black text-foreground">{kpiData.totalQuotes}</span>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total</div>
                                </div>
                            </div>
                        </div>

                        {/* Legend Area */}
                        <div className="flex-1 h-full overflow-y-auto custom-scrollbar flex flex-col justify-center pr-2 gap-3">
                            {statusDistribution.length > 0 ? statusDistribution.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground">{item.value}</span>
                                        <span className="text-xs text-muted-foreground w-8 text-right">
                                            {Math.round((item.value / kpiData.totalQuotes) * 100)}%
                                        </span>
                                    </div>
                                </div>
                            )) : (
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
                onSuccess={() => {
                    loadData();
                    setIsQuoteModalOpen(false);
                }}
                contacts={contacts}
                catalog={catalog}
                initialData={editingQuote}
            />
        </div>
    );
};
