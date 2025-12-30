
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ArrowLeft, LayoutDashboard, Construction } from 'lucide-react';
import { Button } from '../components/Shared';

interface FinancialPageProps {
  title: string;
}

export const FinancialPage: React.FC<FinancialPageProps> = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center px-4">
      <div className="p-4 bg-slate-800 rounded-full border border-slate-700 shadow-xl shadow-black/20">
        <DollarSign size={48} className="text-emerald-500" />
      </div>
      
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-slate-400">
          Este módulo está ativo e seus dados já estão sendo processados no <span className="text-emerald-400 font-medium">Dashboard Principal</span>.
          As telas de listagem detalhada estarão disponíveis na próxima atualização.
        </p>
      </div>

      <div className="flex gap-4">
        <Button variant="secondary" onClick={() => navigate(-1)} className="gap-2">
           <ArrowLeft size={18} /> Voltar
        </Button>
        <Button onClick={() => navigate('/')} className="gap-2">
           <LayoutDashboard size={18} /> Ir para o Dashboard
        </Button>
      </div>

      <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-slate-500 flex items-center gap-2">
         <Construction size={14} />
         <span>Visualização detalhada em construção.</span>
      </div>
    </div>
  );
};
