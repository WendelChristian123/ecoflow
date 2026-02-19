
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Keeping for potential future use or context updates
import { Button, Input } from '../components/Shared';
import { LayoutDashboard, AlertTriangle, CheckCircle2, Building2, Phone } from 'lucide-react';
import { getErrorMessage, api } from '../services/api';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  // const { signUp } = useAuth(); // We are using custom API for this flow

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      // Call Edge Function via API wrapper
      await api.registerCompany({
        email,
        password,
        legal_name: legalName || name, // Fallback if legalName not filled (though we should ask for it)
        cpf_cnpj: cpfCnpj,
        whatsapp
      });

      setSuccess(true);
      // Auto-redirect to login after success
      setTimeout(() => navigate('/login'), 5000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-300 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-primary/30">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Conta Criada!</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Seu período gratuito de 7 dias foi ativado com sucesso. <br />
            Faça login para começar.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full py-3 text-base rounded-xl font-bold shadow-lg shadow-primary/20">
            Ir para Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 my-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-2xl shadow-primary/20 mb-4 transform hover:scale-105 transition-transform duration-300">
            <LayoutDashboard className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Contazze</h1>
          <p className="text-slate-400 text-sm">Teste grátis por 7 dias. Sem compromisso.</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl shadow-2xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

          <h2 className="text-xl font-bold text-white mb-1 text-center">Crie sua conta</h2>
          <p className="text-slate-500 text-sm text-center mb-6">Preencha seus dados para começar</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 flex items-start gap-3 text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Dados da Empresa / Pessoais */}
              <Input
                placeholder="Razão Social ou Nome Completo"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="bg-slate-950/60"
                leftIcon={<Building2 size={18} />}
              />
              <Input
                placeholder="CPF ou CNPJ (somente números)"
                required
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value.replace(/\D/g, ''))}
                maxLength={14}
                className="bg-slate-950/60"
                leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>}
              />
              <Input
                placeholder="WhatsApp / Telefone"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="bg-slate-950/60"
                leftIcon={<Phone size={18} />}
              />
            </div>

            <div className="border-t border-slate-800/50 my-4 pt-4">
              <Input
                type="email"
                placeholder="E-mail de Login"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950/60"
                leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="password"
                placeholder="Senha"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950/60"
                leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
              />
              <Input
                type="password"
                placeholder="Confirmar"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-slate-950/60"
              />
            </div>

            <Button type="submit" className="w-full py-3 text-base rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all mt-6" disabled={loading}>
              {loading ? 'Criando conta...' : 'Começar Avaliação Gratuita'}
            </Button>
            <p className="text-xs text-slate-500 text-center mt-2">
              Ao se cadastrar, você concorda com nossos termos de uso.
            </p>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-slate-800/50">
            <p className="text-slate-500 text-sm">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:text-primary/80 font-semibold hover:underline transition-colors">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
