import React from 'react';
import { useCompany } from '../context/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle } from 'lucide-react';
import { startOfDay, isBefore } from 'date-fns';
import { Button } from './Shared';

export const TrialBanner: React.FC = () => {
    const { currentCompany } = useCompany();
    const navigate = useNavigate();

    // Only show for 'trial' type
    if (currentCompany?.type !== 'trial') return null;

    const subEnd = currentCompany.subscriptionEnd ? new Date(currentCompany.subscriptionEnd) : null;
    let daysLeft = 0;
    let isExpired = false;

    if (subEnd) {
        const today = startOfDay(new Date());
        const end = startOfDay(subEnd);
        daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        isExpired = isBefore(end, today);
    }

    if (isExpired) {
        return (
            <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 w-full z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-red-500/20 p-2 rounded-full shrink-0">
                        <AlertTriangle size={20} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-red-500 font-bold text-sm">Seu período de teste expirou!</h3>
                        <p className="text-red-500/80 text-xs">Assine o plano <strong>{currentCompany.planName || 'Pro'}</strong> para continuar usando o sistema.</p>
                    </div>
                </div>
                <Button onClick={() => navigate(`/checkout?plan=${currentCompany.planId || 'pro'}&cycle=${currentCompany.billingCycle || 'monthly'}`)} className="bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm h-8 px-4 text-xs whitespace-nowrap shrink-0">
                    Assinar Agora
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 w-full relative overflow-hidden z-[70]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
                <div className="bg-emerald-500/20 p-2 rounded-full shrink-0">
                    <Clock size={20} className="text-emerald-500" />
                </div>
                <div>
                    <h3 className="text-emerald-700 dark:text-emerald-400 font-bold text-sm leading-tight flex items-center gap-1">
                        Você está no período de teste do plano <strong className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 ml-1">{currentCompany.planName || 'Pro'}</strong>
                    </h3>
                    <p className="text-emerald-700/80 dark:text-emerald-400/80 text-xs mt-0.5">
                        Restam <strong className="text-emerald-800 dark:text-emerald-300 font-extrabold">{daysLeft} dias</strong> para você aproveitar todas as funcionalidades.
                    </p>
                </div>
            </div>
            <Button onClick={() => navigate(`/checkout?plan=${currentCompany.planId || 'pro'}&cycle=${currentCompany.billingCycle || 'monthly'}`)} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm h-8 px-6 text-xs whitespace-nowrap font-bold tracking-wide uppercase relative z-10 shrink-0">
                Assinar Agora
            </Button>
        </div>
    );
};
