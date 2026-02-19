
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CreditCard, LogOut } from 'lucide-react';
import { Button } from './Shared';
import { useAuth } from '../context/AuthContext';

export const TrialExpired: React.FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    return (
        <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-rose-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-12 max-w-lg w-full text-center relative z-10 shadow-2xl">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-slate-700">
                    <Lock size={40} className="text-rose-500" />
                </div>

                <h1 className="text-3xl font-bold text-white mb-4">Período de Teste Expirado</h1>
                <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                    Esperamos que tenha gostado do Contazze! <br />
                    Para continuar gerenciando seu negócio, escolha um de nossos planos.
                </p>

                <div className="space-y-4">
                    <Button
                        onClick={() => navigate('/checkout')}
                        className="w-full py-4 text-lg font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex items-center justify-center gap-2"
                    >
                        <CreditCard size={20} />
                        Assinar Agora
                    </Button>

                    <button
                        onClick={() => signOut()}
                        className="w-full py-3 text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                        <LogOut size={16} />
                        Sair da conta
                    </button>
                </div>
            </div>

            <div className="absolute bottom-8 text-slate-600 text-sm">
                Precisa de ajuda? Entre em contato com o suporte.
            </div>
        </div>
    );
};
