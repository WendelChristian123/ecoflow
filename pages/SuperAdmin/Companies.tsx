
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Company, SaasPlan } from '../../types';
import { useRBAC } from '../../context/RBACContext';
import { useCompany } from '../../context/CompanyContext';
import { Loader, Button, Input, Card, Badge, cn, Modal, Select } from '../../components/Shared';
import { Building2, Plus, Search, LogIn, Calendar, Users, Globe, Edit, Trash2, CheckCircle2, ChevronRight, ChevronLeft, CreditCard, DollarSign, Lock, Package, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SYSTEM_MODULES } from '../../lib/constants';

export const SuperAdminCompanies: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { availableCompanies, refreshCompanies, switchCompany, currentCompany } = useCompany();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1); // 1: Info, 2: Plan, 3: Modules
    const [availablePlans, setAvailablePlans] = useState<SaasPlan[]>([]);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyOwner, setNewCompanyOwner] = useState('');
    const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
    const [newCompanyPhone, setNewCompanyPhone] = useState('');
    const [newCompanyAdminName, setNewCompanyAdminName] = useState('');
    const [newCompanyPassword, setNewCompanyPassword] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string>(''); // 'custom' or plan_id

    // Module State (Detailed Configuration)
    const [moduleConfig, setModuleConfig] = useState<Record<string, 'included' | 'locked' | 'extra'>>({});
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set()); // NEW: Track granular features
    const [activeCategoryTab, setActiveCategoryTab] = useState<string>('Todos'); // NEW: Category Filter


    // Status State for Edit
    const [docType, setDocType] = useState<'CNPJ' | 'CPF'>('CNPJ');
    const [companyStatus, setCompanyStatus] = useState<'active' | 'suspended' | 'trial'>('active');

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
        setNewCompanyName('');
        setNewCompanyOwner('');
        setNewCompanyCnpj('');
        setNewCompanyPhone('');
        setNewCompanyAdminName('');
        setNewCompanyPassword('');
        setCompanyStatus('active');
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

    const handleEdit = (company: Company) => {
        setEditingId(company.id);
        setCurrentStep(1);
        setNewCompanyName(company.name);
        setNewCompanyOwner(company.ownerEmail || '');
        setNewCompanyCnpj(company.cnpj || '');
        setNewCompanyPhone(company.phone || '');
        setNewCompanyAdminName(company.adminName || '');
        setNewCompanyPassword(''); // Empty means no change
        setCompanyStatus(company.status as any);
        setDocType(company.cnpj && company.cnpj.length > 14 ? 'CNPJ' : 'CPF'); // Heuristic
        setSelectedPlanId(company.planId || 'custom'); // If no plan, assume custom

        // Load Modules
        // We need to map from ['mod_tasks', ...] to config object
        // And ideally API should return granular config. For now, we assume simple presence = included.
        const mods: Record<string, 'included' | 'locked' | 'extra'> = {};
        const feats = new Set<string>();

        // Default all to locked first
        SYSTEM_MODULES.forEach(m => {
            mods[m.id] = m.mandatory ? 'included' : 'locked';
        });

        if (company.contractedModules) {
            company.contractedModules.forEach(mId => {
                if (mods[mId]) mods[mId] = 'included';
                // If the string contains extra info? Currently it is just ID.
            });
        }

        setModuleConfig(mods);
        setSelectedFeatures(feats);

        setIsModalOpen(true);
    };

    const handleDelete = async (company: Company) => {
        if (!window.confirm(`Tem certeza que deseja excluir "${company.name}"?`)) return;
        try {
            await api.deleteCompany(company.id);
            refreshCompanies();
        } catch (error: any) {
            alert(getErrorMessage(error));
        }
    };

    const handleSave = async () => {
        setCreating(true);
        try {
            // Build modules list for API
            // API expects array of strings.
            // We map 'included' or 'extra' from moduleConfig to the array.
            const finalModules: string[] = [];
            Object.entries(moduleConfig).forEach(([modId, status]) => {
                if (status === 'included' || status === 'extra') {
                    finalModules.push(modId);
                    // If we had 'extra' support in ID string, we would append it here.
                }
            });

            if (editingId) {
                await api.updateCompany(editingId, {
                    name: newCompanyName,
                    ownerEmail: newCompanyOwner,
                    phone: newCompanyPhone,
                    cnpj: newCompanyCnpj,
                    adminName: newCompanyAdminName,
                    status: companyStatus,
                    planId: selectedPlanId === 'custom' ? null : selectedPlanId,
                    modules: finalModules
                });
            } else {
                await api.createCompany({
                    name: newCompanyName,
                    ownerEmail: newCompanyOwner,
                    phone: newCompanyPhone,
                    cnpj: newCompanyCnpj,
                    adminName: newCompanyAdminName,
                    password: newCompanyPassword,
                    status: companyStatus,
                    planId: selectedPlanId === 'custom' ? null : selectedPlanId,
                    modules: finalModules
                });
            }
            setIsModalOpen(false);
            refreshCompanies();
        } catch (error: any) {
            alert(getErrorMessage(error));
        } finally {
            setCreating(false);
        }
    };

    const filteredCompanies = availableCompanies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.ownerEmail?.toLowerCase().includes(search.toLowerCase())
    );

    // --- RENDER ---
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-background min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Gerenciamento de Empresas</h1>
                    <p className="text-muted-foreground mt-1">Controle detalhado de clientes, planos e módulos</p>
                </div>
                <Button onClick={openCreateModal}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Empresa
                </Button>
            </div>

            <Card className="border border-border shadow-sm bg-card">
                <div className="p-4 border-b border-border flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="border-none shadow-none focus:ring-0 w-full max-w-md bg-transparent text-foreground placeholder:text-muted-foreground"
                    />
                </div>
                <div className="divide-y divide-border">
                    {filteredCompanies.map(company => (
                        <div key={company.id} className="p-4 hover:bg-muted/30 flex items-center justify-between group transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                    {company.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">{company.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {company.adminName || 'Sem Admin'}</span>
                                        <span>•</span>
                                        <span>{company.ownerEmail}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <Badge className={
                                        company.status === 'active' ? 'bg-green-100 text-green-700' :
                                            company.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                    }>
                                        {company.status.toUpperCase()}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">{(company as any).planName || 'Plano Custom'}</p>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={() => switchCompany(company.id)} title="Acessar como Admin">
                                        <LogIn className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(company)} title="Editar Configurações">
                                        <Edit className="w-4 h-4 text-muted-foreground hover:text-blue-500" />
                                    </Button>
                                    <div className="w-px h-4 bg-border mx-1"></div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(company)} title="Excluir Empresa">
                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredCompanies.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            Nenhuma empresa encontrada.
                        </div>
                    )}
                </div>
            </Card>

            {/* Modal: Create/Edit Wizard */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? "Editar Configurações da Empresa" : "Nova Empresa"}
                width="max-w-5xl"
            >
                {/* Steps Header */}
                < div className="flex items-center border-b border-border mb-6" >
                    <button
                        onClick={() => setCurrentStep(1)}
                        className={cn("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", currentStep === 1 ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        1. Dados Básicos
                    </button>
                    <button
                        onClick={() => setCurrentStep(2)}
                        className={cn("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", currentStep === 2 ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        2. Plano e Cobrança
                    </button>
                    <button
                        onClick={() => setCurrentStep(3)}
                        className={cn("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", currentStep === 3 ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        3. Módulos e Recursos
                    </button>
                </div >

                {/* Step 1: Basic Info */}
                {
                    currentStep === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Nome da Empresa" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Ex: Acme Corp" />
                                <Input label="Admin Principal" value={newCompanyAdminName} onChange={e => setNewCompanyAdminName(e.target.value)} placeholder="Nome do responsável" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Email de Acesso" type="email" value={newCompanyOwner} onChange={e => setNewCompanyOwner(e.target.value)} disabled={!!editingId} />
                                <Input label="Senha de Acesso" type="password" value={newCompanyPassword} onChange={e => setNewCompanyPassword(e.target.value)} placeholder={editingId ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Documento (CNPJ/CPF)" value={newCompanyCnpj} onChange={e => setNewCompanyCnpj(e.target.value)} />
                                <Input label="Telefone" value={newCompanyPhone} onChange={e => setNewCompanyPhone(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Status da Conta</label>
                                <div className="flex gap-4">
                                    {['active', 'suspended', 'trial'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setCompanyStatus(s as any)}
                                            className={cn(
                                                "px-4 py-2 rounded border text-sm font-medium capitalize transition-all",
                                                companyStatus === s ? "bg-primary/10 border-primary text-primary ring-1 ring-primary" : "bg-card border-border text-muted-foreground hover:border-muted"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Step 2: Plans */}
                {
                    currentStep === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                            {loadingPlans ? <Loader /> : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Custom Option */}
                                    <div
                                        onClick={() => setSelectedPlanId('custom')}
                                        className={cn(
                                            "cursor-pointer border-2 rounded-xl p-4 transition-all relative",
                                            selectedPlanId === 'custom' ? "border-primary bg-primary/5" : "border-border hover:border-muted"
                                        )}
                                    >
                                        {selectedPlanId === 'custom' && <div className="absolute top-3 right-3 text-primary"><CheckCircle2 className="w-5 h-5" /></div>}
                                        <div className="w-10 h-10 bg-muted/50 rounded-lg flex items-center justify-center mb-3">
                                            <Edit className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <h3 className="font-bold text-foreground">Personalizado</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Definir módulos manualmente na próxima etapa.</p>
                                    </div>

                                    {/* Dynamic Plans */}
                                    {availablePlans.map(plan => (
                                        <div
                                            key={plan.id}
                                            onClick={() => setSelectedPlanId(plan.id)}
                                            className={cn(
                                                "cursor-pointer border-2 rounded-xl p-4 transition-all relative",
                                                selectedPlanId === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-muted"
                                            )}
                                        >
                                            {selectedPlanId === plan.id && <div className="absolute top-3 right-3 text-primary"><CheckCircle2 className="w-5 h-5" /></div>}
                                            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
                                                <Package className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <h3 className="font-bold text-foreground">{plan.name}</h3>
                                            <p className="text-lg font-semibold text-foreground mt-1">R$ {plan.priceMonthly}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {plan.allowedModules.slice(0, 3).map(m => (
                                                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                                                ))}
                                                {plan.allowedModules.length > 3 && <Badge variant="secondary" className="text-[10px]">+{plan.allowedModules.length - 3}</Badge>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                {/* Step 3: Modules */}
                {
                    currentStep === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                            {/* Categories Tabs */}
                            <div className="flex gap-2 pb-2 border-b border-border overflow-x-auto">
                                {['Todos', 'Core', 'Financeiro', 'Vendas', 'Analytics', 'Dev'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategoryTab(cat)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                                            activeCategoryTab === cat
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                                        )}
                                    >
                                        {cat === 'Core' ? 'Rotinas & Execução' : cat === 'Vendas' ? 'Comercial' : cat}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {SYSTEM_MODULES.filter(m => activeCategoryTab === 'Todos' || m.category === activeCategoryTab).map(module => (
                                    <div key={module.id} className={cn("border rounded-lg p-4 transition-all",
                                        moduleConfig[module.id] === 'included' ? "border-primary/50 bg-primary/5" :
                                            moduleConfig[module.id] === 'extra' ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-card"
                                    )}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                {/* Icons would go here */}
                                                <h4 className="font-semibold text-foreground">{module.name}</h4>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {/* Module Toggle */}
                                                <button
                                                    onClick={() => setModuleConfig(prev => ({
                                                        ...prev,
                                                        [module.id]: prev[module.id] === 'locked' ? 'included' : 'locked'
                                                    }))}
                                                    className={cn("p-1.5 rounded-md transition-colors",
                                                        moduleConfig[module.id] !== 'locked' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                                    )}
                                                >
                                                    {moduleConfig[module.id] !== 'locked' ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3 min-h-[40px]">{module.description}</p>

                                        {/* Features List? (Optional Granularity) */}
                                        {/* For brevity, omitting granular feature checkboxes, but logic is ready in 'selectedFeatures' state */}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }

                {/* Footer Actions */}
                <div className="flex justify-between items-center pt-6 border-t border-border mt-6">
                    <Button
                        variant="ghost"
                        onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setIsModalOpen(false)}
                        className="text-muted-foreground"
                    >
                        {currentStep > 1 ? <><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</> : "Cancelar"}
                    </Button>

                    <div className="flex gap-2">
                        {currentStep < 3 ? (
                            <Button onClick={() => setCurrentStep(currentStep + 1)}>
                                Próximo <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            <Button onClick={handleSave} loading={creating} className="bg-green-600 hover:bg-green-700">
                                <Check className="w-4 h-4 mr-2" /> Salvar Empresa
                            </Button>
                        )}
                    </div>
                </div>
            </Modal >
        </div >
    );
};