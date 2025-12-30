
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { Tenant } from '../../types';
import { useRBAC } from '../../context/RBACContext';
import { useTenant } from '../../context/TenantContext';
import { Loader, Button, Input, Card, Badge } from '../../components/Shared';
import { Modal } from '../../components/Shared';
import { Building2, Plus, Search, LogIn, Calendar, Users, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SuperAdminTenants: React.FC = () => {
    const { isSuperAdmin } = useRBAC();
    const { availableTenants, refreshTenants, switchTenant, currentTenant } = useTenant();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Create Tenant Form State
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantOwner, setNewTenantOwner] = useState('');
    const [newTenantCnpj, setNewTenantCnpj] = useState('');
    const [newTenantPhone, setNewTenantPhone] = useState('');
    const [newTenantAdminName, setNewTenantAdminName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/');
        }
    }, [isSuperAdmin]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.createTenant({
                name: newTenantName,
                ownerEmail: newTenantOwner,
                cnpj: newTenantCnpj,
                phone: newTenantPhone,
                adminName: newTenantAdminName
            });
            await refreshTenants();
            setIsModalOpen(false);
            setNewTenantName('');
            setNewTenantOwner('');
            setNewTenantCnpj('');
            setNewTenantPhone('');
            setNewTenantAdminName('');
            alert('Empresa criada com sucesso!');
        } catch (error: any) {
            console.error("Erro detalhado:", error);
            alert('Erro ao criar empresa: ' + getErrorMessage(error));
        } finally {
            setCreating(false);
        }
    };

    const handleAccess = (id: string) => {
        switchTenant(id);
        navigate('/');
    };

    const filtered = availableTenants.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase()) || 
        t.ownerEmail?.toLowerCase().includes(search.toLowerCase())
    );

    if (!isSuperAdmin) return null;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-indigo-900/50 to-slate-900 border border-indigo-500/20 p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Globe className="text-indigo-400" /> Área Super Admin
                    </h1>
                    <p className="text-indigo-200/60 text-sm mt-1">Gestão global de empresas e acessos.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-400 uppercase font-bold">Empresa Atual</p>
                        <p className="text-white font-medium">{currentTenant?.name || 'Selecione...'}</p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 gap-2">
                        <Plus size={18} /> Nova Empresa
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(tenant => (
                    <Card key={tenant.id} className={`flex flex-col justify-between group transition-all hover:border-indigo-500/40 ${currentTenant?.id === tenant.id ? 'border-indigo-500 bg-indigo-500/5' : ''}`}>
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-800 rounded-lg text-slate-300">
                                    <Building2 size={24} />
                                </div>
                                <Badge variant={tenant.status === 'active' ? 'success' : 'neutral'}>
                                    {tenant.status === 'active' ? 'Ativa' : 'Inativa'}
                                </Badge>
                            </div>
                            
                            <h3 className="text-lg font-bold text-white mb-1">{tenant.name}</h3>
                            <p className="text-xs text-slate-500 mb-4">{tenant.ownerEmail || 'Sem email cadastrado'}</p>
                            
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                <Calendar size={12} /> Criada em: {new Date(tenant.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        <div className="pt-4 mt-2 border-t border-slate-700/50">
                            {currentTenant?.id === tenant.id ? (
                                <button disabled className="w-full py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm font-medium cursor-default">
                                    Selecionada
                                </button>
                            ) : (
                                <Button 
                                    variant="secondary" 
                                    className="w-full justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all"
                                    onClick={() => handleAccess(tenant.id)}
                                >
                                    <LogIn size={16} /> Acessar Painel
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Empresa (Tenant)">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200 mb-4">
                        <p>Ao criar uma empresa, o email informado será automaticamente configurado como o primeiro administrador se o usuário já existir, ou será preparado para o convite.</p>
                    </div>
                    
                    <Input 
                        label="Nome da Empresa" 
                        placeholder="Ex: Acme Corp" 
                        value={newTenantName} 
                        onChange={e => setNewTenantName(e.target.value)} 
                        required 
                    />
                    <Input 
                        label="CNPJ" 
                        placeholder="00.000.000/0001-00" 
                        value={newTenantCnpj} 
                        onChange={e => setNewTenantCnpj(e.target.value)} 
                        required 
                    />
                    <Input 
                        label="Telefone" 
                        placeholder="(00) 0000-0000" 
                        value={newTenantPhone} 
                        onChange={e => setNewTenantPhone(e.target.value)} 
                        required 
                    />
                    
                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-3">
                        <p className="text-xs text-slate-400 font-bold uppercase">Admin Principal</p>
                        <Input 
                            label="Nome do Admin" 
                            placeholder="Nome Completo" 
                            value={newTenantAdminName} 
                            onChange={e => setNewTenantAdminName(e.target.value)} 
                            required 
                        />
                        <Input 
                            label="Email de Acesso" 
                            type="email" 
                            placeholder="admin@empresa.com" 
                            value={newTenantOwner} 
                            onChange={e => setNewTenantOwner(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={creating}>{creating ? 'Criando...' : 'Criar Empresa'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
