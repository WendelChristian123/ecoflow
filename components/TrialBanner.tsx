
import React from 'react';
import { useCompany } from '../context/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle } from 'lucide-react';

export const TrialBanner: React.FC = () => {
    const { currentCompany } = useCompany();
    const navigate = useNavigate();

    // Only show for 'trial' type
    if (!currentCompany || currentCompany.type !== 'trial') return null;

    const trialEnds = currentCompany.subscriptionEnd ? new Date(currentCompany.subscriptionEnd) : null;
    if (!trialEnds) return null;

    const now = new Date();
    const diffMs = trialEnds.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const isExpired = diffMs <= 0;

    if (isExpired) {
        return (
            <div className="bg-rose-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-50 relative">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} />
                    <span>Seu período de teste expirou. Escolha um plano para continuar usando o Contazze.</span>
                </div>
                <button
                    onClick={() => navigate('/checkout')}
                    className="bg-white text-rose-600 px-3 py-1 rounded-lg hover:bg-rose-50 transition-colors font-bold text-xs uppercase"
                >
                    Escolher Plano
                </button>
            </div>
        );
    }

    return (
        <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-50 relative">
            <div className="flex items-center gap-2">
                <Clock size={18} />
                <span>
                    Você está no período gratuito. Restam <strong>{diffDays} dias</strong>.
                </span>
            </div>
            <button
                onClick={() => navigate('/checkout')}
                className="bg-white text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors font-bold text-xs uppercase"
            >
                Assinar Agora
            </button>
        </div>
    );
};
