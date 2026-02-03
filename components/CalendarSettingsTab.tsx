import React, { useState, useEffect } from 'react';
import { CalendarSettings as ICalendarSettings } from '../types';
import { Card, Button, Badge } from './Shared';
import { Calendar, CheckCircle, CreditCard, DollarSign, LayoutList, Wallet } from 'lucide-react';
import { api } from '../services/api';

interface CalendarSettingsTabProps {
    initialSettings?: ICalendarSettings;
    onSave?: (newSettings: ICalendarSettings) => void;
}

export const CalendarSettingsTab: React.FC<CalendarSettingsTabProps> = ({ initialSettings, onSave }) => {
    const [settings, setSettings] = useState<ICalendarSettings>({
        commitments: true,
        tasks: true,
        financial: {
            enabled: true,
            budgets: true,
            receivable: true,
            payable: true,
            credit_card: true
        }
    });

    useEffect(() => {
        if (initialSettings) {
            setSettings(initialSettings);
        }
    }, [initialSettings]);

    const handleToggle = (key: keyof ICalendarSettings) => {
        if (key === 'financial') {
            setSettings({
                ...settings,
                financial: { ...settings.financial, enabled: !settings.financial.enabled }
            });
        } else {
            setSettings({ ...settings, [key]: !settings[key] });
        }
    };

    const handleFinanceToggle = (key: keyof ICalendarSettings['financial']) => {
        if (key === 'enabled') return;
        setSettings({
            ...settings,
            financial: { ...settings.financial, [key]: !settings.financial[key] }
        });
    };

    const handleSave = async () => {
        try {
            await api.updateCalendarSettings(settings);
            if (onSave) onSave(settings);
            alert('Configurações do calendário salvas com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configurações.');
        }
    };

    return (
        <Card className="p-6 max-w-4xl">
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2">
                    <Calendar size={20} className="text-emerald-500" />
                    Configuração do Calendário Unificado
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                    Defina quais eventos devem aparecer no calendário da empresa.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Level 1 & 2 */}
                <div className="space-y-6">
                    <div
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${settings.commitments ? 'bg-indigo-500/20 dark:bg-indigo-500/10 border-indigo-500 dark:border-indigo-500/50' : 'bg-secondary/30 dark:bg-slate-800/50 border-border dark:border-slate-700/50 opacity-60'}`}
                        onClick={() => handleToggle('commitments')}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-indigo-700 dark:text-white flex items-center gap-2">
                                <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
                                Compromissos (Agenda)
                            </h3>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.commitments ? 'bg-indigo-500' : 'bg-muted-foreground dark:bg-slate-600'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.commitments ? 'left-6' : 'left-1'}`} />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Reuniões, eventos internos e compromissos manuais.
                        </p>
                    </div>

                    <div
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${settings.tasks ? 'bg-emerald-500/20 dark:bg-emerald-500/10 border-emerald-500 dark:border-emerald-500/50' : 'bg-secondary/30 dark:bg-slate-800/50 border-border dark:border-slate-700/50 opacity-60'}`}
                        onClick={() => handleToggle('tasks')}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-emerald-700 dark:text-white flex items-center gap-2">
                                <LayoutList size={18} className="text-emerald-600 dark:text-emerald-400" />
                                Tarefas (Prazos)
                            </h3>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.tasks ? 'bg-emerald-500' : 'bg-muted-foreground dark:bg-slate-600'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.tasks ? 'left-6' : 'left-1'}`} />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Prazos finais de tarefas, deadlines e checklists.
                        </p>
                    </div>
                </div>

                {/* Level 3: Finance */}
                <div className={`p-4 rounded-xl border transition-all ${settings.financial.enabled ? 'bg-amber-500/20 dark:bg-amber-500/5 border-amber-500 dark:border-amber-500/30' : 'bg-secondary/30 dark:bg-slate-800/50 border-border dark:border-slate-700/50 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-6 cursor-pointer" onClick={() => handleToggle('financial')}>
                        <h3 className="font-medium text-amber-700 dark:text-white flex items-center gap-2">
                            <DollarSign size={18} className="text-amber-600 dark:text-amber-400" />
                            Financeiro (Macro)
                        </h3>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.financial.enabled ? 'bg-amber-500' : 'bg-muted-foreground dark:bg-slate-600'}`}>
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.financial.enabled ? 'left-6' : 'left-1'}`} />
                        </div>
                    </div>

                    {settings.financial.enabled && (
                        <div className="space-y-3 pl-4 border-l-2 border-amber-500/50 dark:border-amber-500/20">
                            {/* 3.1 Budgets */}
                            <div
                                className="flex items-center justify-between p-2 hover:bg-secondary/50 dark:hover:bg-slate-800/50 rounded cursor-pointer"
                                onClick={() => handleFinanceToggle('budgets')}
                            >
                                <span className="text-sm text-foreground dark:text-slate-300">Orçamentos (Validade)</span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.financial.budgets ? 'bg-emerald-500' : 'bg-muted-foreground dark:bg-slate-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${settings.financial.budgets ? 'left-4.5' : 'left-0.5'}`} style={{ left: settings.financial.budgets ? '1.125rem' : '0.125rem' }} />
                                </div>
                            </div>

                            {/* 3.2 Receivable */}
                            <div
                                className="flex items-center justify-between p-2 hover:bg-secondary/50 dark:hover:bg-slate-800/50 rounded cursor-pointer"
                                onClick={() => handleFinanceToggle('receivable')}
                            >
                                <span className="text-sm text-foreground dark:text-slate-300">Contas a Receber</span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.financial.receivable ? 'bg-emerald-500' : 'bg-muted-foreground dark:bg-slate-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all`} style={{ left: settings.financial.receivable ? '1.125rem' : '0.125rem' }} />
                                </div>
                            </div>

                            {/* 3.3 Payable */}
                            <div
                                className="flex items-center justify-between p-2 hover:bg-secondary/50 dark:hover:bg-slate-800/50 rounded cursor-pointer"
                                onClick={() => handleFinanceToggle('payable')}
                            >
                                <span className="text-sm text-foreground dark:text-slate-300">Contas a Pagar</span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.financial.payable ? 'bg-emerald-500' : 'bg-muted-foreground dark:bg-slate-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all`} style={{ left: settings.financial.payable ? '1.125rem' : '0.125rem' }} />
                                </div>
                            </div>

                            {/* 3.4 Credit Card */}
                            <div
                                className="flex items-center justify-between p-2 hover:bg-secondary/50 dark:hover:bg-slate-800/50 rounded cursor-pointer"
                                onClick={() => handleFinanceToggle('credit_card')}
                            >
                                <span className="text-sm text-foreground dark:text-slate-300">Cartão de Crédito</span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.financial.credit_card ? 'bg-emerald-500' : 'bg-muted-foreground dark:bg-slate-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all`} style={{ left: settings.financial.credit_card ? '1.125rem' : '0.125rem' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-border dark:border-slate-800 mt-6">
                <Button onClick={handleSave} className="px-8">
                    Salvar Alterações
                </Button>
            </div>
        </Card>
    );
};
