import React, { useState } from 'react';
import { Modal, Input, Button, Loader } from './Shared';
import { api } from '../services/api';
// Points to services/supabase.ts based on file listing
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { SaasPlan } from '../types';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface SignupModalProps {
    isOpen: boolean;
    onClose: () => void;
    planId: string | null;
    plans: SaasPlan[];
}

export const SignupModal: React.FC<SignupModalProps> = ({ isOpen, onClose, planId, plans }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        legal_name: '',
        email: '',
        whatsapp: '',
        password: '',
        confirmPassword: '',
        cpf_cnpj: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError("As senhas não coincidem");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Register Company (calls auth-signup)
            const newCompany = await api.registerCompany({
                ...formData,
                plan_id: planId
            });

            // 2. Sign In
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });

            if (signInError) throw signInError;

            // 3. Force Session & Tenant Sync
            if (newCompany?.id) {
                localStorage.setItem('ecoflow-company-id', newCompany.id);
            }

            // 4. Reload to clear any stale auth state
            window.location.href = '/dashboard';
            window.location.reload();

        } catch (error: any) {
            console.error(error);
            setError(error.message || "Erro ao criar conta. Verifique os dados e tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const planName = plans.find(p => p.id === planId)?.name || 'Plano Selecionado';

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Comece seu teste grátis no ${planName}`} className="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-sm text-slate-400 mb-4">
                    Preencha os dados abaixo para iniciar seus 7 dias gratuitos. Sem compromisso.
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-start gap-2 text-rose-400 text-xs animate-in fade-in slide-in-from-top-1">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <div className="font-medium">{error}</div>
                    </div>
                )}

                <Input
                    label="Nome da Empresa / Responsável"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleChange}
                    placeholder="Ex: Minha Empresa Ltda"
                    required
                />

                <Input
                    label="CPF ou CNPJ"
                    name="cpf_cnpj"
                    value={formData.cpf_cnpj}
                    onChange={handleChange}
                    placeholder="00.000.000/0000-00"
                    required
                />

                <Input
                    label="E-mail (Login)"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    required
                />

                <Input
                    label="WhatsApp"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                    required
                />

                <Input
                    label="Senha"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mínimo 6 caracteres"
                    required
                    rightIcon={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-white focus:outline-none">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    }
                />

                <Input
                    label="Confirmar Senha"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirme sua senha"
                    required
                />

                <Button type="submit" disabled={loading} className="w-full mt-6" size="lg">
                    {loading ? <Loader /> : 'Começar Agora'}
                </Button>
                <p className="text-xs text-center text-slate-500 mt-4">
                    Ao clicar em "Começar Agora", você concorda com nossos Termos de Uso.
                </p>
            </form>
        </Modal>
    );
};
