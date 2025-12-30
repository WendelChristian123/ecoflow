
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { SYSTEM_MODULES } from '../../lib/constants';
import { SaasPlan } from '../../types';
import { Loader, Card, Button, Badge, Modal, Input, Select } from '../../components/Shared';
import { CreditCard, Check, Edit2, Power, Plus, CheckCircle2, Package, Users } from 'lucide-react';

export const SuperAdminPlans: React.FC = () => {
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form State
    const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        billingCycle: 'monthly',
        maxUsers: 5,
        active: true,
        selectedModules: ['mod_tasks'] as string[]
    });

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const data = await api.getSaasPlans();
            setPlans(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleOpenCreate = () => {
        setEditingPlan(null);
        setFormData({
            name: '',
            price: 0,
            billingCycle: 'monthly',
            maxUsers: 5,
            active: true,
            selectedModules: ['mod_tasks']
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
            active: plan.active,
            selectedModules: plan.allowedModules || ['mod_tasks']
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        const planData = {
            id: editingPlan?.id, // ID is needed for update
            name: formData.name,
            price: formData.price,
            billingCycle: formData.billingCycle as 'monthly' | 'yearly',
            maxUsers: formData.maxUsers,
            active: formData.active,
            allowedModules: formData.selectedModules,
            features: formData.selectedModules // Keeping features same as modules for simplicity in DB
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

    const toggleModule = (modId: string) => {
        if (modId === 'mod_tasks') return; // Core mandatory
        setFormData(prev => {
            const modules = prev.selectedModules.includes(modId)
                ? prev.selectedModules.filter(m => m !== modId)
                : [...prev.selectedModules, modId];
            return { ...prev, selectedModules: modules };
        });
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
                    <Card key={plan.id} className="flex flex-col border-t-4 border-t-indigo-500 relative group hover:border-indigo-400 transition-colors">
                        <div className="absolute top-4 right-4 flex gap-2">
                            <button 
                                onClick={() => handleOpenEdit(plan)}
                                className="text-slate-500 hover:text-white p-1 bg-slate-800 rounded hover:bg-slate-700 transition-colors"
                                title="Editar Plano"
                            >
                                <Edit2 size={16}/>
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-2xl font-bold text-emerald-400">R$ {plan.price.toFixed(2)}</span>
                                <span className="text-sm text-slate-500">/{plan.billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                            </div>
                        </div>

                        <div className="space-y-3 flex-1 mb-6 border-t border-slate-700/50 pt-4">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Users size={16} className="text-indigo-400"/> 
                                <span>Até {plan.maxUsers} usuários</span>
                            </div>
                            
                            {/* Display Features based on allowedModules */}
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase mt-2 mb-1">Módulos Inclusos</p>
                                {SYSTEM_MODULES.map(mod => {
                                    if (!plan.allowedModules.includes(mod.id)) return null;
                                    return (
                                        <div key={mod.id} className="flex items-center gap-2 text-sm text-slate-400">
                                            <Check size={14} className="text-emerald-500"/> {mod.name}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                            <Badge variant={plan.active ? 'success' : 'neutral'}>{plan.active ? 'Ativo' : 'Arquivado'}</Badge>
                            <button className="text-xs font-medium text-slate-500 hover:text-rose-400 flex items-center gap-1">
                                <Power size={12}/> {plan.active ? 'Desativar' : 'Ativar'}
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPlan ? "Editar Plano" : "Configurar Novo Plano"}>
                <form onSubmit={handleSave} className="space-y-5">
                    <Input label="Nome do Plano" placeholder="Ex: Starter" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Preço (R$)" type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} required />
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Ciclo de Cobrança</label>
                            <Select value={formData.billingCycle} onChange={e => setFormData({...formData, billingCycle: e.target.value})}>
                                <option value="monthly">Mensal</option>
                                <option value="yearly">Anual</option>
                            </Select>
                        </div>
                    </div>
                    
                    <Input label="Limite de Usuários" type="number" value={formData.maxUsers} onChange={e => setFormData({...formData, maxUsers: parseInt(e.target.value)})} required />
                    
                    {/* Module Selection */}
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Package size={16} className="text-indigo-400"/> Módulos Permitidos
                        </h4>
                        <p className="text-xs text-slate-400 mb-3">Selecione quais funcionalidades estarão disponíveis para empresas neste plano.</p>
                        
                        <div className="space-y-2">
                            {SYSTEM_MODULES.map(mod => {
                                const isSelected = formData.selectedModules.includes(mod.id);
                                const isMandatory = mod.id === 'mod_tasks';
                                return (
                                    <div 
                                        key={mod.id} 
                                        onClick={() => !isMandatory && toggleModule(mod.id)}
                                        className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                                            isSelected ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-900 border-slate-700 hover:bg-slate-700'
                                        } ${isMandatory ? 'opacity-75 cursor-default' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>
                                                {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                                    {mod.name}
                                                </div>
                                            </div>
                                        </div>
                                        {isMandatory && <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Core</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Status do Plano</label>
                        <Select value={formData.active ? 'true' : 'false'} onChange={e => setFormData({...formData, active: e.target.value === 'true'})}>
                            <option value="true">Ativo (Disponível para venda)</option>
                            <option value="false">Inativo (Arquivado)</option>
                        </Select>
                    </div>

                    <div className="flex justify-end pt-4 gap-2 border-t border-slate-800">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Plano</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
