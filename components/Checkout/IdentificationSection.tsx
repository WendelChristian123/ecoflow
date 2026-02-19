import React from 'react';
import { Input } from '../Shared';
import { User, Building2, Phone, Mail } from 'lucide-react';

interface IdentificationSectionProps {
    data: {
        name: string;
        document: string;
        phone: string;
        email: string;
    };
    onChange: (field: string, value: string) => void;
    errors?: Record<string, string>;
}

export const IdentificationSection: React.FC<IdentificationSectionProps> = ({ data, onChange, errors }) => {

    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 14) value = value.slice(0, 14);

        // Simple masking logic
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            value = value.replace(/^(\d{2})(\d)/, '$1.$2');
            value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
            value = value.replace(/(\d{4})(\d)/, '$1-$2');
        }

        onChange('document', value);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        }
        if (value.length > 7) {
            value = value.replace(/(\d)(\d{4})$/, '$1-$2');
        }
        onChange('phone', value);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm border border-primary/20">1</span>
                Identificação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Input
                        label="Nome Completo / Razão Social"
                        placeholder="Seu nome ou da empresa"
                        value={data.name}
                        onChange={(e) => onChange('name', e.target.value)}
                        leftIcon={<User size={18} />}
                        className={errors?.name ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.name && <span className="text-xs text-destructive ml-1">{errors.name}</span>}
                </div>

                <div className="space-y-1">
                    <Input
                        label="CPF / CNPJ"
                        placeholder="000.000.000-00"
                        value={data.document}
                        onChange={handleDocumentChange}
                        leftIcon={<Building2 size={18} />}
                        className={errors?.document ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.document && <span className="text-xs text-destructive ml-1">{errors.document}</span>}
                </div>

                <div className="space-y-1">
                    <Input
                        label="WhatsApp"
                        placeholder="(00) 00000-0000"
                        value={data.phone}
                        onChange={handlePhoneChange}
                        leftIcon={<Phone size={18} />}
                        className={errors?.phone ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.phone && <span className="text-xs text-destructive ml-1">{errors.phone}</span>}
                </div>

                <div className="space-y-1">
                    <Input
                        label="E-mail (Seu Login)"
                        type="email"
                        placeholder="seu@email.com"
                        value={data.email}
                        onChange={(e) => onChange('email', e.target.value)}
                        leftIcon={<Mail size={18} />}
                        className={errors?.email ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.email && <span className="text-xs text-destructive ml-1">{errors.email}</span>}
                </div>
            </div>
        </div>
    );
};
