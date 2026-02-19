import React from 'react';
import { Input, cn } from '../Shared';
import { CreditCard, Wallet, CalendarRange, Lock } from 'lucide-react';

interface PaymentSectionProps {
    method: 'credit' | 'pix';
    onMethodChange: (method: 'credit' | 'pix') => void;
    data: {
        cardNumber: string;
        cardName: string;
        cardExpiry: string;
        cardCvv: string;
    };
    onChange: (field: string, value: string) => void;
    errors?: Record<string, string>;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({ method, onMethodChange, data, onChange, errors }) => {

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        value = value.replace(/(\d{4})/g, '$1 ').trim();
        onChange('cardNumber', value);
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 4) value = value.slice(0, 4);
        if (value.length > 2) {
            value = value.replace(/^(\d{2})/, '$1/');
        }
        onChange('cardExpiry', value);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mt-4">
                <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm border border-primary/20">3</span>
                Forma de Pagamento
            </h3>

            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => onMethodChange('pix')}
                    className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2",
                        method === 'pix'
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50"
                    )}
                >
                    <div className="w-10 h-10 rounded-full bg-slate-900/5 dark:bg-slate-100/10 flex items-center justify-center">
                        <Wallet size={20} className="mb-0.5" />
                    </div>
                    <span className="font-medium text-sm">PIX</span>
                </button>

                <button
                    onClick={() => onMethodChange('credit')}
                    className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2",
                        method === 'credit'
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50"
                    )}
                >
                    <div className="w-10 h-10 rounded-full bg-slate-900/5 dark:bg-slate-100/10 flex items-center justify-center">
                        <CreditCard size={20} className="mb-0.5" />
                    </div>
                    <span className="font-medium text-sm">Cartão de Crédito</span>
                </button>
            </div>

            <div className="mt-6">
                {method === 'pix' && (
                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-6 rounded-xl flex flex-col items-center text-center animate-in fade-in zoom-in-95">
                        <div className="bg-blue-500/20 p-3 rounded-full mb-3">
                            <Wallet size={32} />
                        </div>
                        <h4 className="font-bold mb-2">Pagamento Instantâneo</h4>
                        <p className="text-sm opacity-90 mb-4">
                            Ao finalizar o pedido, geraremos um QR Code exclusivo para você realizar o pagamento. O acesso é liberado imediatamente após a confirmação.
                        </p>
                        <div className="text-xs bg-background/50 px-3 py-1 rounded-full border border-blue-500/10">
                            Expira em 30 minutos
                        </div>
                    </div>
                )}

                {method === 'credit' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1">
                            <Input
                                placeholder="0000 0000 0000 0000"
                                label="Número do Cartão"
                                value={data.cardNumber}
                                onChange={handleCardNumberChange}
                                leftIcon={<CreditCard size={18} />}
                                className={errors?.cardNumber ? 'border-destructive focus:border-destructive' : ''}
                            />
                            {errors?.cardNumber && <span className="text-xs text-destructive ml-1">{errors.cardNumber}</span>}
                        </div>

                        <div className="space-y-1">
                            <Input
                                placeholder="Como está no cartão"
                                label="Nome Impresso"
                                value={data.cardName}
                                onChange={(e) => onChange('cardName', e.target.value.toUpperCase())}
                                className={errors?.cardName ? 'border-destructive focus:border-destructive' : ''}
                            />
                            {errors?.cardName && <span className="text-xs text-destructive ml-1">{errors.cardName}</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Input
                                    placeholder="MM/AA"
                                    label="Validade"
                                    value={data.cardExpiry}
                                    onChange={handleExpiryChange}
                                    leftIcon={<CalendarRange size={18} />}
                                    className={errors?.cardExpiry ? 'border-destructive focus:border-destructive' : ''}
                                />
                                {errors?.cardExpiry && <span className="text-xs text-destructive ml-1">{errors.cardExpiry}</span>}
                            </div>
                            <div className="space-y-1">
                                <Input
                                    placeholder="123"
                                    label="CVV"
                                    type="password"
                                    maxLength={4}
                                    value={data.cardCvv}
                                    onChange={(e) => onChange('cardCvv', e.target.value.replace(/\D/g, ''))}
                                    leftIcon={<Lock size={18} />}
                                    className={errors?.cardCvv ? 'border-destructive focus:border-destructive' : ''}
                                />
                                {errors?.cardCvv && <span className="text-xs text-destructive ml-1">{errors.cardCvv}</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
