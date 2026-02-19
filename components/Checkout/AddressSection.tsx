import React from 'react';
import { Input } from '../Shared';
import { MapPin } from 'lucide-react';

interface AddressSectionProps {
    data: {
        cep: string;
        street: string;
        number: string;
        complement: string;
        neighborhood: string;
        city: string;
        state: string;
    };
    onChange: (field: string, value: string) => void;
    errors?: Record<string, string>;
}

export const AddressSection: React.FC<AddressSectionProps> = ({ data, onChange, errors }) => {

    const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        if (value.length > 5) {
            value = value.replace(/^(\d{5})(\d)/, '$1-$2');
        }
        onChange('cep', value);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mt-4">
                <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm border border-primary/20">2</span>
                Endereço de Faturamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-1">
                    <Input
                        label="CEP"
                        placeholder="00000-000"
                        value={data.cep}
                        onChange={handleCepChange}
                        className={errors?.cep ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.cep && <span className="text-xs text-destructive ml-1">{errors.cep}</span>}
                </div>

                <div className="md:col-span-3 space-y-1">
                    <Input
                        label="Rua / Avenida"
                        placeholder="Nome da rua"
                        value={data.street}
                        onChange={(e) => onChange('street', e.target.value)}
                        leftIcon={<MapPin size={18} />}
                        className={errors?.street ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.street && <span className="text-xs text-destructive ml-1">{errors.street}</span>}
                </div>

                <div className="md:col-span-1 space-y-1">
                    <Input
                        label="Número"
                        placeholder="123"
                        value={data.number}
                        onChange={(e) => onChange('number', e.target.value)}
                        className={errors?.number ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.number && <span className="text-xs text-destructive ml-1">{errors.number}</span>}
                </div>

                <div className="md:col-span-1 space-y-1">
                    <Input
                        label="Complemento"
                        placeholder="Apto 101"
                        value={data.complement}
                        onChange={(e) => onChange('complement', e.target.value)}
                    />
                </div>

                <div className="md:col-span-2 space-y-1">
                    <Input
                        label="Bairro"
                        placeholder="Centro"
                        value={data.neighborhood}
                        onChange={(e) => onChange('neighborhood', e.target.value)}
                        className={errors?.neighborhood ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.neighborhood && <span className="text-xs text-destructive ml-1">{errors.neighborhood}</span>}
                </div>

                <div className="md:col-span-3 space-y-1">
                    <Input
                        label="Cidade"
                        placeholder="São Paulo"
                        value={data.city}
                        onChange={(e) => onChange('city', e.target.value)}
                        className={errors?.city ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.city && <span className="text-xs text-destructive ml-1">{errors.city}</span>}
                </div>

                <div className="md:col-span-1 space-y-1">
                    <Input
                        label="Estado"
                        placeholder="SP"
                        maxLength={2}
                        value={data.state}
                        onChange={(e) => onChange('state', e.target.value.toUpperCase())}
                        className={errors?.state ? 'border-destructive focus:border-destructive' : ''}
                    />
                    {errors?.state && <span className="text-xs text-destructive ml-1">{errors.state}</span>}
                </div>
            </div>
        </div>
    );
};
