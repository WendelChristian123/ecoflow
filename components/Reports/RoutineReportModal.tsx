import React, { useState, useMemo } from 'react';
import { Task, Project, User } from '../../types';
import { Button, Badge, Avatar } from '../Shared';
import { FilterSelect } from '../FilterSelect';
import { X, Printer, FileText } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isBefore, isValid } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '../DateRangePicker';

interface RoutineReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    projects: Project[];
    users: User[];
}

export const RoutineReportModal: React.FC<RoutineReportModalProps> = ({ isOpen, onClose, tasks, projects, users }) => {
    if (!isOpen) return null;

    // Default to current month
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
        to: endOfDay(new Date())
    });
    const [selectedAssignee, setSelectedAssignee] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');

    // Filter Logic
    const filteredData = useMemo(() => {
        return tasks.filter(t => {
            const tDate = parseISO(t.dueDate);
            if (!isValid(tDate)) return false;

            // Date Range
            if (!dateRange?.from || !dateRange?.to) return false;

            const start = startOfDay(dateRange.from);
            const end = endOfDay(dateRange.to);
            const inRange = isWithinInterval(tDate, { start, end });

            // Assignee
            const assigneeMatch = selectedAssignee === 'all' || t.assigneeId === selectedAssignee;

            // Status
            let statusMatch = true;
            const isDone = t.status === 'done';
            const isLate = !isDone && isBefore(tDate, startOfDay(new Date()));

            if (selectedStatus === 'pending') statusMatch = t.status === 'todo';
            else if (selectedStatus === 'in_progress') statusMatch = t.status === 'in_progress' || t.status === 'review';
            else if (selectedStatus === 'done') statusMatch = isDone;
            else if (selectedStatus === 'late') statusMatch = isLate;
            else if (selectedStatus === 'all') statusMatch = true;

            return inRange && assigneeMatch && statusMatch;
        }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [tasks, dateRange, selectedAssignee, selectedStatus]);

    // Summary Metrics
    const total = filteredData.length;
    const done = filteredData.filter(t => t.status === 'done').length;
    const late = filteredData.filter(t => t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfDay(new Date()))).length;
    const pending = total - done; // simplified "not done"

    const getUser = (id: string) => users.find(u => u.id === id);
    const getProject = (id?: string) => projects.find(p => p.id === id);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = dateRange?.from && dateRange?.to
            ? `${format(dateRange.from, 'dd/MM/yyyy')} até ${format(dateRange.to, 'dd/MM/yyyy')}`
            : 'Período inválido';

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Rotinas - EcoFlow</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                    h1 { color: #0f172a; font-size: 24px; margin-bottom: 10px; }
                    .header { margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
                    .meta { color: #64748b; font-size: 14px; margin-bottom: 5px; }
                    
                    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
                    .card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .card-title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
                    .card-value { font-size: 24px; font-weight: 700; color: #0f172a; margin-top: 5px; }
                    .card.green .card-value { color: #10b981; }
                    .card.red .card-value { color: #ef4444; }
                    .card.blue .card-value { color: #3b82f6; }

                    table { w-full; width: 100%; border-collapse: collapse; font-size: 12px; }
                    th { text-align: left; padding: 10px; background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                    tr:nth-child(even) { background: #f8fafc; }
                    
                    .badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-block; }
                    .badge-done { background: #dcfce7; color: #166534; }
                    .badge-late { background: #fee2e2; color: #991b1b; }
                    .badge-todo { background: #f1f5f9; color: #475569; }
                    .badge-progress { background: #dbeafe; color: #1e40af; }
                    .badge-urgent { background: #fecaca; color: #991b1b; }

                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Rotinas e Execução</h1>
                    <div class="meta"><strong>Período:</strong> ${dateStr}</div>
                    <div class="meta"><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                    ${selectedAssignee !== 'all' ? `<div class="meta"><strong>Responsável:</strong> ${getUser(selectedAssignee)?.name}</div>` : ''}
                </div>

                <div class="summary-grid">
                    <div class="card">
                        <div class="card-title">Total de Tarefas</div>
                        <div class="card-value">${total}</div>
                    </div>
                    <div class="card green">
                        <div class="card-title">Concluídas</div>
                        <div class="card-value">${done}</div>
                    </div>
                    <div class="card blue">
                        <div class="card-title">Pendentes</div>
                        <div class="card-value">${pending}</div>
                    </div>
                    <div class="card red">
                        <div class="card-title">Atrasadas</div>
                        <div class="card-value">${late}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Tarefa</th>
                            <th>Projeto</th>
                            <th>Responsável</th>
                            <th>Prioridade</th>
                            <th>Prazo</th>
                            <th>Conclusão</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(t => {
            const p = getProject(t.projectId);
            const u = getUser(t.assigneeId);
            const isLt = t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfDay(new Date()));

            let stLabel = 'Pendente';
            let stClass = 'badge-todo';
            if (t.status === 'done') { stLabel = 'Concluída'; stClass = 'badge-done'; }
            else if (t.status === 'in_progress') { stLabel = 'Em Andamento'; stClass = 'badge-progress'; }
            else if (isLt) { stLabel = 'Atrasada'; stClass = 'badge-late'; }

            return `
                                <tr>
                                    <td>
                                        <strong>${t.title}</strong>
                                    </td>
                                    <td>${p?.name || '-'}</td>
                                    <td>${u?.name || '-'}</td>
                                    <td>
                                        <span class="badge ${t.priority === 'urgent' ? 'badge-urgent' : 'badge-todo'}">
                                            ${t.priority === 'urgent' ? 'URGENTE' : t.priority.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>${format(parseISO(t.dueDate), 'dd/MM/yyyy')}</td>
                                    <td>${t.completedAt ? format(parseISO(t.completedAt), 'dd/MM/yyyy HH:mm') : '-'}</td>
                                    <td><span class="badge ${stClass}">${stLabel}</span></td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = () => { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-[95vw] lg:max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="text-emerald-500" /> Relatório de Rotinas
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Gere relatórios detalhados para análise e impressão.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="flex flex-col gap-2">
                            <DateRangePicker
                                date={dateRange}
                                setDate={setDateRange}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <FilterSelect
                                inlineLabel="Resp:"
                                value={selectedAssignee}
                                onChange={setSelectedAssignee}
                                options={[
                                    { value: 'all', label: 'Todos' },
                                    ...users.map(u => ({ value: u.id, label: u.name }))
                                ]}
                                darkMode={true}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <FilterSelect
                                inlineLabel="Status:"
                                value={selectedStatus}
                                onChange={setSelectedStatus}
                                options={[
                                    { value: 'all', label: 'Todos' },
                                    { value: 'active', label: 'Ativos' },
                                    { value: 'completed', label: 'Concluídos' },
                                    { value: 'late', label: 'Atrasados' }
                                ]}
                                darkMode={true}
                            />
                        </div>
                    </div>
                </div>

                {/* Content - Scrollable Area containing both KPIs and Table */}
                <div className="flex-1 overflow-auto bg-slate-900/30">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div className="text-xs text-slate-500 font-bold uppercase">Total Tarefas</div>
                            <div className="text-2xl font-bold text-white mt-1">{total}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                            <div className="text-xs text-emerald-400 font-bold uppercase">Concluídas</div>
                            <div className="text-2xl font-bold text-emerald-500 mt-1">{done}</div>
                        </div>
                        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                            <div className="text-xs text-blue-400 font-bold uppercase">Pendentes</div>
                            <div className="text-2xl font-bold text-blue-500 mt-1">{pending}</div>
                        </div>
                        <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                            <div className="text-xs text-rose-400 font-bold uppercase">Atrasadas</div>
                            <div className="text-2xl font-bold text-rose-500 mt-1">{late}</div>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="px-6 pb-6">
                        <div className="overflow-hidden border border-slate-800 rounded-lg shadow-sm">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10 text-xs font-bold uppercase text-slate-500 tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Tarefa</th>
                                        <th className="px-6 py-4">Projeto / Responsável</th>
                                        <th className="px-6 py-4">Prazo</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                Nenhum dado encontrado com os filtros atuais.
                                            </td>
                                        </tr>
                                    ) : filteredData.map(t => {
                                        const assignee = getUser(t.assigneeId);
                                        const project = getProject(t.projectId);
                                        const isOverdue = t.status !== 'done' && isBefore(parseISO(t.dueDate), startOfDay(new Date()));

                                        return (
                                            <tr key={t.id} className="group hover:bg-slate-800/60 transition-colors odd:bg-transparent even:bg-slate-900/40">
                                                <td className="px-6 py-4 align-top">
                                                    <div className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">{t.title}</div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge variant={t.priority === 'urgent' ? 'error' : t.priority === 'high' ? 'warning' : 'neutral'} className="text-[10px] py-0 px-2 uppercase tracking-wide">
                                                            {t.priority === 'urgent' ? 'Urgente' : t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa'}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <div className="text-slate-300 font-medium mb-1">{project?.name || '-'}</div>
                                                    {assignee && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Avatar src={assignee.avatarUrl} name={assignee.name} size="xs" />
                                                            <span className="text-xs text-slate-500">{assignee.name}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <div className={`text-sm font-bold ${isOverdue ? 'text-rose-400' : 'text-slate-300'}`}>
                                                        {format(parseISO(t.dueDate), 'dd/MM/yyyy')}
                                                    </div>
                                                    {t.completedAt && (
                                                        <div className="text-[10px] text-emerald-500 flex items-center gap-1 mt-1 font-medium bg-emerald-500/10 px-2 py-0.5 rounded w-fit">
                                                            Concluído em {format(parseISO(t.completedAt), 'dd/MM')}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right align-top">
                                                    <Badge variant={t.status === 'done' ? 'success' : isOverdue ? 'error' : 'neutral'} className="px-3 py-1 text-[10px] uppercase font-bold tracking-wide">
                                                        {t.status === 'done' ? 'Concluída' : isOverdue ? 'Atrasada' : t.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>Fechar</Button>
                    <Button className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handlePrint}>
                        <Printer size={18} /> Imprimir / Salvar PDF
                    </Button>
                </div>
            </div>
        </div>
    );
};
