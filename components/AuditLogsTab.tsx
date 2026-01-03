import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { Loader, Badge, Avatar } from './Shared';
import { Search, Filter, ShieldAlert, Clock, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';

export const AuditLogsTab: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<'ALL' | 'LOGIN' | 'INSERT' | 'UPDATE' | 'DELETE'>('ALL');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await api.getAuditLogs();
            setLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'LOGIN': return 'info';
            case 'LOGOUT': return 'neutral';
            case 'INSERT': return 'success';
            case 'UPDATE': return 'warning';
            case 'DELETE': return 'danger';
            default: return 'neutral';
        }
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'INSERT': return 'CRIAÇÃO';
            case 'UPDATE': return 'EDIÇÃO';
            case 'DELETE': return 'EXCLUSÃO';
            default: return action;
        }
    };

    const getModule = (tableName: string) => {
        if (!tableName) return 'SISTEMA';
        if (tableName.includes('financial') || tableName.includes('credit_cards')) return 'FINANCEIRO';
        if (tableName.includes('contacts') || tableName.includes('quotes') || tableName.includes('catalog')) return 'COMERCIAL';
        if (tableName.includes('tasks') || tableName.includes('projects') || tableName.includes('teams') || tableName.includes('calendar')) return 'ROTINAS';
        if (tableName.includes('profiles') || tableName.includes('tenants')) return 'CONFIGURAÇÕES';
        return 'SISTEMA';
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            (log.description?.toLowerCase() || '').includes(search.toLowerCase()) ||
            (log.user?.name.toLowerCase() || '').includes(search.toLowerCase()) ||
            (log.tableName?.toLowerCase() || '').includes(search.toLowerCase());

        const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

        return matchesSearch && matchesAction;
    });

    if (loading) return <Loader />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ShieldAlert size={20} className="text-indigo-500" />
                        Registro de Auditoria
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Histórico completo de segurança e atividades sensíveis no sistema.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2 focus-within:ring-1 focus-within:ring-indigo-500">
                        <Search size={14} className="text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar logs..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 w-48"
                        />
                    </div>

                    <select
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="ALL">Todas as Ações</option>
                        <option value="LOGIN">Login/Acesso</option>
                        <option value="INSERT">Criação</option>
                        <option value="UPDATE">Edição</option>
                        <option value="DELETE">Exclusão</option>
                    </select>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-3">ID Log / Data</th>
                                <th className="px-4 py-3">Usuário</th>
                                <th className="px-4 py-3">Módulo</th>
                                <th className="px-4 py-3">Ação</th>
                                <th className="px-4 py-3">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-slate-300 font-medium">
                                                {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                                            </div>
                                            <div className="text-[9px] font-mono text-slate-600 mt-0.5 selection:bg-indigo-500/30" title="ID do Log">
                                                {log.id.split('-')[0]}...
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Avatar src={log.user?.avatarUrl} name={log.user?.name || '?'} size="sm" />
                                            <div>
                                                <div className="font-medium text-white text-xs">{log.user?.name || 'Sistema/Desconhecido'}</div>
                                                <div className="text-[10px] text-slate-500">{log.user?.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                                            {getModule(log.tableName)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={getActionColor(log.action)}>
                                            {getActionLabel(log.action)}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs text-slate-300 max-w-md truncate">
                                            {log.description || '-'}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <code className="text-[10px] bg-slate-900 px-1 py-0.5 rounded text-indigo-300/80 border border-slate-700/50">
                                                {log.tableName}
                                            </code>
                                            {log.recordId && <span className="text-[10px] text-slate-600 font-mono">ID Reg: {log.recordId.split('-')[0]}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLogs.length === 0 && (
                        <div className="text-center py-10 text-slate-500 italic flex flex-col items-center gap-3">
                            <ShieldAlert size={32} className="opacity-20" />
                            <p>Nenhum registro de auditoria encontrado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
