import React, { useEffect, useState } from 'react';
import { useCompany } from '../context/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, Loader } from './Shared';
import { Crown, Calendar, CreditCard, Clock, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SubscriptionData {
    id: string;
    status: string;
    cycle: string;
    billing_type: string | null;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string;
    canceled_at: string | null;
    cancel_at_period_end: boolean;
    asaas_subscription_id: string | null;
    plan_name: string;
}

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    // Parse as UTC and adjust to local date to avoid timezone shift
    const date = new Date(dateStr);
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return format(localDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const cycleLabel = (cycle: string) => {
    if (cycle === 'monthly') return 'Mensal';
    if (cycle === 'semiannual') return 'Semestral';
    if (cycle === 'annual') return 'Anual';
    return cycle;
};

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
    active: { label: 'Ativa', variant: 'success' },
    trialing: { label: 'Período de Teste', variant: 'warning' },
    canceled: { label: 'Cancelada', variant: 'error' },
    pending_payment: { label: 'Pagamento Pendente', variant: 'warning' },
    overdue: { label: 'Em Atraso', variant: 'error' },
};

export const MyPlanTab: React.FC = () => {
    const { currentCompany } = useCompany();
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentCompany?.id) return;

        const fetchSubscription = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('subscriptions')
                .select(`
                    id, status, cycle, billing_type,
                    trial_ends_at, current_period_start, current_period_end,
                    created_at, canceled_at, cancel_at_period_end,
                    asaas_subscription_id,
                    saas_plans ( name )
                `)
                .eq('company_id', currentCompany.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                setSubscription({
                    ...data,
                    plan_name: (data as any).saas_plans?.name || 'Plano Personalizado',
                });
            }
            setLoading(false);
        };

        fetchSubscription();
    }, [currentCompany?.id]);

    if (loading) return <Loader />;

    if (!subscription) {
        return (
            <Card className="p-8 text-center" variant="solid">
                <div className="text-muted-foreground space-y-4">
                    <Crown size={40} className="mx-auto opacity-40" />
                    <p>Nenhuma assinatura encontrada.</p>
                    <Button onClick={() => navigate('/checkout')}>
                        Escolher um Plano
                    </Button>
                </div>
            </Card>
        );
    }

    const status = statusConfig[subscription.status] || statusConfig.active;
    const isTrialing = subscription.status === 'trialing';
    const isActive = subscription.status === 'active';
    const isCanceled = subscription.status === 'canceled' || subscription.cancel_at_period_end;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Plan Header Card */}
            <Card className="p-6 relative overflow-hidden" variant="solid">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-3 rounded-xl">
                                <Crown size={24} className="text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground">{subscription.plan_name}</h2>
                                <p className="text-sm text-muted-foreground">
                                    Ciclo {cycleLabel(subscription.cycle)}
                                </p>
                            </div>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Trial Info */}
                        {subscription.trial_ends_at && (
                            <>
                                <InfoCard
                                    icon={<Clock size={18} />}
                                    label="Início do Trial"
                                    value={formatDate(subscription.created_at)}
                                    color="amber"
                                />
                                <InfoCard
                                    icon={<AlertTriangle size={18} />}
                                    label="Fim do Trial"
                                    value={formatDate(subscription.trial_ends_at)}
                                    color="amber"
                                />
                            </>
                        )}

                        {/* Active Subscription Info */}
                        {isActive && (
                            <>
                                <InfoCard
                                    icon={<Sparkles size={18} />}
                                    label="Início da Assinatura"
                                    value={formatDate(subscription.current_period_start)}
                                    color="emerald"
                                />
                                <InfoCard
                                    icon={<Calendar size={18} />}
                                    label="Próximo Vencimento"
                                    value={formatDate(subscription.current_period_end)}
                                    color="emerald"
                                />
                                <InfoCard
                                    icon={<CreditCard size={18} />}
                                    label="Forma de Pagamento"
                                    value={subscription.billing_type === 'credit_card' ? 'Cartão de Crédito' : subscription.billing_type === 'pix' ? 'PIX' : '—'}
                                    color="emerald"
                                />
                            </>
                        )}

                        {/* Canceled Info */}
                        {isCanceled && subscription.canceled_at && (
                            <InfoCard
                                icon={<AlertTriangle size={18} />}
                                label="Cancelada em"
                                value={formatDate(subscription.canceled_at)}
                                color="rose"
                            />
                        )}
                    </div>
                </div>
            </Card>

            {/* Actions */}
            {isTrialing && (
                <Card className="p-6 border-emerald-500/20 bg-emerald-500/5" variant="solid">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-foreground font-semibold">Pronto para assinar?</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Ative agora para não perder acesso quando o trial acabar.
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate(`/checkout?plan=${currentCompany?.planId}&cycle=${subscription.cycle}`)}
                            className="gap-2"
                        >
                            Assinar Agora <ArrowRight size={16} />
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
};

// Sub-component
const InfoCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'amber' | 'emerald' | 'rose';
}> = ({ icon, label, value, color }) => {
    const colorMap = {
        amber: 'text-amber-500 bg-amber-500/10',
        emerald: 'text-emerald-500 bg-emerald-500/10',
        rose: 'text-rose-500 bg-rose-500/10',
    };

    return (
        <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${colorMap[color]}`}>
                    {icon}
                </div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{value}</p>
        </div>
    );
};
