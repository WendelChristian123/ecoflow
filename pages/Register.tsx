
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/Shared';
import { LayoutDashboard, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getErrorMessage } from '../services/api';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const { signUp } = useAuth();

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
      const { error } = await signUp(email, password, name);

      if (error) {
        setError(getErrorMessage(error));
      } else {
        setSuccess(true);
        // Opcional: Redirecionar após alguns segundos ou manter a tela de sucesso
        setTimeout(() => navigate('/login'), 5000);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-4">
        {/* Background Decor */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px]" />
          <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-300 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-emerald-500/30">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Conta Criada!</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Seu cadastro foi realizado com sucesso. Verifique seu e-mail para confirmar a conta antes de fazer login.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full py-3 text-base rounded-xl font-bold shadow-lg shadow-emerald-500/20">
            Ir para Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-4">

      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-4 transform hover:scale-105 transition-transform duration-300">
            <LayoutDashboard className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Contazze</h1>
          <p className="text-slate-400 text-sm">Gerencie seu negócio com inteligência</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl shadow-2xl p-8 relative overflow-hidden group">
          {/* Top Line Gradient */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

          <h2 className="text-xl font-bold text-white mb-1 text-center">Crie sua conta</h2>
          <p className="text-slate-500 text-sm text-center mb-6">Comece a gerenciar seu negócio hoje</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 flex items-start gap-3 text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              placeholder="Nome Completo"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950/60"
              leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
            />
            <Input
              type="email"
              placeholder="E-mail Corporativo"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950/60"
              leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>}
            />
            <Input
              type="password"
              placeholder="Senha (mín. 6 caracteres)"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950/60"
              leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
            />
            <Input
              type="password"
              placeholder="Confirmar Senha"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-950/60"
              leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>}
            />

            <Button type="submit" className="w-full py-3 text-base rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all mt-4" disabled={loading}>
              {loading ? 'Criando conta...' : 'Cadastrar Grátis'}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition-colors">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
