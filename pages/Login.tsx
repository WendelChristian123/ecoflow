
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/Shared';
import { LayoutDashboard, AlertTriangle } from 'lucide-react';

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
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setError(null);

    try {
        const { error } = await signIn(email, password);
        if (error) {
            setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
            setLocalLoading(false);
        }
        // If success, the useEffect above will handle the redirect
    } catch (err) {
        setError('Ocorreu um erro inesperado.');
        setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">EcoFlow</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-white mb-2 text-center">Bem-vindo de volta</h2>
          <p className="text-slate-400 text-sm text-center mb-6">Acesse sua conta para continuar</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg mb-4 flex items-center gap-2 text-rose-400 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">E-mail</label>
              <Input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:border-emerald-500"
                placeholder="seu@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Senha</label>
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:border-emerald-500"
                placeholder="Sua senha"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full mt-2 font-semibold shadow-lg shadow-emerald-900/20" 
              disabled={localLoading || authLoading}
            >
              {localLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline">
              Cadastre-se
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
