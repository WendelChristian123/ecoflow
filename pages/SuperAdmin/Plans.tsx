import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { SYSTEM_MODULES } from '../../lib/constants';
import { SaasPlan } from '../../types';
import { Loader, Card, Button, Badge, Modal, Input, Select, CurrencyInput } from '../../components/Shared';
import {
    CreditCard, Check, Edit2, Power, Plus, CheckCircle2, Package,
    Users, MoreVertical, Copy, Archive, EyeOff, Building2, Lock, DollarSign
} from 'lucide-react';

// Extended Plan Type for UI Mocking (Removed)

export const SuperAdminPlans: React.FC = () => {
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Form State
    const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        billingCycle: 'monthly',
        maxUsers: 5,
        type: 'public',
        status: 'active',
        // Module configuration state
        modules: {} as Record<string, 'included' | 'locked' | 'extra'>
    });

    useEffect(() => {
        loadPlans();
    }, []);

    // Click outside to close menu
    React.useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const data = await api.getSaasPlans();

            // Normalize module config if missing
            const normalized = data.map(p => {
                let modConfig = p.moduleConfig || {};
                // If empty, try to derive from allowedModules for legacy
                if (Object.keys(modConfig).length === 0 && p.allowedModules) {
                    SYSTEM_MODULES.forEach(m => {
                        modConfig[m.id] = p.allowedModules.includes(m.id) ? 'included' : 'locked';
                    });
                }
                return { ...p, moduleConfig: modConfig };
            });

            setPlans(normalized);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleOpenCreate = () => {
        setEditingPlan(null);

        // Default module config
        const defaultMods: Record<string, 'included' | 'locked' | 'extra'> = {};
        SYSTEM_MODULES.forEach(m => defaultMods[m.id] = m.id === 'mod_tasks' ? 'included' : 'locked');

        setFormData({
            name: '',
            price: 0,
            billingCycle: 'monthly',
            maxUsers: 5,
            type: 'public',
            status: 'active',
            modules: defaultMods
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (plan: SaasPlan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            price: plan.price,
            billingCycle: plan.billingCycle,
            maxUsers: plan.maxUsers,
            type: plan.type,
            status: plan.status,
            modules: plan.moduleConfig
        });
        setActiveMenuId(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Convert enriched module config back to simple array for legacy backend compatibility
        const allowedModules = Object.entries(formData.modules)
            .filter(([_, status]) => status === 'included' || status === 'extra')
            .map(([id]) => id);

        const planData = {
            id: editingPlan?.id,
            name: formData.name,
            price: formData.price,
            billingCycle: formData.billingCycle as 'monthly' | 'yearly',
            maxUsers: formData.maxUsers,
            active: formData.status === 'active', // Map status back to simple boolean
            allowedModules: allowedModules,
            features: allowedModules
        };

        try {
            if (editingPlan) {
                await api.updateSaasPlan(planData);
            } else {
                await api.createSaasPlan(planData);
            }
            setIsModalOpen(false);
            loadPlans();
        } catch (error: any) {
            console.error("Erro detalhado:", error);
            alert("Erro ao salvar plano: " + getErrorMessage(error));
            setLoading(false);
        }
    }

    const cycleModuleStatus = (modId: string) => {
        if (modId === 'mod_tasks') return; // Core mandatory

        setFormData(prev => {
            const current = prev.modules[modId];
            let next: 'included' | 'locked' | 'extra' = 'included';

            if (current === 'included') next = 'extra';
            else if (current === 'extra') next = 'locked';
            else next = 'included';

            return {
                ...prev,
                modules: { ...prev.modules, [modId]: next }
            };
        });
    };

    const getPlanTypeBadge = (type: string) => {
        switch (type) {
            case 'trial': return <Badge variant="neutral" className="bg-slate-700 text-slate-300">Trial</Badge>;
            case 'public': return <Badge variant="success" className="bg-emerald-500/10 text-emerald-400">Público</Badge>;
            case 'internal': return <Badge variant="warning" className="bg-amber-500/10 text-amber-400">Interno</Badge>;
            case 'custom': return <Badge variant="default" className="bg-indigo-500/10 text-indigo-400">Custom</Badge>;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'hidden': return 'warning';
            case 'archived': return 'neutral';
            default: return 'neutral';
        }
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <CreditCard className="text-indigo-500" /> Planos & Preços
                </h1>
                <Button className="gap-2" onClick={handleOpenCreate}>
                    <Plus size={18} /> Novo Plano
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                        Nenhum plano cadastrado.
                    </div>
                )}
                {plans.map(plan => (
                    <Card key={plan.id} className={`flex flex-col border-t-4 relative group transition-colors ${plan.status === 'archived' ? 'border-t-slate-600 opacity-75 grayscale-[0.5]' : 'border-t-indigo-500 hover:border-indigo-400'}`}>
                        {/* Actions Menu */}
                        <div className="absolute top-4 right-4 z-10">
                            <div className="relative inline-block">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === plan.id ? null : plan.id); }}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {activeMenuId === plan.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                        <button onClick={() => handleOpenEdit(plan)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white text-left w-full transition-colors">
                                            <Edit2 size={14} /> Editar Plano
                                        </button>
                                        <button onClick={() => alert("Duplicar simulado")} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white text-left w-full transition-colors">
                                            <Copy size={14} /> Duplicar
                                        </button>
                                        <div className="h-px bg-slate-800 my-1" />
                                        {plan.status !== 'hidden' && (
                                            <button onClick={() => alert("Ocultar simulado")} className="flex items-center gap-2 px-4 py-2 text-sm text-amber-500 hover:bg-amber-500/10 text-left w-full transition-colors">
                                                <EyeOff size={14} /> Ocultar (Soft Limit)
                                            </button>
                                        )}
                                        {plan.status !== 'archived' && (
                                            <button onClick={() => alert("Arquivar simulado")} className="flex items-center gap-2 px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 text-left w-full transition-colors">
                                                <Archive size={14} /> Arquivar (Hard Block)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mb-4 pr-10">
                            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mt-2 mb-3">
                                <span className="text-2xl font-bold text-emerald-400">
                                    {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
                                </span>
                                {plan.price > 0 && (
                                    <span className="text-sm text-slate-500">/{plan.billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {getPlanTypeBadge(plan.type)}
                                <Badge variant="neutral" className="bg-slate-800 border-slate-700">
                                    {plan.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-3 flex-1 mb-6 border-t border-slate-700/50 pt-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-slate-300">
                                    <Users size={16} className="text-indigo-400" /> Usuários
                                </span>
                                <span className="text-white font-medium">Até {plan.maxUsers}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-slate-300">
                                    <Building2 size={16} className="text-indigo-400" /> Empresas Ativas
                                </span>
                                <span className="text-white font-medium">0</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                            <Badge variant={getStatusColor(plan.status)}>
                                {plan.status === 'active' ? 'Ativo' : plan.status === 'hidden' ? 'Oculto' : 'Arquivado'}
                            </Badge>
                            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">ID: {plan.id.slice(0, 6)}</span>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPlan ? "Editar Plano" : "Configurar Novo Plano"}>
                <form onSubmit={handleSave} className="space-y-5">

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome do Plano" placeholder="Ex: Starter" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Tipo do Plano</label>
                            <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="public">Público (Venda pelo Site)</option>
                                <option value="trial">Trial (Período Gratuito)</option>
                                <option value="internal">Interno (Staff/Demo)</option>
                                <option value="custom">Custom (Enterprise)</option>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <CurrencyInput label="Preço" value={formData.price} onValueChange={val => setFormData({ ...formData, price: val || 0 })} required disabled={formData.type === 'trial'} />
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Ciclo de Cobrança</label>
                            <Select value={formData.billingCycle} onChange={e => setFormData({ ...formData, billingCycle: e.target.value })}>
                                <option value="monthly">Mensal</option>
                                <option value="yearly">Anual</option>
                            </Select>
                        </div>
                    </div>

                    <Input label="Limite de Usuários (Seats)" type="number" value={formData.maxUsers} onChange={e => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })} required />

                    {/* Module Selection */}
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Package size={16} className="text-indigo-400" /> Módulos Permitidos
                        </h4>
                        <p className="text-xs text-slate-400 mb-3">Clique para alternar: <span className="text-emerald-400">Incluso</span> → <span className="text-amber-400">Extra ($)</span> → <span className="text-slate-500">Bloqueado</span></p>

                        <div className="space-y-2">
                            {SYSTEM_MODULES.map(mod => {
                                const status = formData.modules[mod.id] || 'locked';
                                const isMandatory = mod.id === 'mod_tasks';
                                return (
                                    <div
                                        key={mod.id}
                                        onClick={() => !isMandatory && cycleModuleStatus(mod.id)}
                                        className={`flex items-center justify-between p-2 rounded border cursor-pointer select-none transition-all ${status === 'included' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                            status === 'extra' ? 'bg-amber-500/10 border-amber-500/30' :
                                                'bg-slate-900 border-slate-700 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${status === 'included' ? 'bg-emerald-500 border-emerald-500' :
                                                status === 'extra' ? 'bg-amber-500 border-amber-500' :
                                                    'border-slate-500 bg-slate-800'
                                                }`}>
                                                {status === 'included' && <CheckCircle2 size={14} className="text-white" />}
                                                {status === 'extra' && <DollarSign size={14} className="text-white" />}
                                                {status === 'locked' && <Lock size={12} className="text-slate-400" />}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-medium ${status !== 'locked' ? 'text-white' : 'text-slate-400'}`}>
                                                    {mod.name}
                                                </div>
                                            </div>
                                        </div>
                                        {status === 'included' && <span className="text-[10px] text-emerald-400 font-bold uppercase">Incluso</span>}
                                        {status === 'extra' && <span className="text-[10px] text-amber-400 font-bold uppercase">Upsell</span>}
                                        {status === 'locked' && <span className="text-[10px] text-slate-500 uppercase">Bloqueado</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Status do Plano</label>
                        <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                            <option value="active">Ativo (Disponível para venda)</option>
                            <option value="hidden">Oculto (Atribuição manual apenas)</option>
                            <option value="archived">Arquivado (Legado/Descontinuado)</option>
                        </Select>
                        {formData.status === 'archived' && (
                            <p className="text-xs text-rose-400 mt-2 flex items-center gap-1">
                                <Archive size={12} /> Atenção: Planos arquivados não podem receber novas assinaturas.
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 gap-2 border-t border-slate-800">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Plano</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
