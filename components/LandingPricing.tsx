import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SaasPlan } from '../types';
import { Button, cn, Loader, Badge } from './Shared';
import { CheckCircle2, XCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppCatalog {
    modules: any[];
    features: any[];
}

export const LandingPricing: React.FC = () => {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [catalog, setCatalog] = useState<AppCatalog>({ modules: [], features: [] });
    const [loading, setLoading] = useState(true);
    const [cycle, setCycle] = useState<'monthly' | 'semiannual' | 'annual'>('monthly');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [plansData, catalogData] = await Promise.all([
                    api.getPublicPlans(),
                    api.getPublicSystemCatalog()
                ]);
                setPlans(plansData);
                setCatalog(catalogData);
            } catch (error) {
                console.error("Failed to load pricing data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handlePlanSelect = (planType: string) => {
        navigate(`/checkout?plan=${planType}&cycle=${cycle}`);
    };

    const sortedPlans = [...plans].sort((a, b) => {
        const priceA = cycle === 'monthly' ? (a.priceMonthly || 0) :
            cycle === 'semiannual' ? (a.priceSemiannually || 0) :
                (a.priceYearly || 0);

        const priceB = cycle === 'monthly' ? (b.priceMonthly || 0) :
            cycle === 'semiannual' ? (b.priceSemiannually || 0) :
                (b.priceYearly || 0);

        return priceA - priceB;
    });

    if (loading) return <div className="py-20 flex justify-center"><Loader /></div>;

    if (plans.length === 0) {
        return (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                <p>Nenhum plano disponível no momento.</p>
            </div>
        );
    }

    return (
        <section id="plans" className="py-24 px-4 bg-slate-950 relative overflow-hidden">
            <div className="container mx-auto max-w-7xl relative z-10">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-white mb-6">Escolha como começar</h2>

                    <div className="inline-flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 mb-8">
                        {(['monthly', 'semiannual', 'annual'] as const).map((c) => (
                            <button
                                key={c}
                                onClick={() => setCycle(c)}
                                className={cn(
                                    "px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                                    cycle === c
                                        ? "bg-white text-black shadow-lg"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                {c === 'monthly' ? 'Mensal' : c === 'semiannual' ? 'Semestral' : 'Anual'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Centered Flex Layout for Cards */}
                <div className="flex flex-wrap justify-center items-start gap-8">
                    {sortedPlans.map((plan, index) => {
                        const isMostExpensive = index === sortedPlans.length - 1 && sortedPlans.length > 1;

                        // RAW CALCULATIONS
                        const priceTotal = cycle === 'monthly' ? (plan.priceMonthly || 0) :
                            cycle === 'semiannual' ? (plan.priceSemiannually || 0) :
                                (plan.priceYearly || 0);

                        // If cycle is NOT monthly, we want to highlight the MONTHLY equivalent
                        // Main Display = Monthly Equivalent (if long cycle) OR Total (if monthly)
                        const valToHighlight = cycle === 'monthly' ? priceTotal : (priceTotal / (cycle === 'semiannual' ? 6 : 12));
                        const valSubtext = priceTotal;

                        // FORMATTING
                        const displayHighlight = valToHighlight.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        const displaySubtext = valSubtext.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

                        // SAVINGS
                        const basePriceTotal = (plan.priceMonthly || 0) * (cycle === 'semiannual' ? 6 : 12);
                        const savings = basePriceTotal - priceTotal;
                        const showSavings = savings > 0 && cycle !== 'monthly';

                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    "flex flex-col relative overflow-hidden transition-all duration-300 w-full md:max-w-[380px]",
                                    "rounded-3xl border p-8",
                                    isMostExpensive
                                        ? "bg-gradient-to-b from-slate-900 to-slate-950 border-primary shadow-2xl shadow-primary/20 transform md:-translate-y-4 z-10"
                                        : "bg-slate-900 border-slate-800 hover:border-slate-600"
                                )}
                            >
                                {isMostExpensive && (
                                    <>
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-cyan-400"></div>
                                        <div className="absolute top-4 right-4 bg-primary text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full">Recomendado</div>
                                    </>
                                )}

                                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                                <div className="text-slate-400 text-sm mb-6 h-10 line-clamp-2">
                                    {/* Description isn't in DB yet, but name is descriptive usually. */}
                                    Plano completo para sua gestão.
                                </div>

                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className={cn("text-sm", isMostExpensive ? "text-emerald-200" : "text-slate-400")}>R$</span>
                                        <span className={cn("text-5xl font-bold tracking-tighter", isMostExpensive ? "text-white" : "text-white")}>
                                            {displayHighlight}
                                        </span>
                                        <div className="flex flex-col ml-1">
                                            <span className={cn("text-xs font-bold", isMostExpensive ? "text-emerald-200" : "text-slate-400")}>
                                                / mês
                                            </span>
                                        </div>
                                    </div>

                                    {cycle !== 'monthly' && (
                                        <div className="mt-2 text-xs text-slate-500">
                                            Total de R$ {displaySubtext} / {cycle === 'semiannual' ? 'semestre' : 'ano'}
                                        </div>
                                    )}

                                    {showSavings && (
                                        <div className={cn(
                                            "mt-3 inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide",
                                            isMostExpensive
                                                ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                                                : "bg-green-500/10 border border-green-500/20 text-green-400"
                                        )}>
                                            Economia de R$ {savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-8 mb-8 flex-1 text-sm bg-slate-950/30 -mx-4 px-4 py-6 rounded-2xl border border-white/5">
                                    {/* Iterate Modules */}
                                    {catalog.modules
                                        .filter(mod => mod.id !== 'mod_reports' && mod.id !== 'mod_api') // Hide specific modules per user request
                                        .map(mod => {
                                            // Filter features for this module
                                            const moduleFeatures = catalog.features.filter(f => f.module_id === mod.id);
                                            // If no features, maybe skip? But user listed modules with features. Let's show module header.

                                            return (
                                                <div key={mod.id}>
                                                    <h4 className={cn(
                                                        "font-bold mb-3 text-xs uppercase tracking-wider",
                                                        isMostExpensive ? "text-primary" : "text-slate-200"
                                                    )}>
                                                        {mod.name}
                                                    </h4>
                                                    <ul className="space-y-3">
                                                        {moduleFeatures.map(feat => {
                                                            const rawModules = plan.allowedModules || [];
                                                            // STRICT CHECK:
                                                            // 1. Exact Feature ID match (e.g. 'crm_contacts')
                                                            // 2. Namespaced Feature ID match (e.g. 'mod_commercial:crm_contacts')
                                                            // 3. REMOVED: rawModules.includes(mod.id) -> This was causing "All Available" issue
                                                            const isAvailable = rawModules.includes(feat.id) ||
                                                                rawModules.includes(`${mod.id}:${feat.id}`);

                                                            if (!isAvailable) {
                                                                return (
                                                                    <li key={feat.id} className="flex items-center gap-3 text-slate-600 opacity-60">
                                                                        <XCircle size={14} className="text-slate-700 shrink-0" />
                                                                        <span className="line-through decoration-slate-700 flex-1">{feat.name}</span>
                                                                    </li>
                                                                );
                                                            }

                                                            return (
                                                                <li key={feat.id} className="flex items-center gap-3 text-slate-300">
                                                                    <CheckCircle2 size={14} className={cn("shrink-0", isMostExpensive ? "text-primary" : "text-emerald-500")} />
                                                                    <span className="flex-1">{feat.name}</span>
                                                                </li>
                                                            );
                                                        })}
                                                        {moduleFeatures.length === 0 && (
                                                            <li className="text-[10px] text-slate-600 italic">Sem recursos listados</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            );
                                        })}

                                    {/* Users Limit */}
                                    <div className={cn("pt-4 border-t", isMostExpensive ? "border-primary/20" : "border-slate-800")}>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                            <Users size={14} className={isMostExpensive ? "text-primary" : "text-slate-500"} />
                                            Até {plan.maxUsers} usuários inclusos
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => handlePlanSelect(plan.type === 'custom' ? 'contact' : plan.id)}
                                    className={cn(
                                        "w-full h-12 rounded-xl font-bold transition-all",
                                        isMostExpensive
                                            ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
                                            : "bg-transparent border border-slate-700 text-white hover:bg-white hover:text-black"
                                    )}
                                >
                                    {plan.type === 'custom' ? 'Falar com Consultor' : `Começar com ${plan.name}`}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
