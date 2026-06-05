import React, { useState, useEffect } from 'react';
import { Landmark, Plus, Search, Calendar as CalendarIcon, ArrowUpCircle, ArrowDownCircle, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useRBAC } from '../../context/RBACContext';
import { api } from '../../services/api';
import { Card, Select, Input, Button, Badge, cn } from '../../components/Shared';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDate } from '../../utils/formatters';
import { useAppEnvironment } from '../../context/AppEnvironmentContext';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { FilterSelect } from '../../components/FilterSelect';
import { LoanModal } from '../../components/finance/LoanModal';
import { LoanDetailsModal } from '../../components/finance/LoanDetailsModal';
import { LoansReportModal } from '../../components/Reports/LoansReportModal';

export const Loans = () => {
    const { user } = useAuth();
    const { currentCompany } = useCompany();
    const { isApp } = useAppEnvironment();
    const navigate = useNavigate();
    const { can } = useRBAC();
    const [loans, setLoans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [editingLoan, setEditingLoan] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [currentCompany?.id]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const data = await api.getLoans(currentCompany?.id);
            setLoans(data);
        } catch (error) {
            console.error('Failed to load loans:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredLoans = loans.filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              l.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || l.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const totalPayable = loans.filter(l => l.type === 'payable' && l.status === 'active').reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalReceivable = loans.filter(l => l.type === 'receivable' && l.status === 'active').reduce((acc, curr) => acc + curr.totalAmount, 0);

    // === MOBILE LAYOUT ===
    if (isApp) {
        return (
            <div className="flex-1 flex flex-col bg-background text-foreground relative pb-20">
                {/* Header Compacto */}
                <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground"><ChevronLeft size={20} /></button>
                    <h1 className="text-base font-bold text-foreground">Dívidas & Empréstimos</h1>
                    {can('finance.loans', 'create') ? <button onClick={() => setIsModalOpen(true)} className="p-2 -mr-2 text-primary"><Plus size={20} /></button> : <div className="w-8" />}
                </div>

                {/* Resumo */}
                <div className="p-4 flex gap-3 overflow-x-auto custom-scrollbar sticky top-[53px] z-10 bg-background border-b border-border">
                    <div className="min-w-[150px] flex-1 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-rose-500 uppercase mb-1">Total A Pagar</div>
                        <div className="text-lg font-black text-rose-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPayable)}</div>
                    </div>
                    <div className="min-w-[150px] flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Total A Receber</div>
                        <div className="text-lg font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivable)}</div>
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {filteredLoans.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl mx-2">Nenhuma dívida encontrada.</div>
                    ) : (
                        filteredLoans.map(loan => (
                            <div key={loan.id} className="bg-card border border-border rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer" onClick={() => { setSelectedLoan(loan); setIsDetailsOpen(true); }}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl border", loan.type === 'payable' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>
                                            {loan.type === 'payable' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-foreground leading-tight">{loan.name}</div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">{loan.contact?.name || 'Sem contato'}</div>
                                        </div>
                                    </div>
                                    <Badge variant={loan.status === 'active' ? 'warning' : 'success'} className="text-[9px] py-0 shadow-sm">{loan.status === 'active' ? 'Em Aberto' : 'Pago'}</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border/50">
                                    <div>
                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Valor Total</div>
                                        <div className="text-sm font-bold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.totalAmount)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Resta Pagar</div>
                                        <div className="text-sm font-bold text-amber-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.remainingAmount)}</div>
                                    </div>
                                </div>
                                <div className="mt-3 text-[10px] text-foreground font-medium text-center bg-secondary/50 border border-border py-1.5 rounded-lg">
                                    {loan.installmentsCount}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.installmentAmount)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <LoanModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingLoan(null); }} onSave={async () => { await loadData(); if (editingLoan) { const fresh = await api.getLoans(currentCompany?.id); const up = fresh.find((l:any) => l.id === editingLoan.id); if (up) { setSelectedLoan(up); setIsDetailsOpen(true); } } }} editingLoan={editingLoan} />
                <LoanDetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} loan={selectedLoan} onUpdate={loadData} onEdit={(l) => { setEditingLoan(l); setIsModalOpen(true); }} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2"><Landmark className="text-primary" size={20} /> Dívidas e Empréstimos</h1>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Gerencie financiamentos, empréstimos e negociações parceladas.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsReportModalOpen(true)} variant="outline" className="whitespace-nowrap h-7 px-3 text-[10px] gap-1.5">
                        <FileText size={14} />
                        Relatório
                    </Button>
                    {can('finance.loans', 'create') && (
                        <Button onClick={() => setIsModalOpen(true)} variant="primary" className="whitespace-nowrap h-7 px-3 text-[10px] gap-1.5">
                            <Plus size={14} />
                            Nova Dívida/Empréstimo
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 flex items-center gap-4 border-l-4 border-rose-500">
                    <div className="bg-rose-500/10 p-3 rounded-full text-rose-500">
                        <ArrowDownCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium uppercase">Total em Dívidas Abertas</p>
                        <h3 className="text-2xl font-bold text-foreground">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPayable)}
                        </h3>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 border-l-4 border-emerald-500">
                    <div className="bg-emerald-500/10 p-3 rounded-full text-emerald-500">
                        <ArrowUpCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium uppercase">Total em Empréstimos Abertos</p>
                        <h3 className="text-2xl font-bold text-foreground">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivable)}
                        </h3>
                    </div>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 bg-secondary/20">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input 
                            placeholder="Buscar por nome ou contato..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                        />
                    </div>
                    <FilterSelect 
                        value={typeFilter} 
                        onChange={(val) => setTypeFilter(val)}
                        options={[
                            { value: 'all', label: 'Todos os Tipos' },
                            { value: 'payable', label: 'A Pagar (Dívida)' },
                            { value: 'receivable', label: 'A Receber (Empréstimo)' }
                        ]}
                        className="w-full sm:w-64"
                    />
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                            <tr>
                                <th className="px-4 py-3 font-medium">Contrato</th>
                                <th className="px-4 py-3 font-medium">Parte</th>
                                <th className="px-4 py-3 font-medium">Parcelas</th>
                                <th className="px-4 py-3 font-medium text-right">Valor Capital</th>
                                <th className="px-4 py-3 font-medium text-right">Valor Total (c/ Juros e Desc.)</th>
                                <th className="px-4 py-3 font-medium text-right">Resta Pagar</th>
                                <th className="px-4 py-3 font-medium text-center">Início</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                        <div className="flex justify-center mt-4 tracking-wider text-xs font-bold uppercase animate-pulse">Carregando...</div>
                                    </td>
                                </tr>
                            ) : filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                        Nenhuma dívida ou empréstimo encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredLoans.map((loan) => (
                                    <tr 
                                        key={loan.id} 
                                        onClick={() => {
                                            setSelectedLoan(loan);
                                            setIsDetailsOpen(true);
                                        }}
                                        className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${loan.type === 'payable' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                    {loan.type === 'payable' ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground">{loan.name}</p>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === 'active' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                        {loan.status === 'active' ? 'EM ABERTO' : 'PAGO'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground">
                                            {loan.contact?.name || 'Não informado'}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1 font-medium">
                                                <FileText size={14} className="text-muted-foreground" />
                                                {loan.installmentsCount}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.installmentAmount)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.principalAmount)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-foreground">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.totalAmount)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-amber-500">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.remainingAmount)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-muted-foreground">
                                            {formatDate(loan.firstDueDate, 'dd/MM/yyyy')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <LoanModal 
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingLoan(null); }}
                onSave={async () => {
                    await loadData();
                    // If we were editing, reopen the details modal with fresh data
                    if (editingLoan) {
                        const freshLoans = await api.getLoans(currentCompany?.id);
                        const updated = freshLoans.find((l: any) => l.id === editingLoan.id);
                        if (updated) {
                            setSelectedLoan(updated);
                            setIsDetailsOpen(true);
                        }
                    }
                }}
                editingLoan={editingLoan}
            />

            <LoanDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                loan={selectedLoan}
                onUpdate={loadData}
                onEdit={(loan) => {
                    setEditingLoan(loan);
                    setIsModalOpen(true);
                }}
            />

            <LoansReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                loans={filteredLoans}
            />
        </div>
    );
};
