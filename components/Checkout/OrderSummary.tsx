import React from 'react';
import { Card, Button, cn } from '../Shared';
import { Check, ShieldCheck } from 'lucide-react';
import { SaasPlan } from '../../types';

interface OrderSummaryProps {
    plan: SaasPlan;
    cycle: 'monthly' | 'semiannual' | 'annual';
    onCycleChange: (cycle: 'monthly' | 'semiannual' | 'annual') => void;
    loading?: boolean;
    onSubscribe: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ plan, cycle, onCycleChange, loading, onSubscribe }) => {

    // Determine price based on cycle
    const getPrice = () => {
        switch (cycle) {
            case 'monthly': return plan.priceMonthly || plan.price || 0;
            case 'semiannual': return (plan.priceSemiannually || 0) / 6; // Display monthly equivalent? 
            // Wait, typically we show the monthly price *equivalent* big, and total small.
            // Or we show the actual price for the period? 
            // The previous implementation showed "R$ X /mês".
            // If I select 'annual', usually I want to see the monthly equivalent "R$ 80/mo (billed R$ 960/yr)".

            // Let's assume priceMonthly/Semiannually/Yearly in SaasPlan are the TOTAL for that period?
            // Checking api.ts: `price_monthly`, `price_yearly`.
            // Usually `price_yearly` is the total year price.
            // Let's verify standard SaaS pattern.
            // If I have `priceYearly`, the monthly equivalent is `priceYearly / 12`.

        }
        return 0;
    };

    let basePrice = 0;
    let total = 0;
    let months = 1;

    if (cycle === 'monthly') {
        basePrice = plan.priceMonthly || 0;
        total = basePrice;
        months = 1;
    } else if (cycle === 'semiannual') {
        const totalSemiannual = plan.priceSemiannually || 0;
        basePrice = totalSemiannual / 6;
        total = totalSemiannual;
        months = 6;
    } else if (cycle === 'annual') {
        const totalYearly = plan.priceYearly || 0;
        basePrice = totalYearly / 12;
        total = totalYearly;
        months = 12;
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-700">
            <Card className="bg-card border-primary/20 shadow-premium overflow-visible relative">
                {/* Header Gradient */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-emerald-500 rounded-t-xl" />

                <div className="mb-6">
                    <label className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 block">
                        Plano Selecionado
                    </label>
                    <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                    {/* Description is not in SaasPlan type, assume generic or omit */}
                    <p className="text-sm text-muted-foreground mt-1">Acesso completo aos recursos selecionados</p>
                </div>

                {/* Cycle Selector */}
                <div className="flex bg-muted/50 p-1 rounded-lg mb-6 border border-border">
                    <button
                        onClick={() => onCycleChange('monthly')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                            cycle === 'monthly' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Mensal
                    </button>
                    <button
                        onClick={() => onCycleChange('semiannual')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all relative",
                            cycle === 'semiannual' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Semestral
                        <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                            -10%
                        </span>
                    </button>
                    <button
                        onClick={() => onCycleChange('annual')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all relative",
                            cycle === 'annual' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Anual
                        <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                            -20%
                        </span>
                    </button>
                </div>

                {/* Price Display */}
                <div className="mb-6 border-b border-border/50 pb-6">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">
                            R$ {basePrice.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    {/* Always show total calculation for clarity */}
                    <div className="text-sm text-muted-foreground mt-1">
                        Total de <strong className="text-foreground">R$ {total.toFixed(2).replace('.', ',')}</strong> / {cycle === 'monthly' ? 'mês' : cycle === 'semiannual' ? 'semestre' : 'ano'}
                    </div>
                </div>

                {/* Cupom (Colapsado) */}
                <div className="mb-6">
                    <details className="group">
                        <summary className="flex items-center text-xs text-primary cursor-pointer hover:underline list-none select-none font-medium transition-colors">
                            Possui um cupom de desconto?
                        </summary>
                        <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <input
                                type="text"
                                placeholder="CÓDIGO"
                                className="flex-1 bg-background border border-border rounded text-sm px-3 py-1.5 outline-none focus:border-primary uppercase placeholder:normal-case"
                            />
                            <button className="text-xs bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1 rounded border border-border transition-colors font-medium">
                                Aplicar
                            </button>
                        </div>
                    </details>
                </div>

                {/* Benefits */}
                <ul className="space-y-3 mb-8">
                    {plan.features?.map((benefit, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                            <div className="mt-0.5 min-w-4 min-h-4 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <Check size={10} strokeWidth={3} />
                            </div>
                            <span>{benefit}</span>
                        </li>
                    ))}
                </ul>

                <Button
                    onClick={onSubscribe}
                    className="w-full h-12 text-base font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                    disabled={loading}
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processando...
                        </div>
                    ) : (
                        "Assinar Agora"
                    )}
                </Button>

                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                    <ShieldCheck size={12} />
                    Compra 100% Segura e Criptografada
                </div>
            </Card>

            {/* Trust Badges / Guarantee */}
            <div className="flex justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                {/* Placeholders for card flags or security seals */}
                <div className="h-6 w-10 bg-muted rounded" />
                <div className="h-6 w-10 bg-muted rounded" />
                <div className="h-6 w-10 bg-muted rounded" />
            </div>
        </div>
    );
};
