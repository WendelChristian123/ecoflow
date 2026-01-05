import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { Loader, Badge, Avatar } from './Shared';
import { Search, Filter, ShieldAlert, Clock, User as UserIcon, Calendar, X, ExternalLink, ChevronRight, History, FileText } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const AuditLogsTab: React.FC = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters State
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<'ALL' | 'CRITICAL' | 'LOGIN' | 'INSERT' | 'UPDATE' | 'DELETE'>('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedUser, setSelectedUser] = useState('ALL');
    const [selectedModule, setSelectedModule] = useState('ALL');

    // Audit Detail Modal State
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [selectedRecordModule, setSelectedRecordModule] = useState<string>('');

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

    // --- Helpers ---

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
            case 'LOGIN': return 'ACESSO';
            case 'LOGOUT': return 'SAÍDA';
            default: return action;
        }
    };

    const getFriendlyTableName = (tableName: string) => {
        if (!tableName) return 'Sistema';
        if (tableName.includes('financial') || tableName.includes('credit_cards')) return 'Financeiro';
        if (tableName.includes('tasks')) return 'Tarefas';
        if (tableName.includes('calendar')) return 'Agenda';
        if (tableName.includes('profiles')) return 'Usuários';
        if (tableName.includes('delegations')) return 'Delegação';
        if (tableName.includes('projects')) return 'Projetos';
        if (tableName.includes('teams')) return 'Equipes';
        if (tableName.includes('quotes')) return 'Comercial';
        if (tableName === 'auth') return 'Segurança';
        return tableName;
    };

    const getModule = (tableName: string) => {
        if (!tableName) return 'SISTEMA';
        if (tableName.includes('financial') || tableName.includes('credit_cards')) return 'FINANCEIRO';
        if (tableName.includes('contacts') || tableName.includes('quotes') || tableName.includes('catalog')) return 'COMERCIAL';
        if (tableName.includes('tasks') || tableName.includes('projects') || tableName.includes('teams') || tableName.includes('calendar')) return 'ROTINAS';
        if (tableName.includes('profiles') || tableName.includes('tenants') || tableName.includes('delegations')) return 'CONFIGURAÇÕES';
        if (tableName === 'auth') return 'ACESSO & SEGURANÇA';
        return 'SISTEMA';
    };

    // Calculate Unique Users and Modules for Filters
    const uniqueUsers = Array.from(new Set(logs.map(l => l.user?.name || 'Sistema'))).sort();
    const uniqueModules = Array.from(new Set(logs.map(l => getModule(l.tableName)))).sort();

    // --- Filtering Logic ---

    const filteredLogs = logs.filter(log => {
        // 1. Search (Including Record ID)
        const searchLower = search.toLowerCase();
        const searchClean = searchLower.replace('#', ''); // Allow searching with or without #

        const friendlyRef = getFriendlyTableName(log.tableName).toLowerCase();
        const recordIdClean = log.recordId ? log.recordId.replace(/-/g, '') : '';

        const matchesSearch =
            (log.description?.toLowerCase() || '').includes(searchLower) ||
            (log.user?.name.toLowerCase() || '').includes(searchLower) ||
            (log.tableName?.toLowerCase() || '').includes(searchLower) ||
            friendlyRef.includes(searchLower) ||
            (log.recordId || '').toLowerCase().includes(searchClean) ||
            recordIdClean.includes(searchClean);

        if (!matchesSearch) return false;

        // 2. Action Filter
        if (actionFilter === 'CRITICAL') {
            const isFinance = log.tableName.includes('financial');
            const isDelete = log.action === 'DELETE';
            const isPermission = log.tableName === 'profiles' && log.action === 'UPDATE';
            if (!(isFinance || isDelete || isPermission)) return false;
        } else if (actionFilter !== 'ALL') {
            if (log.action !== actionFilter) return false;
        }

        // 3. User Filter
        if (selectedUser !== 'ALL') {
            const logUserName = log.user?.name || 'Sistema';
            if (logUserName !== selectedUser) return false;
        }

        // 4. Module Filter
        if (selectedModule !== 'ALL') {
            if (getModule(log.tableName) !== selectedModule) return false;
        }

        // 5. Date Filter
        if (dateFrom || dateTo) {
            const logDate = new Date(log.createdAt);
            if (dateFrom) {
                const startDate = startOfDay(parseISO(dateFrom));
                if (logDate < startDate) return false;
            }
            if (dateTo) {
                const endDate = endOfDay(parseISO(dateTo));
                if (logDate > endDate) return false;
            }
        }

        return true;
    });

    // --- Navigation Logic ---
    const handleNavigate = (tableName: string, recordId?: string) => {
        const module = getFriendlyTableName(tableName);
        switch (module) {
            case 'Financeiro': navigate(`/finance/transactions?transactionId=${recordId}`); break;
            case 'Tarefas': navigate('/tasks'); break;
            case 'Agenda': navigate('/agenda'); break;
            case 'Projetos': navigate(recordId ? `/projects/${recordId}` : '/projects'); break; // Support direct project link
            case 'Equipes': navigate('/teams'); break;
            case 'Comercial': navigate('/commercial/quotes'); break; // Defaulting to quotes if generic commercial
            case 'Usuários': navigate('/settings'); break;
            default: break;
        }
    };

    // --- Detail Modal Logic ---
    const recordHistory = selectedRecordId
        ? logs.filter(l => l.recordId === selectedRecordId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                {/* Header */}
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ShieldAlert size={20} className="text-indigo-500" />
                        Registro de Auditoria
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Histórico completo de segurança e atividades sensíveis no sistema.
                    </p>
                </div>

                {/* Filters Bar */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col lg:flex-row gap-4 items-center justify-between">

                    {/* Search */}
                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2 focus-within:ring-1 focus-within:ring-indigo-500 w-full lg:w-64">
                        <Search size={14} className="text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar logs, ref..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 w-full"
                        />
                    </div>

                    {/* Filter Controls Group */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">

                        {/* Improved Date Filter */}
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 gap-3 group focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                            <Calendar size={14} className="text-slate-500 group-focus-within:text-indigo-500" />
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="bg-transparent text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:invert w-24 cursor-pointer"
                                    placeholder="Início"
                                />
                                <span className="text-slate-600 text-[10px] uppercase font-bold">Até</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="bg-transparent text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:invert w-24 cursor-pointer"
                                    placeholder="Fim"
                                />
                            </div>
                        </div>

                        {/* User Select */}
                        <div className="relative">
                            <select
                                value={selectedUser}
                                onChange={e => setSelectedUser(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none min-w-[120px] cursor-pointer"
                            >
                                <option value="ALL">Todos Usuários</option>
                                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <UserIcon size={12} className="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Module Select */}
                        <select
                            value={selectedModule}
                            onChange={e => setSelectedModule(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                        >
                            <option value="ALL">Todos Módulos</option>
                            {uniqueModules.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>

                        {/* Action Select */}
                        <select
                            value={actionFilter}
                            onChange={e => setActionFilter(e.target.value as any)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none font-medium cursor-pointer"
                        >
                            <option value="ALL">Todas as Ações</option>
                            <option value="CRITICAL">⚠️ Críticas</option>
                            <option value="LOGIN">Acessos</option>
                            <option value="INSERT">Criação</option>
                            <option value="UPDATE">Edição</option>
                            <option value="DELETE">Exclusão</option>
                        </select>

                        {/* Clear Filters Button */}
                        {(search || dateFrom || dateTo || selectedUser !== 'ALL' || selectedModule !== 'ALL' || actionFilter !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setSearch('');
                                    setDateFrom('');
                                    setDateTo('');
                                    setSelectedUser('ALL');
                                    setSelectedModule('ALL');
                                    setActionFilter('ALL');
                                }}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Limpar Filtros"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden shadow-lg">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-semibold sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3">Data / ID</th>
                                <th className="px-4 py-3">Usuário</th>
                                <th className="px-4 py-3">Módulo</th>
                                <th className="px-4 py-3">Ação</th>
                                <th className="px-4 py-3">Descrição Detalhada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredLogs.map(log => (
                                <tr
                                    key={log.id}
                                    className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                                    onClick={() => {
                                        if (log.recordId) {
                                            setSelectedRecordId(log.recordId);
                                            setSelectedRecordModule(log.tableName);
                                        }
                                    }}
                                >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-slate-300 font-medium group-hover:text-indigo-400 transition-colors">
                                                {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                                            </div>
                                            <div className="text-[9px] font-mono text-slate-600 mt-0.5" title="ID Imutável">
                                                {log.id.split('-')[0]}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Avatar src={log.user?.avatarUrl} name={log.user?.name || '?'} size="sm" />
                                            <div>
                                                <div className="font-medium text-white text-xs whitespace-nowrap">{log.user?.name || 'Sistema'}</div>
                                                <div className="text-[10px] text-slate-500">{log.user?.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[10px] font-bold tracking-wider text-slate-400 bg-slate-900/50 px-2 py-1 rounded border border-slate-800 uppercase whitespace-nowrap">
                                            {getModule(log.tableName)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={getActionColor(log.action)}>
                                            {getActionLabel(log.action)}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 w-full">
                                        <div className="text-sm text-slate-200 leading-relaxed break-words">
                                            {log.description || '-'}
                                        </div>
                                        {/* Friendly Ref Name displayed here */}
                                        {log.recordId && (
                                            <div className="text-[10px] text-slate-600 mt-1 font-mono flex items-center gap-1 group-hover:opacity-100 transition-opacity">
                                                <span className='opacity-70'>Ref:</span>
                                                <span className='text-slate-500'>{getFriendlyTableName(log.tableName)}</span>
                                                <span className='opacity-50'>#{log.recordId.split('-')[0]}</span>
                                                <ChevronRight size={10} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLogs.length === 0 && (
                        <div className="text-center py-20 text-slate-500 italic flex flex-col items-center gap-3">
                            <div className="bg-slate-800/50 p-4 rounded-full">
                                <Search size={24} className="opacity-50" />
                            </div>
                            <p>Nenhum registro encontrado para estes filtros.</p>
                            <button
                                onClick={() => {
                                    setSearch('');
                                    setDateFrom('');
                                    setDateTo('');
                                    setSelectedUser('ALL');
                                    setSelectedModule('ALL');
                                    setActionFilter('ALL');
                                }}
                                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center text-[10px] text-slate-600">
                Exibindo últimos {logs.length} registros. Para auditoria profunda, exporte os dados.
            </div>

            {/* RECORD DETAIL MODAL */}
            {selectedRecordId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                                    <History size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Histórico do Registro</h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                        <span>#{selectedRecordId}</span>
                                        <span className="w-1 h-1 bg-slate-600 rounded-full" />
                                        <span className="uppercase">{getFriendlyTableName(selectedRecordModule)}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedRecordId(null)}
                                className="text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Scroll */}
                        <div className="overflow-y-auto p-4 space-y-6 flex-1">
                            {/* Redirect Button */}
                            <div className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between border border-slate-700">
                                <div className="text-sm text-slate-300">
                                    Deseja visualizar o registro original no módulo?
                                </div>
                                <button
                                    onClick={() => handleNavigate(selectedRecordModule, selectedRecordId)}
                                    className="flex items-center gap-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors"
                                >
                                    Ir para {getFriendlyTableName(selectedRecordModule)}
                                    <ExternalLink size={12} />
                                </button>
                            </div>

                            {/* Timeline */}
                            <div className="relative pl-4 space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                                {recordHistory.map((item, idx) => (
                                    <div key={item.id} className="relative flex gap-4 animate-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms` }}>
                                        {/* Dot */}
                                        <div className={`
                                            relative z-10 w-3 h-3 rounded-full border-2 mt-1.5 shrink-0
                                            ${item.action === 'DELETE' ? 'bg-slate-900 border-rose-500' :
                                                item.action === 'INSERT' ? 'bg-slate-900 border-emerald-500' :
                                                    'bg-indigo-500 border-indigo-500'}
                                        `}>
                                            {idx === 0 && <div className="absolute inset-0 bg-current animate-ping opacity-75 rounded-full" />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 space-y-2 pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="font-medium text-slate-200 text-sm">
                                                    {item.description}
                                                </div>
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">
                                                    {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Avatar src={item.user?.avatarUrl} name={item.user?.name || '?'} size="sm" />
                                                <div className="text-xs text-slate-400">
                                                    <span className="text-white font-medium">{item.user?.name}</span>
                                                    {' • '}
                                                    <span className="uppercase text-[10px] text-slate-500">{getActionLabel(item.action)}</span>
                                                </div>
                                            </div>

                                            {/* Technical Details (JSON Diffs or raw data can be toggled here if needed) */}
                                            {/* For now, just simplistic view based on description */}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-slate-900 border-t border-slate-700 text-center">
                            <span className="text-[10px] text-slate-600">Fim do histórico</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
