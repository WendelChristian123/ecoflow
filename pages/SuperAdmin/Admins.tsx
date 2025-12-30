
import React, { useEffect, useState } from 'react';
import { Card, Button, Avatar, Badge, Loader } from '../../components/Shared';
import { ShieldAlert, Trash2, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';

export const SuperAdminAdmins: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [admins, setAdmins] = useState<User[]>([]);

    useEffect(() => {
        loadAdmins();
    }, []);

    const loadAdmins = async () => {
        setLoading(true);
        try {
            const allUsers = await api.getGlobalUsers();
            const superAdmins = allUsers.filter(u => u.role === 'super_admin');
            setAdmins(superAdmins);
        } catch (error) {
            console.error("Error fetching admins", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loader />;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-10 pr-2">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <ShieldCheck className="text-indigo-500" /> Gestão de Super Admins
                </h1>
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <UserPlus size={18} /> Promover Usuário
                </Button>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-4">
                <ShieldAlert size={24} className="text-rose-500 shrink-0 mt-1" />
                <div>
                    <h3 className="text-rose-400 font-bold mb-1">Acesso de Segurança Máxima</h3>
                    <p className="text-rose-200/70 text-sm">
                        Super Admins têm permissão irrestrita para visualizar, editar e excluir qualquer dado de <strong>qualquer empresa</strong> no sistema.
                        Conceda este acesso com extrema cautela.
                    </p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <h3 className="font-semibold text-slate-300">Administradores Globais Ativos</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                    {admins.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 italic">Nenhum administrador encontrado.</div>
                    ) : (
                        admins.map(admin => (
                            <div key={admin.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Avatar name={admin.name} size="lg" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-white">{admin.name}</h4>
                                            <Badge variant="warning" className="text-[10px]">MASTER</Badge>
                                        </div>
                                        <p className="text-sm text-slate-400">{admin.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button variant="ghost" className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-400" disabled title="Gestão de super admins requer acesso direto ao banco">
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
