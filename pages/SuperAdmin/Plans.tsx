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
        priceMonthly: 0,
        priceSemiannually: 0,
        priceYearly: 0,
        maxUsers: 5,
        type: 'public',
        status: 'active',
        // Module configuration state
        modules: {} as Record<string, 'included' | 'locked' | 'extra'>
    });
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());

    const loadPlans = async () => {
        try {
            const data = await api.getSaasPlans();
            setPlans(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const handleOpenCreate = () => {
        setEditingPlan(null);
        // Default module config
        const defaultMods: Record<string, 'included' | 'locked' | 'extra'> = {};
        SYSTEM_MODULES.forEach(m => defaultMods[m.id] = m.id === 'mod_tasks' ? 'included' : 'locked');

        setFormData({
            name: '',
            priceMonthly: 0,
            priceSemiannually: 0,
            priceYearly: 0,
            maxUsers: 5,
            type: 'public',
            status: 'active',
            modules: defaultMods
        });
        setSelectedFeatures(new Set());
        setIsModalOpen(true);
    };

    const handleOpenEdit = (plan: SaasPlan) => {
        setEditingPlan(plan);
        // Load features from plan
        const planModules = plan.allowedModules || [];
        const config: Record<string, 'included' | 'locked' | 'extra'> = {};
        const feats = new Set<string>();

        // Reconstruct config from allowedModules array which now contains 'modId', 'modId:extra', 'modId:featId'
        // First pass: identify modules
        SYSTEM_MODULES.forEach(sysMod => {
            // Check if module is present in any form
            const isPresent = planModules.some(m => m === sysMod.id || m.startsWith(sysMod.id + ':'));
            if (isPresent) {
                // Determine status
                if (planModules.includes(sysMod.id + ':extra')) {
                    config[sysMod.id] = 'extra';
                } else {
                    // Default to included if present (unless forced extra?)
                    // If base ID is present, it's included.
                    // If ONLY features are present? Typically base ID is present too.
                    config[sysMod.id] = 'included';
                }

                // Determine features
                // Logic: If NO specific features listed, but module is there -> Legacy -> ALL?
                // OR -> If features listed, use them.
                const specificFeatures = planModules.filter(m => m.startsWith(sysMod.id + ':') && m !== sysMod.id + ':extra');
                if (specificFeatures.length > 0) {
                    specificFeatures.forEach(sf => feats.add(sf.split(':')[1]));
                } else {
                    // Legacy or "All default"?
                    // If user saved a plan before this feature, likely they want all features.
                    if (sysMod.features) sysMod.features.forEach(f => feats.add(f.id));
                }
            } else {
                config[sysMod.id] = 'locked';
            }
        });

        // Ensure mandatory
        config['mod_tasks'] = 'included';

        setFormData({
            name: plan.name,
            priceMonthly: plan.priceMonthly || 0,
            priceSemiannually: plan.priceSemiannually || 0,
            priceYearly: plan.priceYearly || 0,
            maxUsers: plan.maxUsers,
            type: plan.type,
            status: plan.status,
            modules: config
        });
        setSelectedFeatures(feats);
        setActiveMenuId(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Serialize Modules + Features
        const allowedModules: string[] = [];

        Object.entries(formData.modules).forEach(([modId, status]) => {
            if (status === 'locked') return;

            // Add Module Entry
            allowedModules.push(status === 'extra' ? `${modId}:extra` : modId);

            // Add Feature Entries
            const mod = SYSTEM_MODULES.find(m => m.id === modId);
            if (mod && mod.features) {
                mod.features.forEach(feat => {
                    if (selectedFeatures.has(feat.id)) {
                        allowedModules.push(`${modId}:${feat.id}`);
                    }
                });
            }
        });

        const planData = {
            id: editingPlan?.id,
            name: formData.name,
            priceMonthly: formData.priceMonthly,
            priceSemiannually: formData.priceSemiannually,
            priceYearly: formData.priceYearly,
            maxUsers: formData.maxUsers,
            active: formData.status === 'active',
            allowedModules: allowedModules,
            features: allowedModules,
            type: formData.type,
            status: formData.status
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
        } finally {
            setLoading(false);
        }
    };

    const cycleModuleStatus = (modId: string) => {
        if (modId === 'mod_tasks') return; // Core mandatory

        setFormData(prev => {
            const current = prev.modules[modId];
            let next: 'included' | 'locked' | 'extra' = 'included';

            if (current === 'included') next = 'extra';
            else if (current === 'extra') next = 'locked';
            else next = 'included';

            // Auto-select features if unlocking
            if (next === 'included') {
                const mod = SYSTEM_MODULES.find(m => m.id === modId);
                if (mod && mod.features) {
                    setSelectedFeatures(prevF => {
                        const newF = new Set(prevF);
                        mod.features.forEach(f => newF.add(f.id));
                        return newF;
                    });
                }
            }

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
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2 bg-background p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <CreditCard className="text-indigo-500" /> Planos & Preços
                </h1>
                <Button className="gap-2" onClick={handleOpenCreate}>
                    <Plus size={18} /> Novo Plano
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                        Nenhum plano cadastrado.
                    </div>
                )}
                {plans.map(plan => (
                    <Card key={plan.id} className={`flex flex-col border-t-4 relative group transition-colors bg-card shadow-sm ${plan.status === 'archived' ? 'border-t-muted opacity-75 grayscale-[0.5]' : 'border-t-primary hover:border-primary/80'}`}>
                        <div className="absolute top-4 right-4 z-10">
                            <div className="relative inline-block">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === plan.id ? null : plan.id); }}
                                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {activeMenuId === plan.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                        <button onClick={() => handleOpenEdit(plan)} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground text-left w-full transition-colors">
                                            <Edit2 size={14} /> Editar Plano
                                        </button>
                                        <button onClick={() => alert("Duplicar simulado")} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground text-left w-full transition-colors">
                                            <Copy size={14} /> Duplicar
                                        </button>
                                        <div className="h-px bg-border my-1" />
                                        {plan.status !== 'hidden' && (
                                            <button onClick={() => alert("Ocultar simulado")} className="flex items-center gap-2 px-4 py-2 text-sm text-amber-500 hover:bg-amber-500/10 text-left w-full transition-colors">
                                                <EyeOff size={14} /> Ocultar (Soft Limit)
                                            </button>
                                        )}
                                        {plan.status !== 'archived' && (
                                            <button onClick={() => {
                                                if (window.confirm("⚠️ Tem certeza que deseja excluir este plano permanentemente? Essa ação não pode ser desfeita.")) {
                                                    api.deleteSaasPlan(plan.id).then(() => {
                                                        alert("Plano excluído com sucesso!");
                                                        loadPlans();
                                                    }).catch(err => {
                                                        alert("Erro ao excluir: " + getErrorMessage(err));
                                                    });
                                                }
                                            }} className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left w-full transition-colors">
                                                <Archive size={14} /> Excluir (Permanente)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mb-4 pr-10">
                            <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                            <div className="flex flex-col gap-1 mt-2 mb-3">
                                <div className="text-sm text-muted-foreground">Mensal: <span className="text-primary font-bold">R$ {plan.priceMonthly?.toFixed(2)}</span></div>
                                <div className="text-sm text-muted-foreground">Semestral: <span className="text-primary font-bold">R$ {plan.priceSemiannually?.toFixed(2)}</span></div>
                                <div className="text-sm text-muted-foreground">Anual: <span className="text-primary font-bold">R$ {plan.priceYearly?.toFixed(2)}</span></div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {getPlanTypeBadge(plan.type)}
                            </div>
                        </div>

                        <div className="space-y-3 flex-1 mb-6 border-t border-border pt-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Users size={16} className="text-primary" /> Usuários
                                </span>
                                <span className="text-foreground font-medium">Até {plan.maxUsers}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Building2 size={16} className="text-primary" /> Empresas Ativas
                                </span>
                                <span className="text-foreground font-medium">0</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border flex justify-between items-center">
                            <Badge variant={getStatusColor(plan.status)}>
                                {plan.status === 'active' ? 'Ativo' : plan.status === 'hidden' ? 'Oculto' : 'Arquivado'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">ID: {plan.id.slice(0, 6)}</span>
                        </div>
                    </Card >
                ))}
            </div >

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPlan ? "Editar Plano" : "Configurar Novo Plano"}>
                <form onSubmit={handleSave} className="space-y-5">

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome do Plano" placeholder="Ex: Starter" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Tipo do Plano</label>
                            <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="public">Público (Venda pelo Site)</option>
                                <option value="trial">Trial (Período Gratuito)</option>
                                <option value="internal">Interno (Staff/Demo)</option>
                                <option value="custom">Custom (Enterprise)</option>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <CurrencyInput label="Preço Mensal" value={formData.priceMonthly} onValueChange={val => setFormData({ ...formData, priceMonthly: val || 0 })} disabled={formData.type === 'trial'} />
                        <CurrencyInput label="Preço Semestral" value={formData.priceSemiannually} onValueChange={val => setFormData({ ...formData, priceSemiannually: val || 0 })} disabled={formData.type === 'trial'} />
                        <CurrencyInput label="Preço Anual" value={formData.priceYearly} onValueChange={val => setFormData({ ...formData, priceYearly: val || 0 })} disabled={formData.type === 'trial'} />
                    </div>

                    <Input label="Limite de Usuários (Seats)" type="number" value={formData.maxUsers} onChange={e => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })} required />

                    {/* Module Selection */}
                    <div className="bg-card p-4 rounded-lg border border-border">
                        <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                            <Package size={16} className="text-primary" /> Módulos Permitidos
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">Clique para alternar: <span className="text-green-500">Incluso</span> → <span className="text-amber-500">Extra ($)</span> → <span className="text-muted-foreground">Bloqueado</span></p>

                        <div className="space-y-2">
                            {SYSTEM_MODULES.map(mod => {
                                const status = formData.modules[mod.id] || 'locked';
                                const isMandatory = mod.id === 'mod_tasks';
                                return (
                                    <div
                                        key={mod.id}
                                        className={`flex flex-col p-3 rounded border select-none transition-all ${status === 'included' ? 'bg-green-500/10 border-green-500/30' :
                                            status === 'extra' ? 'bg-amber-500/10 border-amber-500/30' :
                                                'bg-muted border-border opacity-80'
                                            }`}
                                    >
                                        <div
                                            onClick={() => !isMandatory && cycleModuleStatus(mod.id)}
                                            className="flex items-center justify-between cursor-pointer mb-2"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${status === 'included' ? 'bg-emerald-500 border-emerald-500' :
                                                    status === 'extra' ? 'bg-amber-500 border-amber-500' :
                                                        'border-muted-foreground bg-muted'
                                                    }`}>
                                                    {status === 'included' && <CheckCircle2 size={14} className="text-white" />}
                                                    {status === 'extra' && <DollarSign size={14} className="text-white" />}
                                                    {status === 'locked' && <Lock size={12} className="text-muted-foreground" />}
                                                </div>
                                                <div className={`text-sm font-medium ${status !== 'locked' ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {mod.name}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {status === 'included' && <Badge variant="success" className='text-[10px] uppercase'>Incluso</Badge>}
                                                {status === 'extra' && <Badge variant="warning" className='text-[10px] uppercase'>Upsell</Badge>}
                                                {status === 'locked' && <span className="text-[10px] text-muted-foreground uppercase font-bold">Bloqueado</span>}
                                            </div>
                                        </div>

                                        {/* Granular Features */}
                                        {status !== 'locked' && mod.features && mod.features.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 pl-9 pt-1 border-t border-border mt-1">
                                                {mod.features.map(feat => {
                                                    const isSelected = selectedFeatures.has(feat.id);
                                                    return (
                                                        <div
                                                            key={feat.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newSet = new Set(selectedFeatures);
                                                                if (newSet.has(feat.id)) newSet.delete(feat.id);
                                                                else newSet.add(feat.id);
                                                                setSelectedFeatures(newSet);
                                                            }}
                                                            className="flex items-center gap-2 cursor-pointer group"
                                                        >
                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground bg-transparent group-hover:border-primary'
                                                                }`}>
                                                                {isSelected && <Check size={10} className="text-white" />}
                                                            </div>
                                                            <span className={`text-xs ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                                                {feat.name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Status do Plano</label>
                        <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                            <option value="active">Ativo (Disponível para venda)</option>
                            <option value="hidden">Oculto (Atribuição manual apenas)</option>
                            <option value="archived">Arquivado (Legado/Descontinuado)</option>
                        </Select>
                        {formData.status === 'archived' && (
                            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                                <Archive size={12} /> Atenção: Planos arquivados não podem receber novas assinaturas.
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 gap-2 border-t border-border">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Plano</Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};
