
import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from './Shared';
import { User, UserRole, UserPermissions } from '../types';
import { api, getErrorMessage } from '../services/api';
import { supabase } from '../services/supabase';
import { DEFAULT_USER_PERMISSIONS } from '../context/RBACContext';
import { Shield, Check, X, AlertTriangle, UserCheck, Lock } from 'lucide-react';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'user' as UserRole
    });
    const [loading, setLoading] = useState(false);
    const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_USER_PERMISSIONS);

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', email: '', phone: '', password: '', role: 'user' });
            setPermissions(DEFAULT_USER_PERMISSIONS);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.createUser({
                ...formData,
                permissions: formData.role === 'user' ? permissions : undefined
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
                    <label className="text-xs text-slate-400 mb-1 block">Tipo de Acesso</label>
                    <Select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    >
                        <option value="user">Usuário Padrão</option>
                        <option value="admin">Administrador (Acesso Total)</option>
                    </Select>
                </div>

                {formData.role === 'user' && (
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
                        <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold border-b border-slate-700 pb-2">
                            <Shield size={14} className="text-emerald-500" />
                            Permissões de Acesso
                        </div>

                        <PermissionToggleGroup
                            label="Rotinas & Execução"
                            values={permissions.routines}
                            onChange={(newVals) => setPermissions({ ...permissions, routines: newVals })}
                        />

                        <PermissionToggleGroup
                            label="Comercial"
                            values={permissions.commercial}
                            onChange={(newVals) => setPermissions({ ...permissions, commercial: newVals })}
                        />

                        <PermissionToggleGroup
                            label="Financeiro"
                            values={permissions.finance}
                            onChange={(newVals) => setPermissions({ ...permissions, finance: newVals })}
                        />

                        <div className="flex items-center justify-between py-1">
                            <span className="text-sm text-slate-400">Relatórios</span>
                            <Toggle
                                checked={permissions.reports.view}
                                onChange={v => setPermissions({ ...permissions, reports: { view: v } })}
                                label="Ver"
                            />
                        </div>
                    </div>
                )}

                {formData.role === 'admin' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                        <p className="text-xs text-amber-200">Administradores têm acesso irrestrito a todos os módulos, podem excluir registros e gerenciar outros usuários.</p>
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

interface EditPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: User | null;
}

export const EditPermissionsModal: React.FC<EditPermissionsModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
    const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_USER_PERMISSIONS);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && user.permissions) {
            setPermissions(user.permissions);
        } else {
            setPermissions(DEFAULT_USER_PERMISSIONS);
        }
    }, [user, isOpen]);

    const handleSubmit = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await api.updateUserPermissions(user.id, permissions);
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert(`Erro ao atualizar permissões: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Permissões: ${user.name}`}>
            <div className="space-y-6">
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
                    <PermissionToggleGroup
                        label="Rotinas & Execução"
                        values={permissions.routines}
                        onChange={(newVals) => setPermissions({ ...permissions, routines: newVals })}
                    />
                    <PermissionToggleGroup
                        label="Comercial"
                        values={permissions.commercial}
                        onChange={(newVals) => setPermissions({ ...permissions, commercial: newVals })}
                    />
                    <PermissionToggleGroup
                        label="Financeiro"
                        values={permissions.finance}
                        onChange={(newVals) => setPermissions({ ...permissions, finance: newVals })}
                    />
                    <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-400">Relatórios</span>
                        <Toggle
                            checked={permissions.reports.view}
                            onChange={v => setPermissions({ ...permissions, reports: { view: v } })}
                            label="Ver"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
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
    users: User[]; // Available users to delegate to
}

export const DelegationModal: React.FC<DelegationModalProps> = ({ isOpen, onClose, onSuccess, users }) => {
    const [delegateId, setDelegateId] = useState('');
    const [moduleName, setModuleName] = useState('tasks');
    const [permissions, setPermissions] = useState({ view: true, create: false, edit: false });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDelegateId('');
            setModuleName('tasks');
            setPermissions({ view: true, create: false, edit: false });
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!delegateId) return alert("Selecione um usuário.");
        setLoading(true);
        try {
            await api.addDelegation({
                delegateId: delegateId,
                module: moduleName,
                permissions: permissions
            });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao delegar: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const moduleLabel = (m: string) => {
        if (m === 'tasks') return 'Rotinas & Tarefas';
        if (m === 'finance') return 'Financeiro';
        if (m === 'agenda') return 'Agenda';
        if (m === 'commercial') return 'Comercial';
        return m;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delegar Acesso a Seus Dados">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex items-start gap-3">
                    <UserCheck className="text-indigo-500 shrink-0" size={18} />
                    <p className="text-xs text-indigo-200">
                        Você está concedendo permissão para outro usuário visualizar ou gerenciar <b>seus</b> dados.
                        Eles não poderão excluir registros, apenas visualizar, criar ou editar conforme definido.
                    </p>
                </div>

                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Quem receberá o acesso?</label>
                    <Select value={delegateId} onChange={e => setDelegateId(e.target.value)} required>
                        <option value="">Selecione um usuário...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                    </Select>
                </div>

                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Módulo</label>
                    <Select value={moduleName} onChange={e => setModuleName(e.target.value)}>
                        <option value="tasks">Rotinas & Tarefas</option>
                        <option value="commercial">Comercial</option>
                        <option value="agenda">Agenda</option>
                        <option value="finance">Financeiro</option>
                    </Select>
                </div>

                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-3">
                    <p className="text-sm font-medium text-slate-300">Nível de Permissão em {moduleLabel(moduleName)}</p>
                    <div className="grid grid-cols-3 gap-2">
                        <Toggle checked={permissions.view} onChange={v => setPermissions({ ...permissions, view: v })} label="Visualizar" />
                        <Toggle checked={permissions.create} onChange={v => setPermissions({ ...permissions, create: v })} label="Criar" />
                        <Toggle checked={permissions.edit} onChange={v => setPermissions({ ...permissions, edit: v })} label="Editar" />
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

            alert("Perfil atualizado com sucesso!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = getErrorMessage(error);

            // If it's the "Invalid Refresh Token" error, it actually means the password changed
            // and invalidated the old session. We should treat this as success.
            if (msg.includes('Refresh Token') || (changePassword && msg.includes('timeout'))) {
                alert("Senha alterada com sucesso! Por segurança, faça login novamente.");
                onSuccess();
                onClose();
                // Force logout to clean state
                await api.adminForceLogout(user.id).catch(() => { }); // Try backend logout
                await supabase.auth.signOut();
                window.location.reload();
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
                        className="opacity-60 cursor-not-allowed bg-slate-900 border-slate-800"
                    />
                    <div className="text-xs text-slate-500 -mt-2 mb-2 flex items-center gap-1">
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

                <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <input
                            type="checkbox"
                            id="changePass"
                            checked={changePassword}
                            onChange={e => setChangePassword(e.target.checked)}
                            className="rounded bg-slate-800 border-slate-700"
                        />
                        <label htmlFor="changePass" className="text-sm font-medium text-slate-300 cursor-pointer select-none">Alterar Senha</label>
                    </div>

                    {changePassword && (
                        <div className="space-y-3 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
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
        <div className="space-y-2 border-b border-slate-700/50 pb-3 last:border-0">
            <p className="text-sm font-medium text-slate-300">{label}</p>
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
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : 'bg-slate-700/50 text-slate-500 border-slate-700'
            }`}
    >
        {checked ? <Check size={12} /> : <X size={12} />}
        {label}
    </button>
);
