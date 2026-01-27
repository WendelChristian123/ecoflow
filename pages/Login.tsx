
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/Shared';
import { LayoutDashboard, AlertTriangle } from 'lucide-react';

import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();

  // Watch for successful auth state to redirect
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setError(null);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        // Optional: Log failed attempt via an Edge Function if needed later
        setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
        setLocalLoading(false);
      } else {
        // Success: auth.uid() is now invalid?? Wait, session is set.
        // We attempt to log.
        try {
          await api.logAuthEvent('LOGIN', 'Login realizado com sucesso via Web');
        } catch (logErr) {
          console.error(logErr);
        }
        // Redirect handled by useEffect
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado.');
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-4">

      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        <style>{`
          /* Local override for Login Page Autofill */
          /* Forces the background to be transparent and text white using transition hack */
          input:-webkit-autofill,
          input:-webkit-autofill:hover, 
          input:-webkit-autofill:focus, 
          input:-webkit-autofill:active {
              -webkit-text-fill-color: white !important;
              transition: background-color 9999s ease-in-out 0s;
              background-color: transparent !important;
          }
        `}</style>

        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-lg shadow-primary/20 transform hover:scale-105 transition-transform duration-300">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Contazze</h1>
          </div>
          <p className="text-slate-400 text-sm">Gerencie seu negócio com inteligência</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl shadow-2xl p-8 relative overflow-hidden group">
          {/* Top Line Gradient */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-white mb-1">Login</h2>
            <p className="text-slate-500 text-sm">Entre com suas credenciais para continuar</p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 flex items-start gap-3 text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="E-mail"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="!bg-slate-800/50 border-slate-700/50 focus:!bg-slate-800 transition-all text-white placeholder-slate-500"
              leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>}
            />

            <div className="space-y-1.5">
              <Input
                label="Senha"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="!bg-slate-800/50 border-slate-700/50 focus:!bg-slate-800 transition-all text-white placeholder-slate-500"
                leftIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
              />
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-11 text-sm font-semibold rounded-xl" isLoading={localLoading}>
              Entrar
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
