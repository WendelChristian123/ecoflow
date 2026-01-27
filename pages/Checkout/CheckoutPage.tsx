import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout';
import { Button, Input, Card, cn } from '../../components/Shared';
import { CheckCircle2, Minus, Plus, Lock, CreditCard, Wallet, Barcode, ArrowLeft } from 'lucide-react';

export const CheckoutPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Default from URL or defaults
    const initialPlan = (searchParams.get('plan') as 'start' | 'pro') || 'pro';
    const initialCycle = (searchParams.get('cycle') as 'monthly' | 'semiannual' | 'annual') || 'monthly';

    const [plan, setPlan] = useState<'start' | 'pro'>(initialPlan);
    const [cycle, setCycle] = useState<'monthly' | 'semiannual' | 'annual'>(initialCycle);
    const [extraUsers, setExtraUsers] = useState(0);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [password, setPassword] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'credit' | 'pix' | 'boleto'>('credit');

    // Prices Configuration
    const PRICES = {
        start: { monthly: 47.00, semiannual: 42.90, annual: 39.90 },
        pro: { monthly: 97.00, semiannual: 87.90, annual: 79.90 },
        extraUser: 24.90
    };

    // Calculations
    const basePrice = PRICES[plan][cycle];
    const months = cycle === 'monthly' ? 1 : cycle === 'semiannual' ? 6 : 12;
    const planTotal = basePrice * months;

    const extraUserPriceMonthly = PRICES.extraUser; // Always monthly base pricing? Or discounted? Usually simplified to flat add-on. 
    // Assumption: Add-on price is per user PER MONTH.
    const extraUsersTotal = extraUserPriceMonthly * extraUsers * months;

    const grandTotal = planTotal + extraUsersTotal;
    const grandTotalMonthly = grandTotal / months;

    const includedUsers = plan === 'start' ? 1 : 5;

    const handleBack = () => {
        navigate('/');
    };

    return (
        <PublicLayout className="pt-10 pb-20">
            <div className="container mx-auto px-4 max-w-6xl">
                <Button onClick={handleBack} variant="ghost" className="mb-6 text-slate-400 hover:text-white pl-0 gap-2">
                    <ArrowLeft size={18} /> Voltar para Planos
                </Button>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: SETUP & DATA */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 1. PLAN SELECTION */}
                        <Card className="bg-slate-900 border-border p-6 shadow-premium">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                Configuração do Plano
                            </h2>

                            <div className="grid md:grid-cols-2 gap-4 mb-6">
                                {/* Plan Switch */}
                                <div className="bg-slate-950 p-1 rounded-xl border border-border flex">
                                    <button
                                        onClick={() => setPlan('start')}
                                        className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", plan === 'start' ? "bg-slate-800 text-white shadow" : "text-slate-500 hover:text-slate-300")}
                                    >
                                        Start
                                    </button>
                                    <button
                                        onClick={() => setPlan('pro')}
                                        className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", plan === 'pro' ? "bg-primary text-white shadow" : "text-slate-500 hover:text-slate-300")}
                                    >
                                        Pro
                                    </button>
                                </div>

                                {/* Cycle Switch */}
                                <select
                                    className="bg-slate-950 border border-border rounded-xl text-white px-4 text-sm focus:ring-primary focus:border-primary outline-none"
                                    value={cycle}
                                    onChange={(e) => setCycle(e.target.value as any)}
                                >
                                    <option value="monthly">Mensal</option>
                                    <option value="semiannual">Semestral (Desconto)</option>
                                    <option value="annual">Anual (Melhor Preço)</option>
                                </select>
                            </div>

                            <div className="bg-slate-950/50 rounded-xl p-4 border border-border flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium text-sm">Usuários Adicionais</p>
                                    <p className="text-slate-500 text-xs">R$ 24,90 / usuário</p>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-900 rounded-lg p-1 border border-border">
                                    <button onClick={() => setExtraUsers(Math.max(0, extraUsers - 1))} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Minus size={16} /></button>
                                    <span className="text-white font-mono w-6 text-center text-sm">{extraUsers}</span>
                                    <button onClick={() => setExtraUsers(extraUsers + 1)} className="p-1 hover:bg-primary hover:text-white rounded text-primary transition-colors"><Plus size={16} /></button>
                                </div>
                            </div>
                        </Card>

                        {/* 2. ACCOUNT DATA */}
                        <Card className="bg-slate-900 border-border p-6 shadow-premium">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                Seus Dados
                            </h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="bg-slate-950 border-border text-white" />
                                <Input label="Whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="bg-slate-950 border-border text-white" placeholder="(00) 00000-0000" />
                                <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-950 border-border text-white" />
                                <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-slate-950 border-border text-white" placeholder="Mínimo 6 caracteres" />
                            </div>
                        </Card>

                        {/* 3. PAYMENT (MOCK) */}
                        <Card className="bg-slate-900 border-border p-6 shadow-premium">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                Pagamento
                            </h2>

                            <div className="flex gap-3 mb-6">
                                {[
                                    { id: 'credit', icon: CreditCard, label: 'Cartão' },
                                    { id: 'pix', icon: Wallet, label: 'Pix' },
                                    { id: 'boleto', icon: Barcode, label: 'Boleto' }
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setPaymentMethod(m.id as any)}
                                        className={cn(
                                            "flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 text-sm font-medium transition-all",
                                            paymentMethod === m.id
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "bg-slate-950 border-border text-slate-400 hover:border-slate-600"
                                        )}
                                    >
                                        <m.icon size={20} />
                                        {m.label}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === 'credit' && (
                                <div className="space-y-4 animate-in fade-in">
                                    <Input placeholder="Número do Cartão" className="bg-slate-950 border-border text-white" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input placeholder="Validade (MM/AA)" className="bg-slate-950 border-border text-white" />
                                        <Input placeholder="CVV" className="bg-slate-950 border-border text-white" />
                                    </div>
                                    <Input placeholder="Nome no Cartão" className="bg-slate-950 border-border text-white" />
                                </div>
                            )}
                            {paymentMethod === 'pix' && (
                                <div className="text-center p-8 bg-slate-950 rounded-xl border border-border text-slate-400 text-sm">
                                    O código Pix será gerado após finalizar a assinatura.
                                </div>
                            )}
                            {paymentMethod === 'boleto' && (
                                <div className="text-center p-8 bg-slate-950 rounded-xl border border-border text-slate-400 text-sm">
                                    O boleto será enviado para seu e-mail.
                                </div>
                            )}

                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                                <Lock size={12} /> Pagamentos processados com segurança pelo <span className="font-bold text-slate-400">ASAAS</span>
                            </div>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: SUMMARY */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24">
                            <Card className="bg-slate-900 border-primary/30 shadow-2xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-400"></div>

                                <h3 className="text-xl font-bold text-white mb-6">Resumo do Pedido</h3>

                                <div className="space-y-4 mb-6 border-b border-border pb-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-white font-medium">Plano {plan === 'start' ? 'Start' : 'Pro'}</p>
                                            <p className="text-xs text-slate-500 capitalize">{cycle === 'monthly' ? 'Mensal' : cycle === 'semiannual' ? 'Semestral' : 'Anual'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-bold">R$ {basePrice.toFixed(2).replace('.', ',')}</p>
                                            <p className="text-[10px] text-slate-500">/mês</p>
                                        </div>
                                    </div>

                                    {extraUsers > 0 && (
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-white font-medium">{extraUsers} Usuários Extras</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-bold">R$ {(extraUserPriceMonthly * extraUsers).toFixed(2).replace('.', ',')}</p>
                                                <p className="text-[10px] text-slate-500">/mês</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-2">
                                        <p className="text-sm text-slate-400">Usuários Inclusos</p>
                                        <p className="text-white font-medium">{includedUsers + extraUsers}</p>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <div className="flex justify-between items-end mb-1">
                                        <p className="text-slate-300 font-medium">Total Mensal</p>
                                        <p className="text-3xl font-bold text-primary">R$ {grandTotalMonthly.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                    {cycle !== 'monthly' && (
                                        <p className="text-right text-xs text-slate-500">
                                            Total cobrado: R$ {grandTotal.toFixed(2).replace('.', ',')} ({cycle === 'semiannual' ? '6' : '12'} meses)
                                        </p>
                                    )}
                                </div>

                                <Button className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold shadow-lg shadow-primary/25 mb-4">
                                    Finalizar Assinatura
                                </Button>

                                <p className="text-center text-[10px] text-slate-500">
                                    Ao assinar, você concorda com os Termos de Uso e Política de Privacidade.
                                </p>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
};
