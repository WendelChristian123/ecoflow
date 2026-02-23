
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout';
import { Button, cn } from '../../components/Shared';
import { ArrowLeft, Lock, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { SaasPlan } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';

// Components
import { IdentificationSection } from '../../components/Checkout/IdentificationSection';
import { AddressSection } from '../../components/Checkout/AddressSection';
import { PaymentSection } from '../../components/Checkout/PaymentSection';
import { OrderSummary } from '../../components/Checkout/OrderSummary';

export const CheckoutPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // --- State Management ---
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(searchParams.get('plan'));
    const [cycle, setCycle] = useState<'monthly' | 'semiannual' | 'annual'>('monthly');
    const [loading, setLoading] = useState(false);
    const [pixData, setPixData] = useState<{ encodedImage: string, payload: string, expirationDate: string } | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    // Fetch Plans & Sync with URL
    React.useEffect(() => {
        // Scroll to top on mount
        window.scrollTo(0, 0);

        const fetchPlans = async () => {
            try {
                const data = await api.getPublicPlans();
                setPlans(data);
            } catch (error) {
                console.error("Failed to fetch plans", error);
            } finally {
                setLoadingPlans(false);
            }
        };
        fetchPlans();
    }, []);

    React.useEffect(() => {
        const planFromUrl = searchParams.get('plan');
        if (planFromUrl) {
            setSelectedPlanId(planFromUrl);
        }

        const cycleFromUrl = searchParams.get('cycle');
        if (cycleFromUrl === 'monthly' || cycleFromUrl === 'semiannual' || cycleFromUrl === 'annual') {
            setCycle(cycleFromUrl);
        }
    }, [searchParams]);

    // Derived selected plan
    const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

    const { user } = useAuth();
    const { currentCompany } = useCompany();

    useEffect(() => {
        if (currentCompany) {
            setFormData(prev => ({
                ...prev,
                name: currentCompany.name || prev.name,
                document: currentCompany.cnpj || prev.document,
                email: currentCompany.ownerEmail || prev.email,
                phone: currentCompany.phone || prev.phone,
            }));
        } else if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.user_metadata?.full_name || user.user_metadata?.legal_name || prev.name,
                email: user.email || prev.email,
                phone: user.user_metadata?.whatsapp || prev.phone,
            }));
        }
    }, [currentCompany, user]);

    // Form Data
    const [formData, setFormData] = useState({
        // Identification
        name: '',
        document: '',
        phone: '',
        email: '',
        // Address
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        // Payment
        cardNumber: '',
        cardName: '',
        cardExpiry: '',
        cardCvv: '',
    });

    const [paymentMethod, setPaymentMethod] = useState<'credit' | 'pix'>('credit');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // --- Handlers ---
    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user types
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name) newErrors.name = 'Nome obrigatório';
        if (!formData.document) newErrors.document = 'CPF/CNPJ obrigatório';
        if (!formData.email) newErrors.email = 'E-mail obrigatório';
        if (!formData.phone) newErrors.phone = 'WhatsApp obrigatório';

        if (!formData.cep) newErrors.cep = 'CEP obrigatório';
        if (!formData.street) newErrors.street = 'Rua obrigatória';
        if (!formData.number) newErrors.number = 'Número obrigatório';
        if (!formData.neighborhood) newErrors.neighborhood = 'Bairro obrigatório';
        if (!formData.city) newErrors.city = 'Cidade obrigatória';
        if (!formData.state) newErrors.state = 'Estado obrigatório';

        if (paymentMethod === 'credit') {
            if (!formData.cardNumber) newErrors.cardNumber = 'Número obrigatório';
            if (!formData.cardName) newErrors.cardName = 'Nome obrigatório';
            if (!formData.cardExpiry) newErrors.cardExpiry = 'Validade obrigatória';
            if (!formData.cardCvv) newErrors.cardCvv = 'CVV obrigatório';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubscribe = async () => {
        setCheckoutError(null);
        if (!validateForm()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setLoading(true);

        try {
            // Prepare Payload
            const payload = {
                company: {
                    name: formData.name,
                    cnpj: formData.document,
                    phone: formData.phone,
                    email: formData.email
                },
                address: {
                    postal_code: formData.cep,
                    address: formData.street,
                    address_number: formData.number,
                    complement: formData.complement,
                    province: formData.neighborhood,
                    city: formData.city,
                    state: formData.state
                },
                plan_id: selectedPlan.id,
                cycle: cycle,
                billing_type: paymentMethod === 'credit' ? 'credit_card' : 'pix' as 'credit_card' | 'pix',
                credit_card: paymentMethod === 'credit' ? {
                    holderName: formData.cardName,
                    number: formData.cardNumber,
                    expiryMonth: formData.cardExpiry.split('/')[0],
                    expiryYear: formData.cardExpiry.split('/')[1],
                    ccv: formData.cardCvv
                } : undefined
            };

            const response = await api.subscribe(payload);

            if (response.pix) {
                setPixData(response.pix);
            } else {
                // Credit Card Success
                navigate('/dashboard');
            }

        } catch (error: any) {
            console.error("Subscription Error:", error);
            setCheckoutError(error.message || "Ocorreu um erro ao processar sua assinatura. Verifique os dados fornecidos.");
        } finally {
            setLoading(false);
        }
    };

    if (pixData) {
        return (
            <PublicLayout className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-lg p-8 text-center space-y-6">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Pague com PIX</h2>
                    <p className="text-muted-foreground text-sm">
                        Sua assinatura no plano <strong>{selectedPlan?.name}</strong> foi reservada. 
                        Escaneie o QR Code abaixo ou utilize o recurso Copia e Cola.
                    </p>
                    
                    <div className="bg-white p-4 rounded-xl inline-block border-2 border-dashed border-border mx-auto">
                        <img 
                            src={pixData.encodedImage.startsWith('data:') ? pixData.encodedImage : `data:image/png;base64,${pixData.encodedImage}`} 
                            alt="QR Code PIX" 
                            className="w-48 h-48"
                        />
                    </div>

                    <div className="space-y-2 text-left">
                        <p className="text-sm font-medium">Código PIX Copia e Cola:</p>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={pixData.payload} 
                                className="w-full text-xs p-2 bg-muted rounded border border-border outline-none focus:ring-1 focus:ring-primary"
                            />
                            <Button 
                                onClick={() => {
                                    navigator.clipboard.writeText(pixData.payload);
                                    alert('Código copiado!');
                                }}
                                variant="outline"
                                className="shrink-0 flex items-center gap-2"
                            >
                                <Copy size={14} /> Copiar
                            </Button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                        <Button className="w-full" onClick={() => navigate('/dashboard')}>
                            Já realizei o pagamento
                        </Button>
                        <p className="text-xs text-muted-foreground mt-4">
                            Seu painel será liberado automaticamente assim que o pagamento for compensado pelo banco.
                        </p>
                    </div>
                </div>
            </PublicLayout>
        );
    }

    return (
        <PublicLayout className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8 max-w-6xl">

                {/* Header Navigation */}
                <div className="flex items-center justify-between mb-8">
                    <Button
                        onClick={() => navigate('/')}
                        variant="ghost"
                        className="pl-0 gap-2 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft size={18} /> Voltar
                    </Button>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1 rounded-full border border-border">
                        <Lock size={12} /> Ambiente Seguro
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8 items-start">
                    {checkoutError && (
                        <div className="lg:col-span-3 bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold">Erro no pagamento</p>
                                <p>{checkoutError}</p>
                            </div>
                        </div>
                    )}

                    {/* LEFT COLUMN: FORM */}
                    <div className="lg:col-span-2 space-y-8 pb-12">

                        <IdentificationSection
                            data={formData}
                            onChange={handleInputChange}
                            errors={errors}
                        />

                        <div className="w-full h-px bg-border/50" />

                        <AddressSection
                            data={formData}
                            onChange={handleInputChange}
                            errors={errors}
                        />

                        <div className="w-full h-px bg-border/50" />

                        <PaymentSection
                            method={paymentMethod}
                            onMethodChange={setPaymentMethod}
                            data={formData}
                            onChange={handleInputChange}
                            errors={errors}
                        />

                    </div>

                    {/* RIGHT COLUMN: SUMMARY */}
                    <div className="lg:col-span-1 sticky top-8 h-fit">
                        {!loadingPlans && selectedPlan ? (
                            <OrderSummary
                                plan={selectedPlan}
                                cycle={cycle}
                                onCycleChange={setCycle}
                                loading={loading}
                                onSubscribe={handleSubscribe}
                            />
                        ) : (
                            <div className="h-96 flex items-center justify-center bg-card border border-border rounded-xl shadow-sm">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </PublicLayout>
    );
};
