
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant, SaasPlan } from '../../types';
import { useRBAC } from '../../context/RBACContext';
import { useTenant } from '../../context/TenantContext';
import { Loader, Button, Input, Card, Badge, cn, Modal, Select } from '../../components/Shared';
import { Building2, Plus, Search, LogIn, Calendar, Users, Globe, Edit, Trash2, CheckCircle2, ChevronRight, ChevronLeft, CreditCard, DollarSign, Lock, Package, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SYSTEM_MODULES } from '../../lib/constants';

export const SuperAdminTenants: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { availableTenants, refreshTenants, switchTenant, currentTenant } = useTenant();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1); // 1: Info, 2: Plan, 3: Modules
    const [availablePlans, setAvailablePlans] = useState<SaasPlan[]>([]);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantOwner, setNewTenantOwner] = useState('');
    const [newTenantCnpj, setNewTenantCnpj] = useState('');
    const [newTenantPhone, setNewTenantPhone] = useState('');
    const [newTenantAdminName, setNewTenantAdminName] = useState('');
    const [newTenantPassword, setNewTenantPassword] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string>(''); // 'custom' or plan_id

    // Module State (Detailed Configuration)
    const [moduleConfig, setModuleConfig] = useState<Record<string, 'included' | 'locked' | 'extra'>>({});
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set()); // NEW: Track granular features
    const [activeCategoryTab, setActiveCategoryTab] = useState<string>('Todos'); // NEW: Category Filter


    // Status State for Edit
    const [docType, setDocType] = useState<'CNPJ' | 'CPF'>('CNPJ');
    const [tenantStatus, setTenantStatus] = useState<'active' | 'inactive'>('active');

    const [creating, setCreating] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/');
        }
    }, [isSuperAdmin]);

    // Load Plans on Open
    useEffect(() => {
        if (isModalOpen) {
            loadPlans();
        }
    }, [isModalOpen]);

    const loadPlans = async () => {
        setLoadingPlans(true);
        try {
            const data = await api.getSaasPlans();
            setAvailablePlans(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingPlans(false);
        }
    };

    const openCreateModal = () => {
        setEditingId(null);
        setCurrentStep(1);
        setNewTenantName('');
        setNewTenantOwner('');
        setNewTenantCnpj('');
        setNewTenantPhone('');
        setNewTenantAdminName('');
        setNewTenantPassword('');
        setTenantStatus('active');
        setDocType('CNPJ');
        setSelectedPlanId('');

        // Reset Modules and Features
        const initialMods: Record<string, 'included' | 'locked' | 'extra'> = {};
        const initialFeats = new Set<string>();

        SYSTEM_MODULES.forEach(m => {
            initialMods[m.id] = m.mandatory ? 'included' : 'locked';
            if (m.mandatory && m.features) {
                m.features.forEach(f => initialFeats.add(f.id));
            }
        });

        setModuleConfig(initialMods);
        setSelectedFeatures(initialFeats);

        setIsModalOpen(true);
    };

    const openEditModal = (tenant: Tenant) => {
        setEditingId(tenant.id);
        setCurrentStep(1); // Start at 1, but user can skip forward if we wanted (UI simplificou)
        setNewTenantName(tenant.name);
        setNewTenantOwner(tenant.ownerEmail || '');
        setNewTenantCnpj(tenant.cnpj || '');
        setNewTenantPhone(tenant.phone || '');
        setNewTenantAdminName(tenant.adminName || '');
        setNewTenantPassword('');
        setTenantStatus(tenant.status === 'active' ? 'active' : 'inactive');

        // Heuristic for DocType
        const doc = tenant.cnpj || '';
        const digits = doc.replace(/\D/g, '');
        setDocType(digits.length <= 11 ? 'CPF' : 'CNPJ');

        // Logic to Reconstruct Module Config from Tenant's Contracted Modules
        // This is tricky because backend returns simple array strings ['mod_a', 'mod_b:extra']
        const initialMods: Record<string, 'included' | 'locked' | 'extra'> = {};
        const initialFeats = new Set<string>();

        // Initialize all as locked first
        SYSTEM_MODULES.forEach(m => initialMods[m.id] = 'locked');

        // Apply tenant configuration
        if (tenant.contractedModules && Array.isArray(tenant.contractedModules)) {
            tenant.contractedModules.forEach(modString => {
                const parts = modString.split(':');
                const modId = parts[0];

                // Check for feature specific permission (e.g., mod_finance:finance_overview)
                // Assuming features are stored as 'mod_id:feature_id' or similar if they are just strings in array
                // BUT, if we are using the array, we need to know if 'feature_id' is a feature.
                // Current logic handles 'extra'.
                // Strategy: if parts[1] is NOT 'extra', it might be a feature or legacy.

                // Let's iterate all known modules to find match
                const knownMod = SYSTEM_MODULES.find(m => m.id === modId);

                if (knownMod) {
                    if (parts[1] === 'extra') {
                        initialMods[modId] = 'extra';
                    } else if (parts[1]) {
                        // It is a feature?
                        if (knownMod.features.some(f => f.id === parts[1])) {
                            initialFeats.add(parts[1]);
                            // If module was locked, unlock it to included (logic depends on how we stored it)
                            if (initialMods[modId] === 'locked') initialMods[modId] = 'included';
                        }
                    } else {
                        // Just the module ID
                        initialMods[modId] = 'included';
                        // Auto-select all features? Or none?
                        // Legacy behavior: Assume all allowed if only module ID is present?
                        // Let's assume for backward compatibility we verify this later or user manual select.
                        // For now, let's select ALL features if just module ID is present (easiest migration)
                        knownMod.features.forEach(f => initialFeats.add(f.id));
                    }
                }
            });
        }

        // Ensure mandatory are included if missing (legacy fix)
        SYSTEM_MODULES.filter(m => m.mandatory).forEach(m => initialMods[m.id] = 'included');

        setModuleConfig(initialMods);
        setSelectedFeatures(initialFeats);

        // Plan ID - If tenant has one, set it. Else check if modules match a plan? 
        // For simplicity, existing tenants might default to 'custom' if we don't have plan_id on frontend Type yet.
        // Assuming tenant object has planId if we verified schema. Tenant Type might need update?
        // Let's assume 'custom' for edit unless we see an explicit plan match (advanced).
        setSelectedPlanId('custom');

        setIsModalOpen(true);
    };

    const handlePlanSelect = (planId: string) => {
        setSelectedPlanId(planId);

        if (planId === 'custom') {
            // Keep current selection or reset? Let's keep current to allow modification
            return;
        }

        const plan = availablePlans.find(p => p.id === planId);
        if (plan) {
            // Apply Plan Config
            const newConfig: Record<string, 'included' | 'locked' | 'extra'> = {};
            const newFeatures = new Set<string>();

            SYSTEM_MODULES.forEach(m => {
                // Default to locked
                newConfig[m.id] = 'locked';

                const planModules = plan.allowedModules || [];
                let isIncluded = false;
                let isExtra = false;

                // Determine Module Status
                if (planModules.includes(m.id)) {
                    newConfig[m.id] = 'included';
                    isIncluded = true;
                } else if (planModules.includes(m.id + ':extra')) {
                    newConfig[m.id] = 'extra';
                    isIncluded = true;
                    isExtra = true;
                }

                // Mandatory override
                if (m.mandatory) {
                    newConfig[m.id] = 'included';
                    isIncluded = true;
                    isExtra = false;
                }

                // Determine Features
                if (isIncluded && m.features) {
                    // Check for specific features in plan
                    const specificFeatures = planModules.filter(pm => pm.startsWith(m.id + ':') && pm !== m.id + ':extra');

                    if (specificFeatures.length > 0) {
                        // Granular selection: Use only listed features
                        specificFeatures.forEach(sf => newFeatures.add(sf.split(':')[1]));
                    } else {
                        // Legacy/Default: Select ALL features if module is included/extra (unless strictly limited?)
                        // The user request implies filtering. But for backward compat, we select all if none specified.
                        m.features.forEach(f => newFeatures.add(f.id));
                    }
                }
            });
            setModuleConfig(newConfig);
            setSelectedFeatures(newFeatures);
        }
    };

    const toggleModule = (modId: string) => {
        if (SYSTEM_MODULES.find(m => m.id === modId)?.mandatory) return;

        setModuleConfig(prev => {
            const current = prev[modId];
            let next: 'included' | 'locked' | 'extra' = 'included';

            if (current === 'included') next = 'extra';
            else if (current === 'extra') next = 'locked';
            else next = 'included'; // Locked -> Included

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

            return { ...prev, [modId]: next };
        });

        // If manual change, set plan to custom
        setSelectedPlanId('custom');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        // Flatten Modules for Backend
        const finalModules: string[] = [];
        Object.entries(moduleConfig).forEach(([modId, status]) => {
            if (status === 'locked') return;

            // Add Base Module
            if (status === 'included') finalModules.push(modId);
            else if (status === 'extra') finalModules.push(`${modId}:extra`);

            // Add Selected Features
            // Validation: Only add features if module is unlocked
            const mod = SYSTEM_MODULES.find(m => m.id === modId);
            if (mod && mod.features) {
                mod.features.forEach(feat => {
                    if (selectedFeatures.has(feat.id)) {
                        finalModules.push(`${modId}:${feat.id}`);
                    }
                });
            }
        });

        try {
            if (editingId) {
                // UPDATE
                await api.updateTenant(editingId, {
                    name: newTenantName,
                    ownerEmail: newTenantOwner,
                    adminName: newTenantAdminName,
                    cnpj: newTenantCnpj,
                    phone: newTenantPhone,
                    status: tenantStatus,
                    modules: finalModules,
                });
                alert('Empresa atualizada com sucesso!');
            } else {
                // CREATE
                await api.createTenant({
                    name: newTenantName,
                    ownerEmail: newTenantOwner,
                    cnpj: newTenantCnpj,
                    phone: newTenantPhone,
                    adminName: newTenantAdminName,
                    password: newTenantPassword,
                    modules: finalModules,
                    planId: selectedPlanId === 'custom' ? null : selectedPlanId
                });
                alert('Empresa criada com sucesso!');
            }

            await refreshTenants();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Erro detalhado:", error);
            alert('Erro ao salvar empresa: ' + getErrorMessage(error));
        } finally {
            setCreating(false);
        }
    };

    const handleAccess = (id: string) => {
        switchTenant(id);
        navigate('/');
    };

    const nextStep = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        // Validation per step
        if (currentStep === 1) {
            if (!newTenantName || !newTenantOwner || !newTenantCnpj) return alert("Preencha os campos obrigatórios.");
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (!selectedPlanId) return alert("Selecione um plano ou escolha 'Personalizado'.");
            setCurrentStep(3);
        }
    };

    const filtered = availableTenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.ownerEmail?.toLowerCase().includes(search.toLowerCase())
    );

    if (!isSuperAdmin) return null;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <Globe className="text-primary" /> Área Super Admin
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Gestão global de empresas e acessos.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Empresa Atual</p>
                        <p className="text-foreground font-medium">{currentTenant?.name || 'Selecione...'}</p>
                    </div>
                    <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2">
                        <Plus size={18} /> Nova Empresa
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {/* TABLE VIEW */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-sm text-muted-foreground">
                    <thead className="bg-muted/50 text-foreground uppercase font-bold text-xs">
                        <tr>
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Admin / Email</th>
                            <th className="px-6 py-4">Módulos</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filtered.map(tenant => (
                            <tr key={tenant.id} className={currentTenant?.id === tenant.id ? 'bg-primary/5' : 'hover:bg-muted/10'}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center text-primary">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground">{tenant.name}</p>
                                            <p className="text-xs text-muted-foreground">{tenant.cnpj || 'CNPJ não inf.'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-foreground">{tenant.adminName || 'Admin'}</p>
                                    <p className="text-xs">{tenant.ownerEmail}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                                        {tenant.contractedModules?.includes('mod_commercial') && (
                                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] border border-primary/20">Co</span>
                                        )}
                                        {tenant.contractedModules?.includes('mod_finance') && (
                                            <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] border border-border">Fi</span>
                                        )}
                                        {tenant.contractedModules?.includes('mod_tasks') && (
                                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] border border-primary/20">Op</span>
                                        )}
                                        {(!tenant.contractedModules || tenant.contractedModules.length === 0) && '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant={tenant.status === 'active' ? 'success' : 'neutral'}>
                                        {tenant.status === 'active' ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {currentTenant?.id !== tenant.id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAccess(tenant.id)}
                                                className="text-primary hover:bg-primary/10"
                                                title="Acessar"
                                            >
                                                <LogIn size={16} />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditModal(tenant)}
                                            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                                            title="Editar"
                                        >
                                            <Edit size={16} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* WIZARD MODAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Empresa (Tenant)" className="max-w-4xl">
                <form onSubmit={handleSubmit} className="flex flex-col h-[600px]">

                    {/* TABS HEADER */}
                    <div className="flex border-b border-border mb-6">
                        {[
                            { s: 1, label: '1. Dados & Licença' },
                            { s: 2, label: '2. Seleção de Plano' },
                            { s: 3, label: '3. Gestão de Módulos' }
                        ].map((step) => (
                            <button
                                key={step.s}
                                type="button"
                                onClick={() => {
                                    // Allow navigation if basic data is filled or if moving backwards
                                    if (step.s < currentStep) setCurrentStep(step.s);
                                    else if (step.s === 2 && newTenantName && newTenantOwner) setCurrentStep(2);
                                    else if (step.s === 3 && selectedPlanId) setCurrentStep(3);
                                }}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium border-b-2 transition-colors relative top-[1px]",
                                    currentStep === step.s
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {step.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
                        {/* STEP 1: BASIC INFO */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Nome da Empresa" placeholder="Ex: Acme Corp" value={newTenantName} onChange={e => setNewTenantName(e.target.value)} required />
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground flex justify-between">
                                            Documento
                                            <div className="flex gap-2">
                                                <span onClick={() => setDocType('CNPJ')} className={cn("cursor-pointer hover:text-foreground", docType === 'CNPJ' && "text-primary font-bold")}>CNPJ</span>
                                                <span className="text-border">|</span>
                                                <span onClick={() => setDocType('CPF')} className={cn("cursor-pointer hover:text-foreground", docType === 'CPF' && "text-primary font-bold")}>CPF</span>
                                            </div>
                                        </label>
                                        <Input placeholder={docType === 'CNPJ' ? "00.000.000/0001-00" : "000.000.000-00"} value={newTenantCnpj} onChange={e => setNewTenantCnpj(e.target.value)} required />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Nome do Admin" placeholder="Nome Completo" value={newTenantAdminName} onChange={e => setNewTenantAdminName(e.target.value)} required />
                                    <Input label="Telefone" placeholder="(00) 0000-0000" value={newTenantPhone} onChange={e => setNewTenantPhone(e.target.value)} required />
                                </div>

                                <Input label="Email de Acesso (Login)" type="email" placeholder="admin@empresa.com" value={newTenantOwner} onChange={e => setNewTenantOwner(e.target.value)} required />

                                {!editingId && (
                                    <Input label="Senha Inicial" type="password" value={newTenantPassword} onChange={e => setNewTenantPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" />
                                )}

                                {editingId && (
                                    <div className="bg-secondary p-3 rounded-lg border border-border flex justify-between items-center">
                                        <span className="text-sm font-medium">Status do Acesso</span>
                                        <div className="flex bg-card rounded p-0.5 border border-border">
                                            <button type="button" onClick={() => setTenantStatus('active')} className={cn("px-3 py-1 text-xs font-bold rounded", tenantStatus === 'active' ? 'bg-emerald-500 text-white' : 'text-muted-foreground')}>Ativo</button>
                                            <button type="button" onClick={() => setTenantStatus('inactive')} className={cn("px-3 py-1 text-xs font-bold rounded", tenantStatus === 'inactive' ? 'bg-rose-500 text-white' : 'text-muted-foreground')}>Bloqueado</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 2: PLANS */}
                        {currentStep === 2 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Custom Option */}
                                    <div
                                        onClick={() => handlePlanSelect('custom')}
                                        className={cn(
                                            "cursor-pointer border-2 rounded-xl p-4 transition-all relative flex flex-col justify-between h-32",
                                            selectedPlanId === 'custom' ? "border-primary bg-primary/5" : "border-border hover:border-border/80 bg-card"
                                        )}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <Package className={cn("h-5 w-5", selectedPlanId === 'custom' ? "text-primary" : "text-muted-foreground")} />
                                                <span className="font-bold text-foreground">Personalizado</span>
                                            </div>
                                            {selectedPlanId === 'custom' && <CheckCircle2 className="text-primary h-5 w-5" />}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Configure os módulos e limites manualmente.</p>
                                    </div>

                                    {/* Dynamic Plans */}
                                    {availablePlans.filter(p => p.active).map(plan => (
                                        <div
                                            key={plan.id}
                                            onClick={() => handlePlanSelect(plan.id)}
                                            className={cn(
                                                "cursor-pointer border-2 rounded-xl p-4 transition-all relative flex flex-col justify-between h-32",
                                                selectedPlanId === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-border/80 bg-card"
                                            )}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className={cn("h-5 w-5", selectedPlanId === plan.id ? "text-primary" : "text-muted-foreground")} />
                                                    <span className="font-bold text-foreground">{plan.name}</span>
                                                </div>
                                                {selectedPlanId === plan.id && <CheckCircle2 className="text-primary h-5 w-5" />}
                                            </div>

                                            <div>
                                                <p className="text-lg font-bold text-emerald-500">
                                                    R$ {plan.priceMonthly?.toFixed(2)} <span className="text-muted-foreground text-xs font-normal">/mês</span>
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    {plan.allowedModules?.length || 0} módulos incluídos
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: MODULES */}
                        {currentStep === 3 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                                {/* Module Categories Tabs */}
                                <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                                    {['Todos', ...Array.from(new Set(SYSTEM_MODULES.map(m => m.category || 'Outros')))].map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setActiveCategoryTab(cat)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                                                activeCategoryTab === cat
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-3 bg-secondary/10 border border-border rounded-lg mb-4">
                                    <p className="text-xs text-muted-foreground">
                                        Configure os módulos. Itens "Obrigatórios" não podem ser removidos. Módulos "Extra" podem ser faturados à parte.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {SYSTEM_MODULES
                                        .filter(mod => activeCategoryTab === 'Todos' || (mod.category || 'Outros') === activeCategoryTab)
                                        .map(mod => {
                                            const status = moduleConfig[mod.id] || 'locked';
                                            const isMandatory = mod.mandatory;

                                            return (
                                                <div
                                                    key={mod.id}
                                                    className={cn(
                                                        "flex flex-col p-4 rounded-xl border-2 transition-all select-none gap-4",
                                                        status !== 'locked' ? "bg-[#1E293B] border-primary/50" : "bg-card border-border opacity-80"
                                                    )}
                                                >
                                                    {/* Top Row: Header & Controls */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors border shadow-inner",
                                                                status === 'included' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500" :
                                                                    status === 'extra' ? "bg-amber-500/20 border-amber-500/50 text-amber-500" :
                                                                        "bg-secondary border-border text-muted-foreground"
                                                            )}>
                                                                {status === 'included' && <Check size={20} />}
                                                                {status === 'extra' && <DollarSign size={20} />}
                                                                {status === 'locked' && <Lock size={18} />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className={cn("font-bold text-base", status !== 'locked' ? "text-white" : "text-muted-foreground")}>{mod.name}</p>
                                                                    {isMandatory && <Badge variant="neutral" className="text-[10px] h-5 px-1.5 bg-slate-700 text-slate-300 border-none">Obrigatório</Badge>}
                                                                </div>
                                                                <p className="text-xs text-slate-400">{mod.category}</p>
                                                            </div>
                                                        </div>

                                                        {/* Controls */}
                                                        {!isMandatory && (
                                                            <div className="flex p-0.5 bg-background rounded-lg border border-border shrink-0 self-start sm:self-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setModuleConfig(prev => ({ ...prev, [mod.id]: 'locked' })); setSelectedPlanId('custom'); }}
                                                                    className={cn(
                                                                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                                        status === 'locked' ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                                    )}
                                                                >
                                                                    Bloqueado
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setModuleConfig(prev => ({ ...prev, [mod.id]: 'included' })); setSelectedPlanId('custom'); }}
                                                                    className={cn(
                                                                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                                        status === 'included' ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-emerald-500"
                                                                    )}
                                                                >
                                                                    Incluso
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setModuleConfig(prev => ({ ...prev, [mod.id]: 'extra' })); setSelectedPlanId('custom'); }}
                                                                    className={cn(
                                                                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                                                        status === 'extra' ? "bg-amber-500 text-black shadow-sm" : "text-muted-foreground hover:text-amber-500"
                                                                    )}
                                                                >
                                                                    Extra
                                                                </button>
                                                            </div>
                                                        )}

                                                        {isMandatory && (
                                                            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-500 font-bold flex items-center gap-1 shrink-0">
                                                                <CheckCircle2 size={12} /> Sempre Incluso
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Feature List (Sub-Tabs) */}
                                                    {mod.features && mod.features.length > 0 && (
                                                        <div className={cn(
                                                            "mt-2 pl-[56px] grid grid-cols-2 gap-2",
                                                            status === 'locked' ? "opacity-50 grayscale pointer-events-none" : "opacity-100"
                                                        )}>
                                                            {mod.features.map(feat => {
                                                                // Safe check for object structure just in case of mixed types during migration
                                                                const featId = typeof feat === 'string' ? feat : feat.id;
                                                                const featName = typeof feat === 'string' ? feat : feat.name;
                                                                const isSelected = selectedFeatures.has(featId);

                                                                return (
                                                                    <div
                                                                        key={featId}
                                                                        onClick={() => {
                                                                            if (status === 'locked') return;
                                                                            const newSet = new Set(selectedFeatures);
                                                                            if (newSet.has(featId)) newSet.delete(featId);
                                                                            else newSet.add(featId);
                                                                            setSelectedFeatures(newSet);
                                                                            setSelectedPlanId('custom'); // Mark as custom
                                                                        }}
                                                                        className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-white transition-colors group select-none"
                                                                    >
                                                                        <div className={cn(
                                                                            "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                                                            isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-600 group-hover:border-slate-500"
                                                                        )}>
                                                                            {isSelected && <Check size={10} className="text-white" />}
                                                                        </div>
                                                                        {featName}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-6 border-t border-border mt-auto">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>

                        {/* Single Primary Action Button that changes based on step */}
                        {currentStep < 3 ? (
                            <Button type="button" onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700">
                                Continuar
                            </Button>
                        ) : (
                            <Button type="submit" disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                                <CheckCircle2 size={18} /> {creating ? 'Salvando...' : 'Salvar Alterações'}
                            </Button>
                        )}
                    </div>
                </form>
            </Modal>
        </div >
    );
};
