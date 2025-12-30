
import React, { useState, useEffect } from 'react';
import { Loader, Button, Input, Modal, Select, Badge, Avatar } from '../../components/Shared';
import { Search, Plus, User as UserIcon, Building2, AlertTriangle, Key, CheckCircle2 } from 'lucide-react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant, User } from '../../types';
import { useTenant } from '../../context/TenantContext';

export const SuperAdminUsers: React.FC = () => {
    const { availableTenants } = useTenant();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1); // 1: Data, 2: Success
    const [loading, setLoading] = useState(true);
    
    // Create User State
    const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', tenantId: '', role: 'user', password: '' });
    const [tempPassword, setTempPassword] = useState('');
    
    // Users Data for Display
    const [users, setUsers] = useState<(User & { companyName?: string })[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getGlobalUsers();
            setUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(search.toLowerCase()) || 
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.companyName && u.companyName.toLowerCase().includes(search.toLowerCase()))
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newUser.tenantId) return alert("Selecione a empresa para vincular o usuário.");
        if (!newUser.password || newUser.password.length < 6) return alert("Senha deve ter no mínimo 6 caracteres.");

        try {
            // Call API with targetTenantId
            await api.createUser({
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                password: newUser.password,
                role: newUser.role as any
            }, newUser.tenantId);

            setTempPassword(newUser.password);
            setCreateStep(2);
            loadData();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao criar usuário: " + getErrorMessage(error));
        }
    }

    const closeAndReset = () => {
        setIsModalOpen(false);
        setCreateStep(1);
        setNewUser({ name: '', email: '', phone: '', tenantId: '', role: 'user', password: '' });
        setTempPassword('');
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Usuários</h1>
                    <p className="text-slate-400 text-sm">Base global de usuários de todas as empresas.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Plus size={18} /> Novo Usuário
                </Button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input placeholder="Buscar usuário, email ou empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Empresa (Tenant)</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center">Nenhum usuário encontrado.</td></tr>
                        ) : filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar name={user.name} />
                                        <div>
                                            <div className="font-medium text-white">{user.name}</div>
                                            <div className="text-xs text-slate-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={14}/> {user.companyName || 'N/A'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant={user.role === 'super_admin' ? 'warning' : user.role === 'admin' ? 'success' : 'neutral'}>
                                        {user.role}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="success">Ativo</Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-500 hover:text-indigo-400 font-medium text-xs">Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Create User */}
            <Modal isOpen={isModalOpen} onClose={closeAndReset} title={createStep === 1 ? "Novo Usuário" : "Usuário Criado"}>
                {createStep === 1 ? (
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex items-start gap-3">
                            <Building2 className="text-indigo-500 shrink-0" size={18} />
                            <p className="text-xs text-indigo-200">
                                <strong>Vínculo Obrigatório:</strong> Todo usuário deve pertencer a uma empresa (Tenant). 
                                Ele só verá dados desta empresa.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Nome Completo" placeholder="Ex: Ana Clara" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required />
                            <Input label="Telefone" placeholder="(00) 00000-0000" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
                        </div>
                        <Input label="Email Corporativo" type="email" placeholder="ana@empresa.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 ml-1">Empresa Vinculada</label>
                                <Select value={newUser.tenantId} onChange={e => setNewUser({...newUser, tenantId: e.target.value})} required>
                                    <option value="">Selecione...</option>
                                    {availableTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </Select>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1 ml-1">Nível de Acesso</label>
                                <Select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                    <option value="user">Usuário Padrão</option>
                                    <option value="admin">Administrador da Empresa</option>
                                </Select>
                            </div>
                        </div>

                        <Input 
                            label="Senha Inicial" 
                            type="password" 
                            placeholder="Mínimo 6 caracteres" 
                            value={newUser.password} 
                            onChange={e => setNewUser({...newUser, password: e.target.value})} 
                            required 
                        />

                        <div className="flex justify-end pt-4 gap-2 border-t border-slate-800">
                            <Button type="button" variant="ghost" onClick={closeAndReset}>Cancelar</Button>
                            <Button type="submit">Criar Usuário</Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6 text-center py-4">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserIcon size={32} />
                        </div>
                        
                        <h3 className="text-xl font-bold text-white">Usuário Criado com Sucesso!</h3>
                        
                        <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg text-left space-y-3">
                            <div>
                                <span className="text-xs text-slate-500 uppercase block mb-1">Acesso</span>
                                <div className="text-white font-mono bg-slate-900 p-2 rounded border border-slate-800">{newUser.email}</div>
                            </div>
                            <div>
                                <span className="text-xs text-slate-500 uppercase block mb-1">Senha Provisória</span>
                                <div className="flex items-center gap-2">
                                    <div className="text-emerald-400 font-mono text-lg font-bold bg-slate-900 p-2 rounded border border-emerald-500/30 flex-1 text-center tracking-wider">
                                        {tempPassword}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2 text-left">
                            <Key className="text-amber-500 shrink-0" size={16} />
                            <p className="text-xs text-amber-200">
                                <strong>Importante:</strong> Esta senha deve ser trocada no primeiro acesso.
                            </p>
                        </div>

                        <Button onClick={closeAndReset} className="w-full">Concluir</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};
