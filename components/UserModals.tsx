import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, cn } from './Shared';
import { FilterSelect } from './FilterSelect';
import { User, UserRole, LegacyUserPermissions, Delegation } from '../types';
import { api, getErrorMessage } from '../services/api';
import { supabase } from '../services/supabase';
import { DEFAULT_USER_PERMISSIONS, MODULE_MAP, FEATURE_EXCEPTION_MAP } from '../context/RBACContext';
import { Shield, Check, X, AlertTriangle, UserCheck, Lock, CheckSquare, Square } from 'lucide-react';

// --- User Modals with Dynamic Catalog ---

import { PermissionAccordion } from './Permissions/PermissionAccordion';
import { UserPermission, Actions, AppModule, AppFeature } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user: currentUser } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'user' as UserRole
    });
    const [loading, setLoading] = useState(false);
    const [granularPermissions, setGranularPermissions] = useState<Record<string, UserPermission>>({});

    // --- Dynamic Data ---
    const [systemModules, setSystemModules] = useState<AppModule[]>([]);
    const [systemFeatures, setSystemFeatures] = useState<AppFeature[]>([]);
    const [tenantModuleStatus, setTenantModuleStatus] = useState<Record<string, any>>({});

    // We need currentCompany to know the PLAN limits
    const { currentCompany } = useCompany();

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', email: '', phone: '', password: '', role: 'user' as UserRole });
            setGranularPermissions({});
            // Only load if company is ready, otherwise the effect will re-run when it is
            if (currentCompany) loadCatalog();
        }
    }, [isOpen, currentCompany]);

    const loadCatalog = async () => {
        if (!currentCompany?.contractedModules) return;

        try {
            const { modules, features } = await api.getSystemCatalog();
            const planModules = currentCompany.contractedModules;

            // 1. Filter Modules: Only allow modules present in the Plan
            const allowedModules = modules.filter(m => {
                const sysMap = MODULE_MAP[m.id];
                const sysId = sysMap ? sysMap.sysId : m.id;
                // Allow if exact ID matches OR if implicit extra/legacy check passes (though Plan usually has system IDs)
                return planModules.includes(sysId) || planModules.includes(`${sysId}:extra`);
            });

            // 2. Filter Features
            const allowedFeatures = features.filter(f => {
                const sysMap = MODULE_MAP[f.module_id];
                const sysModId = sysMap ? sysMap.sysId : f.module_id;

                // Feature must belong to an allowed module (Base Check)
                if (!planModules.includes(sysModId) && !planModules.includes(`${sysModId}:extra`)) return false;

                // --- Granular Check Logic (Matches RBACContext checkPlanAccess) ---

                // Construct the "Plan Feature ID"
                // 1. Split ID by dot to get the subFeature (e.g. 'finance.dashboard' -> 'dashboard')
                // System features in DB are often 'module.subfeature'
                const parts = f.id.split('.');
                const subFeature = parts.length > 1 ? parts[1] : parts[0];

                // 2. Base Prefix + SubFeature
                let expectedFeatId = sysMap ? `${sysMap.featPrefix}${subFeature}` : f.id;

                // 3. Exception Map (e.g. routines.dashboard -> tasks_overview)
                // Use the FULL f.id (e.g. 'finance.dashboard') as the key
                if (FEATURE_EXCEPTION_MAP[f.id]) {
                    expectedFeatId = FEATURE_EXCEPTION_MAP[f.id];
                } else if (f.module_id === 'commercial' && subFeature === 'contracts') {
                    expectedFeatId = 'crm_contracts';
                }

                // 4. Final Granular Key in Plan (e.g. mod_tasks:tasks_overview)
                const granularKey = `${sysModId}:${expectedFeatId}`;

                // Does the plan contain ANY granular storage for this module?
                // (Check for any string starting with "mod_id:" BUT NOT "mod_id:extra")
                const hasGranularForModule = planModules.some(p => p.startsWith(`${sysModId}:`) && !p.endsWith(':extra'));

                if (hasGranularForModule) {
                    // Strict Mode: Only allow if explicitly included in the plan
                    return planModules.includes(granularKey);
                }

                // Legacy/Default Mode: If no granular features are listed for this module, allow ALL features.
                return true;
            });

            setSystemModules(allowedModules);
            setSystemFeatures(allowedFeatures);

            if (currentUser?.companyId) {
                const tm = await api.getCompanyModules(currentUser.companyId);
                setTenantModuleStatus(tm);
            }
        } catch (error) {
            console.error("Failed to load catalog", error);
        }
    };

    const handlePermissionChange = (featureId: string, action: keyof Actions, value: boolean) => {
        setGranularPermissions(prev => {
            const current = prev[featureId] || {
                company_id: currentUser?.companyId || '',
                user_id: '',
                feature_id: featureId,
                actions: { view: false, create: false, edit: false, delete: false }
            };

            const newActions = { ...current.actions, [action]: value };

            if (action === 'view' && !value) {
                newActions.create = false;
                newActions.edit = false;
                newActions.delete = false;
            }
            if (action !== 'view' && value) {
                newActions.view = true;
            }

            return {
                ...prev,
                [featureId]: { ...current, actions: newActions }
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const granularArray = Object.values(granularPermissions);

            await api.createUser({
                ...formData,
                permissions: undefined,
                granular_permissions: formData.role === 'user' ? granularArray : undefined
            });
            onSuccess();
            onClose();
            alert("Usuário criado com sucesso!");
        } catch (error: any) {
            console.error("Create User Error:", error);
            alert(`Erro ao criar usuário: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Novo Usuário">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    placeholder="Nome Completo"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                />
                <Input
                    type="email"
                    placeholder="E-mail"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                />
                <Input
                    placeholder="Telefone"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                />
                <Input
                    type="password"
                    placeholder="Senha Provisória"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                />

                <div>
                    <FilterSelect
                        inlineLabel="Tipo de Acesso:"
                        value={formData.role}
                        onChange={(val) => setFormData({ ...formData, role: val as UserRole })}
                        options={[
                            { value: 'user', label: 'Usuário Padrão' },
                            { value: 'admin', label: 'Administrador (Acesso Total)' }
                        ]}
                        className="w-full"
                    />
                </div>

                {formData.role === 'user' && (
                    <div className="bg-secondary/30 p-2 rounded-lg border border-border space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 text-foreground text-sm font-semibold border-b border-border pb-2 px-2">
                            <Shield size={14} className="text-emerald-500" />
                            Permissões Granulares
                        </div>

                        <PermissionAccordion
                            modules={systemModules}
                            features={systemFeatures}
                            permissions={granularPermissions}
                            onChange={handlePermissionChange}
                            tenantModuleStatus={tenantModuleStatus}
                        />
                    </div>
                )}

                {formData.role === 'admin' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                        <p className="text-xs text-amber-500">Administradores têm acesso irrestrito a todos os módulos.</p>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Criar Usuário</Button>
                </div>
            </form>
        </Modal>
    );
};

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: User | null;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
    const { user: currentUser } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<string>('active');
    const [role, setRole] = useState<string>('user');
    const [loading, setLoading] = useState(false);
    const [granularPermissions, setGranularPermissions] = useState<Record<string, UserPermission>>({});

    // Dynamic Data
    const [systemModules, setSystemModules] = useState<AppModule[]>([]);
    const [systemFeatures, setSystemFeatures] = useState<AppFeature[]>([]);
    const [tenantModuleStatus, setTenantModuleStatus] = useState<Record<string, any>>({});

    useEffect(() => {
        if (isOpen && user) {
            setName(user.name);
            setPhone(user.phone || '');
            setStatus(user.status || 'active');
            setRole(user.role || 'user');

            // Hydrate permissions
            const permMap: Record<string, UserPermission> = {};
            if (user.granular_permissions) {
                user.granular_permissions.forEach(p => permMap[p.feature_id] = p);
            }
            setGranularPermissions(permMap);
            loadCatalog();

        } else {
            setName('');
            setPhone('');
            setStatus('active');
            setRole('user');
            setGranularPermissions({});
        }
    }, [user, isOpen]);

    const loadCatalog = async () => {
        try {
            const { modules, features } = await api.getSystemCatalog();
            setSystemModules(modules);
            setSystemFeatures(features);

            if (currentUser?.companyId) {
                const tm = await api.getCompanyModules(currentUser.companyId);
                setTenantModuleStatus(tm);
            }
        } catch (error) {
            console.error("Failed to load catalog", error);
        }
    };

    const handlePermissionChange = (featureId: string, action: keyof Actions, value: boolean) => {
        setGranularPermissions(prev => {
            const current = prev[featureId] || {
                company_id: user?.companyId || '',
                user_id: user?.id || '',
                feature_id: featureId,
                actions: { view: false, create: false, edit: false, delete: false }
            };

            const newActions = { ...current.actions, [action]: value };

            if (action === 'view' && !value) {
                newActions.create = false;
                newActions.edit = false;
                newActions.delete = false;
            }
            if (action !== 'view' && value) {
                newActions.view = true;
            }

            return {
                ...prev,
                [featureId]: { ...current, actions: newActions }
            };
        });
    };

    const handleSubmit = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Validate: if role is user, we send updated permissions.
            // If role is admin, granular is ignored (or cleared).
            await api.adminUpdateUser(user.id, {
                name,
                phone,
                status,
                role,
                permissions: undefined,
                granular_permissions: role === 'user' ? Object.values(granularPermissions) : undefined
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert(`Erro ao atualizar usuário: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Usuário: ${user.name}`}>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar pr-2">

                {/* Basic Info Block */}
                <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Informações Básicas</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nome"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                        <Input
                            label="Telefone"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Tipo de Acesso</label>
                            <FilterSelect
                                value={role}
                                onChange={(val) => setRole(val)}
                                options={[
                                    { value: 'user', label: 'Usuário Padrão' },
                                    { value: 'admin', label: 'Administrador' }
                                ]}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Status do Acesso</label>
                            <FilterSelect
                                value={status}
                                onChange={(val) => setStatus(val)}
                                options={[
                                    { value: 'active', label: 'Ativo (Acesso Liberado)' },
                                    { value: 'suspended', label: 'Suspenso (Login Bloqueado)' },
                                    { value: 'blocked', label: 'Banido' }
                                ]}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Permissions Block */}
                {role === 'user' ? (
                    <div className="space-y-4 pt-4 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Permissões de Acesso</p>
                        <div className="bg-secondary/30 p-2 rounded-lg border border-border space-y-4">
                            <PermissionAccordion
                                modules={systemModules}
                                features={systemFeatures}
                                permissions={granularPermissions}
                                onChange={handlePermissionChange}
                                tenantModuleStatus={tenantModuleStatus}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3 mt-4">
                        <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                        <p className="text-xs text-amber-500">Administradores têm acesso irrestrito a todos os módulos.</p>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading}>Salvar Alterações</Button>
                </div>
            </div>
        </Modal>
    );
};



interface DelegationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: User[];
    initialDelegations?: Delegation[];
}

export const DelegationModal: React.FC<DelegationModalProps> = ({ isOpen, onClose, onSuccess, users, initialDelegations }) => {
    const [delegateId, setDelegateId] = useState('');
    const [permissions, setPermissions] = useState<Record<string, { view: boolean; create: boolean; edit: boolean }>>({
        tasks: { view: false, create: false, edit: false },
        agenda: { view: false, create: false, edit: false },
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDelegateId(initialDelegations?.[0]?.delegateId || '');

            const reset: Record<string, { view: boolean; create: boolean; edit: boolean }> = {
                tasks: { view: false, create: false, edit: false },
                agenda: { view: false, create: false, edit: false },
            };

            if (initialDelegations) {
                initialDelegations.forEach(del => {
                    if (del.module in reset) {
                        reset[del.module] = del.permissions;
                    }
                });
            }
            setPermissions(reset);
        }
    }, [isOpen, initialDelegations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!delegateId) return alert("Selecione um usuário.");
        setLoading(true);
        try {
            // Bulk insert/update
            const promises = Object.entries(permissions).map(async ([mod, perms]: [string, { view: boolean; create: boolean; edit: boolean }]) => {
                const hasAny = perms.view || perms.create || perms.edit;
                const existing = initialDelegations?.find(d => d.module === mod);

                if (existing) {
                    if (hasAny) {
                        await api.updateDelegation(existing.id, perms);
                    } else {
                        // Update with all false (soft revoke for that module)
                        await api.updateDelegation(existing.id, perms);
                    }
                } else if (hasAny) {
                    await api.addDelegation({
                        delegateId: delegateId,
                        module: mod as any,
                        permissions: perms
                    });
                }
            });

            await Promise.all(promises);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao salvar: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const modules = [
        { key: 'tasks', label: 'Tarefas' },
        { key: 'agenda', label: 'Agenda' },
    ];

    const togglePermission = (mod: string, type: 'view' | 'create' | 'edit') => {
        setPermissions(prev => ({
            ...prev,
            [mod]: { ...prev[mod], [type]: !prev[mod][type] }
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delegar Acesso a Seus Dados">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex items-start gap-3">
                    <UserCheck className="text-indigo-500 shrink-0" size={18} />
                    <p className="text-xs text-indigo-400">
                        Você está concedendo permissão para outro usuário visualizar ou gerenciar <b>seus</b> dados.
                        Eles não poderão excluir registros, apenas visualizar, criar ou editar conforme definido.
                    </p>
                </div>

                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quem receberá o acesso?</label>
                    <FilterSelect
                        value={delegateId}
                        onChange={(val) => setDelegateId(val)}
                        options={[
                            ...[...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => ({
                                value: u.id,
                                label: `${u.name} (${u.email})`
                            }))
                        ]}
                        placeholder="Selecione um usuário..."
                        disabled={!!initialDelegations}
                        className="w-full"
                        searchable
                    />
                </div>

                <div className="bg-secondary/30 rounded-lg border border-border p-4">
                    <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                        <Shield size={16} className="text-emerald-500" /> Permissões de Acesso
                    </h3>

                    <div className="space-y-4">
                        {modules.map(mod => (
                            <div key={mod.key} className="border-b border-border pb-4 last:border-0 last:pb-0">
                                <label className="text-sm text-muted-foreground mb-2 block">{mod.label}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => togglePermission(mod.key, 'view')}
                                        className={cn(
                                            "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                                            permissions[mod.key].view
                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                        )}
                                    >
                                        {permissions[mod.key].view ? <CheckSquare size={14} /> : <Square size={14} />}
                                        Ver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => togglePermission(mod.key, 'create')}
                                        className={cn(
                                            "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                                            permissions[mod.key].create
                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                        )}
                                    >
                                        {permissions[mod.key].create ? <CheckSquare size={14} /> : <Square size={14} />}
                                        Criar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => togglePermission(mod.key, 'edit')}
                                        className={cn(
                                            "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                                            permissions[mod.key].edit
                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                        )}
                                    >
                                        {permissions[mod.key].edit ? <CheckSquare size={14} /> : <Square size={14} />}
                                        Editar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Confirmar Delegação</Button>
                </div>
            </form>
        </Modal>
    );
};

// --- User Profile Modal ---
interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onSuccess: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [changePassword, setChangePassword] = useState(false);
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    let mounted = true;

    useEffect(() => {
        mounted = true;
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (isOpen && user) {
            setName(user.name);
            setPhone(user.phone || '');
            setChangePassword(false);
            setPasswordData({ old: '', new: '', confirm: '' });
        }
    }, [isOpen, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            await api.updateProfile(user.id, { name, phone });

            if (changePassword) {
                if (passwordData.new !== passwordData.confirm) {
                    alert("As senhas não coincidem.");
                    setLoading(false);
                    return;
                }
                if (passwordData.new.length < 6) {
                    alert("A senha deve ter pelo menos 6 caracteres.");
                    setLoading(false);
                    return;
                }
                await api.updatePassword(passwordData.new);
            }

            if (changePassword) {
                alert("Senha alterada com sucesso! Você será redirecionado para o login.");
                await supabase.auth.signOut();
                window.location.href = '/'; // Force redirect to login
                return;
            }

            alert("Perfil atualizado com sucesso!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = getErrorMessage(error);

            // If it's the "Invalid Refresh Token" error, it actually means the password changed
            // and invalidated the old session. We should treat this as success.
            // Also handle "timed out" from our manual timeout in api.ts
            if (msg.includes('Refresh Token') || (changePassword && msg.includes('timed out'))) {
                alert("Senha alterada com sucesso! Por segurança, faça login novamente.");
                onSuccess();
                onClose();
                // Force logout to clean state
                await api.adminForceLogout(user.id).catch(() => { }); // Try backend logout
                await supabase.auth.signOut();
                window.location.href = '/login';
                return;
            }

            alert(`Erro ao atualizar perfil: ${msg}`);
        } finally {
            if (mounted) setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Meu Perfil">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <Input
                        label="E-mail (Somente leitura)"
                        value={user.email}
                        disabled
                        className="opacity-60 cursor-not-allowed bg-secondary/50 border-border"
                    />
                    <div className="text-xs text-muted-foreground -mt-2 mb-2 flex items-center gap-1">
                        <Lock size={10} /> O e-mail não pode ser alterado. Contate o administrador.
                    </div>

                    <Input
                        placeholder="Nome Completo"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                    <Input
                        placeholder="Telefone"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                    />
                </div>

                <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <input
                            type="checkbox"
                            id="changePass"
                            checked={changePassword}
                            onChange={e => setChangePassword(e.target.checked)}
                            className="rounded bg-secondary border-border"
                        />
                        <label htmlFor="changePass" className="text-sm font-medium text-foreground cursor-pointer select-none">Alterar Senha</label>
                    </div>

                    {changePassword && (
                        <div className="space-y-3 bg-secondary/20 p-4 rounded-lg border border-border">
                            {/* Note: Supabase Auth client often handles 'update user' without old password if logged in, but for good UX we just ask for new. */}
                            <Input
                                type="password"
                                placeholder="Nova Senha"
                                value={passwordData.new}
                                onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                required={changePassword}
                            />
                            <Input
                                type="password"
                                placeholder="Confirmar Nova Senha"
                                value={passwordData.confirm}
                                onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                required={changePassword}
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>Salvar Alterações</Button>
                </div>
            </form>
        </Modal>
    );
};

// --- Helpers Components ---

const PermissionToggleGroup: React.FC<{
    label: string;
    values: { view: boolean; create: boolean; edit: boolean };
    onChange: (vals: { view: boolean; create: boolean; edit: boolean }) => void;
}> = ({ label, values, onChange }) => {
    return (
        <div className="space-y-2 border-b border-border pb-3 last:border-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <div className="grid grid-cols-3 gap-2">
                <Toggle checked={values.view} onChange={v => onChange({ ...values, view: v })} label="Ver" />
                <Toggle checked={values.create} onChange={v => onChange({ ...values, create: v })} label="Criar" />
                <Toggle checked={values.edit} onChange={v => onChange({ ...values, edit: v })} label="Editar" />
            </div>
        </div>
    );
};

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-all ${checked
            ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
            : 'bg-secondary/50 text-muted-foreground border-border'
            }`}
    >
        {checked ? <Check size={12} /> : <X size={12} />}
        {label}
    </button>
);
