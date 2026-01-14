
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
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-slate-800 border border-slate-700/50 p-6 rounded-xl relative overflow-hidden flex flex-col justify-between h-full transition-all group",
                onClick ? "cursor-pointer hover:border-slate-500 hover:shadow-lg hover:-translate-y-1" : ""
            )}
        >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-slate-400 text-sm font-medium uppercase tracking-wide group-hover:text-slate-300 transition-colors">{title}</span>
                <div className={cn("p-2 rounded-lg", colors[color])}>{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-1 group-hover:text-slate-400 transition-colors">{subtitle}</div>}
            </div>
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {quotes.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">Nenhum orçamento encontrado nesta categoria.</div>
                    ) : (
                        <div className="space-y-2">
                            {quotes.map(q => (
                                <div key={q.id}
                                    onClick={() => onQuoteClick(q)}
                                    className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-lg flex items-center justify-between hover:bg-slate-800 hover:border-emerald-500/30 cursor-pointer transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 font-mono text-xs text-slate-400">
                                            #{q.id.substring(0, 4)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{q.clientName || 'Cliente sem nome'} ({q.title})</div>
                                            <div className="text-xs text-slate-400 flex items-center gap-2">
                                                {format(parseISO(q.createdAt || q.date), 'dd/MM/yyyy')} • {getUserName(q.userId)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-emerald-400 text-lg">{fmt(q.totalValue)}</div>
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
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
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

    const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#f43f5e', '#64748b'];

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
        <div className="h-[calc(100vh-64px)] bg-slate-950 text-slate-100 p-4 md:p-6 overflow-hidden flex flex-col gap-6">

            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Comercial</h1>
                    <p className="text-slate-400 text-sm">Visão geral de performance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800 text-slate-300 h-9 text-sm" onClick={() => setIsReportModalOpen(true)}>
                        <FileText size={16} /> Relatórios
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-9 text-sm" onClick={() => { setEditingQuote(undefined); setIsQuoteModalOpen(true); }}>
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

            {/* Main Content Area (Charts + Activity) - Fills remaining height */}
            <div className="flex-1 min-h-0">
                {/* Chart Section */}
                <Card className="flex flex-col h-full overflow-hidden">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 shrink-0">
                        <PieChart size={18} className="text-indigo-400" /> Distribuição por Status
                    </h3>
                    <div className="flex-1 w-full min-h-0 relative">
                        <ResponsiveContainer width="99%" height="100%">
                            <RechartsPieChart>
                                <Pie
                                    data={statusDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="60%"
                                    outerRadius="80%"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                        {/* Center Label */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <span className="text-3xl font-bold text-white">{kpiData.totalQuotes}</span>
                                <div className="text-xs text-slate-500 uppercase tracking-widest">Total</div>
                            </div>
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

            <QuoteModal
                isOpen={isQuoteModalOpen}
                onClose={() => setIsQuoteModalOpen(false)}
                onSuccess={() => {
                    loadData();
                    setIsQuoteModalOpen(false);
                    // Optionally keep drilldown open, or close it. 
                    // Let's keep drilldown open so they can edit multiple.
                }}
                contacts={contacts}
                catalog={catalog}
                initialData={editingQuote}
            />
        </div>
    );
};
