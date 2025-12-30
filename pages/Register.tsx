
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
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Conta Criada!</h2>
                <p className="text-slate-400 text-sm mb-6">
                    Seu cadastro foi realizado com sucesso. Verifique seu e-mail para confirmar a conta antes de fazer login.
                </p>
                <Button onClick={() => navigate('/login')} className="w-full">
                    Ir para Login
                </Button>
            </div>
        </div>
      );
  }

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
          <h2 className="text-xl font-bold text-white mb-2 text-center">Crie sua conta</h2>
          <p className="text-slate-400 text-sm text-center mb-6">Comece a gerenciar seu negócio hoje</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg mb-4 flex items-center gap-2 text-rose-400 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <Input 
              placeholder="Nome Completo" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border-slate-800" 
            />
            <Input 
              type="email" 
              placeholder="E-mail Corporativo" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950 border-slate-800" 
            />
            <Input 
              type="password" 
              placeholder="Senha (mín. 6 caracteres)" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-800" 
            />
            <Input 
              type="password" 
              placeholder="Confirmar Senha" 
              required 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-950 border-slate-800" 
            />

            <Button type="submit" className="w-full mt-2 font-semibold bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? 'Criando conta...' : 'Cadastrar Grátis'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
