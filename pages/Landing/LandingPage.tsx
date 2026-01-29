import React, { useState } from 'react';
import { PublicLayout } from '../../components/PublicLayout';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Button, Card, cn } from '../../components/Shared';
import { LandingPricing } from '../../components/LandingPricing';
import { Link, useNavigate } from 'react-router-dom';
import {
    CheckCircle2, XCircle, ChevronRight, BarChart2, ShieldCheck, Zap,
    LayoutDashboard, Clock, Users, ArrowRight, TrendingUp, DollarSign,
    Briefcase, Lock, HelpCircle, ChevronDown, Check
} from 'lucide-react';

const FeatureTabs: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'commercial' | 'routines' | 'finance'>('commercial');

    const features = {
        commercial: {
            title: "Módulo Comercial (Vendas / CRM)",
            headline: <>Controle total <br /> de <span className="text-purple-400">vendas</span> com <br /> ferramentas <br /> integradas e <br /> inteligentes.</>,
            desc: "Centralize sua operação comercial, otimize processos e aumente a produtividade da sua equipe com nosso painel intuitivo.",
            color: "text-purple-400",
            borderColor: "border-purple-500",
            bgHover: "hover:bg-purple-500/10",
            icon: <Briefcase size={20} />,
            items: [
                { title: "Visão Geral", desc: "Painel com visão completa do funil comercial (leads, oportunidades, propostas e contratos). Monitora KPIs em tempo real." },
                { title: "Contatos", desc: "Cadastro completo de leads e clientes, histórico de interações e associação com propostas, contratos e tarefas agendadas." },
                { title: "Orçamentos", desc: "Criação e gestão de propostas comerciais, controle de valores, status (aberto, enviado, aprovado, perdido) e vínculo com contatos." },
                { title: "Contratos", desc: "Gestão de contratos ativos e encerrados, controle de datas, valores, status e associação com clientes e orçamentos aprovados." },
                { title: "Catálogo", desc: "Cadastro de produtos e serviços, organização por categorias, controle de preços, estoque e especificações técnicas detalhadas." }
            ]
        },
        routines: {
            title: "Módulo Rotinas & Execução",
            headline: <>Controle total <br /> de <span className="text-cyan-400">tarefas</span> com <br /> ferramentas <br /> integradas e <br /> inteligentes.</>,
            desc: "Organize o dia a dia da sua equipe, defina prioridades e garanta que nada seja esquecido ou entregue com atraso.",
            color: "text-cyan-400",
            borderColor: "border-cyan-500",
            bgHover: "hover:bg-cyan-500/10",
            icon: <Clock size={20} />,
            items: [
                { title: "Visão Geral", desc: "Painel operacional com tarefas pendentes, projetos ativos, responsáveis e prazos. Acompanhamento visual do progresso." },
                { title: "Tarefas", desc: "Criação de tarefas individuais ou recorrentes, definição de responsáveis, status, datas, prioridades e vínculo com projetos." },
                { title: "Projetos", desc: "Organização de tarefas por projeto, acompanhamento de progresso e visão clara da execução de cada etapa do trabalho." },
                { title: "Equipes", desc: "Gestão de usuários por time, organização de responsabilidades e base para permissões de acesso diferenciadas." },
                { title: "Agenda", desc: "Visualização de compromissos, prazos e tarefas vinculadas em formato de calendário, facilitando o planejamento semanal." }
            ]
        },
        finance: {
            title: "Módulo Financeiro",
            headline: <>Controle total <br /> de <span className="text-emerald-400">finanças</span> com <br /> ferramentas <br /> integradas e <br /> inteligentes.</>,
            desc: "Tenha clareza absoluta sobre o dinheiro do seu negócio. Saiba exatamente o que entra, o que sai e quanto sobra no final.",
            color: "text-emerald-400",
            borderColor: "border-emerald-500",
            bgHover: "hover:bg-emerald-500/10",
            icon: <DollarSign size={20} />,
            items: [
                { title: "Visão Geral", desc: "Dashboard financeiro completo com saldo geral, entradas, saídas, resultado do período e indicadores de saúde financeira." },
                { title: "Lançamentos", desc: "Registro detalhado de receitas e despesas, controle por data, categoria, centro de custo e conta bancária de origem." },
                { title: "Contas & Bancos", desc: "Cadastro de múltiplas contas bancárias, controle de saldo individualizado e conciliação bancária simplificada." },
                { title: "Categorias", desc: "Plano de contas personalizável para organizar receitas e despesas, permitindo análises precisas de custos." },
                { title: "Cartões", desc: "Gerenciamento de cartões de crédito corporativos, controle de faturas, limites e parcelamentos de despesas." }
            ]
        }
    };

    return (
        <div>
            {/* Tab Triggers */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
                <button
                    onClick={() => setActiveTab('commercial')}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wide",
                        activeTab === 'commercial'
                            ? "bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_20px_-5px_theme(colors.purple.900)]"
                            : "bg-slate-900 border-slate-800 text-slate-500 hover:border-purple-500/50 hover:text-slate-300"
                    )}
                >
                    <Briefcase size={16} /> Comercial
                </button>
                <button
                    onClick={() => setActiveTab('routines')}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wide",
                        activeTab === 'routines'
                            ? "bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_-5px_theme(colors.cyan.900)]"
                            : "bg-slate-900 border-slate-800 text-slate-500 hover:border-cyan-500/50 hover:text-slate-300"
                    )}
                >
                    <Clock size={16} /> Rotinas
                </button>
                <button
                    onClick={() => setActiveTab('finance')}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wide",
                        activeTab === 'finance'
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_20px_-5px_theme(colors.emerald.900)]"
                            : "bg-slate-900 border-slate-800 text-slate-500 hover:border-emerald-500/50 hover:text-slate-300"
                    )}
                >
                    <DollarSign size={16} /> Financeiro
                </button>
            </div>

            {/* Tab Content */}
            <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 items-start" key={activeTab}>
                {/* Left: Description */}
                <div className="lg:col-span-4 space-y-5 sticky top-24">
                    <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-900/50 backdrop-blur-sm", features[activeTab].color, features[activeTab].borderColor.replace('border-', 'border-opacity-30 border-'))}>
                        {features[activeTab].icon}
                        <span className="font-bold text-xs tracking-wide">{features[activeTab].title}</span>
                    </div>

                    <h3 className="text-3xl md:text-3xl font-bold text-white leading-[1.15]">
                        {features[activeTab].headline}
                    </h3>

                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                        {features[activeTab].desc}
                    </p>
                </div>

                {/* Right: Items Grid */}
                <div className="lg:col-span-8 grid md:grid-cols-2 gap-3">
                    {features[activeTab].items.map((item, i) => (
                        <div key={i} className={cn(
                            "bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl hover:bg-slate-800/40 transition-all group hover:border-slate-700/60",
                            i === 4 && "md:col-span-2" // Make the last item span full width
                        )}>
                            <h4 className={cn("font-bold mb-2 text-sm flex items-center gap-2", features[activeTab].color)}>
                                <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_currentColor]"></div>
                                {item.title}
                            </h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    // FAQ State
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const toggleFaq = (index: number) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    const scrollToPlans = () => {
        document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <PublicLayout>
            <LandingNavbar />
            {/* 1. HERO (Scroll Stop) */}
            <section id="hero" className="relative pt-32 pb-24 px-4 overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full mix-blend-screen" />
                    <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-cyan-900/10 blur-[100px] rounded-full mix-blend-screen" />
                </div>

                <div className="container mx-auto max-w-5xl text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/50 border border-slate-700/50 text-slate-300 text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_theme(colors.primary.DEFAULT)]"></span>
                        Sistema de Gestão 360º
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-[1.1]">
                        Ou você <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-cyan-400">controla o negócio.</span><br className="hidden md:block" />
                        Ou ele controla você.
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
                        Controle total do seu negócio em um único sistema. O Contazze organiza finanças, tarefas e vendas para você parar de improvisar e começar a crescer com previsibilidade.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            onClick={scrollToPlans}
                            className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_-5px_theme(colors.primary.DEFAULT)] hover:shadow-[0_0_40px_-5px_theme(colors.primary.DEFAULT)] h-16 px-10 text-lg rounded-2xl font-bold w-full sm:w-auto transition-all duration-300 transform hover:-translate-y-1"
                        >
                            Criar conta agora
                        </Button>
                    </div>
                </div>
            </section>

            {/* 2. AGITAÇÃO DA DOR */}
            <section className="py-24 bg-slate-950 border-y border-white/5 relative">
                <div className="container mx-auto max-w-4xl px-4 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">O caos custa caro. <span className="text-rose-500">Todos os dias.</span></h2>
                        <p className="text-slate-400 text-lg">Enquanto você não tem controle real, isso está acontecendo:</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            "Seu caixa nunca bate e o dinheiro some.",
                            "Suas planilhas quebram e apagam dados.",
                            "Você decide no escuro, sem números.",
                            "Tarefas se perdem e clientes reclamam.",
                            "Vendas escapam por falta de follow-up.",
                            "O crescimento trava porque tudo depende de você."
                        ].map((pain, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                                <XCircle className="text-rose-500 shrink-0 mt-0.5" size={24} />
                                <p className="text-slate-300 font-medium text-lg leading-snug">{pain}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center max-w-2xl mx-auto">
                        <p className="text-rose-200 font-medium text-lg">O problema não é falta de esforço. <br /><span className="font-bold text-white">É falta de sistema.</span></p>
                    </div>
                </div>
            </section>

            {/* 3. POSICIONAMENTO */}
            <section id="positioning" className="py-32 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
                <div className="container mx-auto max-w-4xl text-center relative z-10">
                    <div className="inline-block mb-6">
                        <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Contazze não é mais um app.</h2>
                    <p className="text-2xl md:text-3xl text-slate-300 font-light leading-relaxed">
                        É o <strong className="text-white font-bold">sistema operacional</strong> do seu negócio. <br />
                        Tudo em um só lugar. Tudo sob seu controle.
                    </p>
                    <p className="mt-8 text-slate-500 uppercase tracking-widest font-bold text-sm">Sem sistema, não existe escala. Só sobrevivência.</p>
                </div>
            </section>

            {/* 4. RECURSOS (DETALHAMENTO TÉCNICO) */}
            <section id="features" className="py-8 px-4 bg-slate-950 relative">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-6">
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">Recursos do Sistema</h2>
                        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
                            Uma visão técnica dos módulos integrados que compõem o Contazze.
                        </p>
                    </div>

                    <FeatureTabs />

                    {/* INTEGRAÇÃO */}
                    <div className="mt-12 border-t border-white/5 pt-12">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                    <Zap className="text-yellow-400" /> Integração entre Módulos
                                </h3>
                                <ul className="space-y-4">
                                    {[
                                        "Dados compartilhados entre comercial, rotinas e financeiro",
                                        "Vendas impactam diretamente o financeiro (previsão e real)",
                                        "Clientes são únicos e utilizados em todos os módulos",
                                        "Tarefas e projetos podem estar vinculados a vendas, contratos ou clientes",
                                        "O sistema funciona como uma plataforma unificada, não módulos isolados"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-slate-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                                            <span className="leading-relaxed">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl"></div>
                                <div className="relative z-10 grid grid-cols-2 gap-4">
                                    <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center">
                                        <Users className="mx-auto text-purple-400 mb-2" />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Comercial</p>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center">
                                        <Clock className="mx-auto text-cyan-400 mb-2" />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Rotinas</p>
                                    </div>
                                    <div className="col-span-2 bg-slate-950 p-4 rounded-xl border border-white/5 text-center border-t-2 border-t-primary/50">
                                        <LayoutDashboard className="mx-auto text-emerald-400 mb-2" />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Financeiro (Consolidado)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. COMPARATIVO MERCADO */}
            <section className="py-24 px-4 bg-slate-900/50 border-y border-white/5">
                <div className="container mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">O Contazze substitui 5 ferramentas por 1 sistema.</h2>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="grid grid-cols-4 bg-slate-900/80 text-xs font-bold uppercase text-slate-500 p-4 border-b border-slate-800 tracking-wider">
                            <div className="col-span-1">Categoria</div>
                            <div className="col-span-1">Mercado</div>
                            <div className="col-span-1">Preço Médio</div>
                            <div className="col-span-1 text-emerald-400">Contazze</div>
                        </div>
                        {[
                            { cat: "Financeiro", tech: "Conta Azul / Omie", price: "R$ 129–179", status: "Incluso" },
                            { cat: "Tarefas", tech: "Notion / ClickUp", price: "R$ 40–60", status: "Incluso" },
                            { cat: "CRM", tech: "Pipedrive / RD", price: "R$ 79–149", status: "Incluso" },
                            { cat: "Relatórios", tech: "Planilhas / BI", price: "Complexo", status: "Incluso" },
                            { cat: "Integração", tech: "Gambiarras", price: "Caro", status: "Nativo" },
                        ].map((row, i) => (
                            <div key={i} className="grid grid-cols-4 p-5 items-center border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors text-sm">
                                <div className="font-bold text-white">{row.cat}</div>
                                <div className="text-slate-400">{row.tech}</div>
                                <div className="text-slate-400">{row.price}</div>
                                <div className="text-emerald-400 font-bold flex items-center gap-2">
                                    <CheckCircle2 size={16} /> {row.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. BENEFÍCIOS DIRETOS */}
            <section className="py-24 px-4 overflow-hidden relative">
                {/* Decor */}
                <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2" />

                <div className="container mx-auto max-w-5xl relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-4xl font-bold text-white mb-8 leading-tight">Chega de trabalhar <br /> e não ver a cor do dinheiro.</h2>
                            <div className="space-y-6">
                                {[
                                    "Visibilidade total do negócio",
                                    "Menos erros e retrabalho",
                                    "Mais tempo livre para viver",
                                    "Mais lucro no final do mês",
                                    "Decisões rápidas e seguras",
                                    "Crescimento previsível",
                                    "Paz mental absoluta"
                                ].map((benefit, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shrink-0">
                                            <Check className="text-primary" size={16} />
                                        </div>
                                        <span className="text-xl text-slate-300 font-light">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-cyan-400 rounded-3xl blur-2xl opacity-20"></div>
                            <div className="relative h-[400px] w-full flex items-center justify-center">
                                {/* BEFORE CARD (Loss) */}
                                <div className="absolute top-0 left-0 md:left-4 w-64 md:w-72 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl transform -rotate-6 opacity-60 hover:opacity-100 hover:rotate-0 hover:z-20 transition-all duration-300 backdrop-blur-sm grayscale hover:grayscale-0">
                                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Antes (Caos)</span>
                                        <XCircle size={16} className="text-rose-500" />
                                    </div>
                                    <div className="space-y-3 mb-4">
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>Boleto Atrasado</span>
                                            <span className="text-rose-500 font-medium">- R$ 145,00</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>Taxa Maquininha</span>
                                            <span className="text-rose-500 font-medium">- R$ 89,90</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>Saques Pessoais</span>
                                            <span className="text-rose-500 font-medium">- R$ 400,00</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>Não Identificado</span>
                                            <span className="text-rose-500 font-medium">- R$ 120,00</span>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-rose-500/20">
                                        <p className="text-xs text-slate-500">Saldo Final</p>
                                        <p className="text-xl font-bold text-rose-500">- R$ 754,90</p>
                                    </div>
                                </div>

                                {/* AFTER CARD (Profit) */}
                                <div className="absolute bottom-0 right-0 md:right-4 w-64 md:w-72 bg-slate-900 border border-primary/30 rounded-2xl p-5 shadow-[0_0_40px_-10px_theme(colors.primary.DEFAULT)] transform z-10 scale-105">
                                    <style>{`
                                        @keyframes scan-line {
                                            0% { top: 0; opacity: 0; }
                                            20% { opacity: 1; }
                                            80% { opacity: 1; }
                                            100% { top: 100%; opacity: 0; }
                                        }
                                    `}</style>
                                    <div className="absolute inset-x-0 h-[2px] bg-primary blur-[2px] z-20 animate-[scan-line_3s_ease-in-out_infinite]" style={{ top: '0%' }}></div>

                                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                        <span className="text-xs font-bold text-primary uppercase flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                            Com Contazze
                                        </span>
                                        <CheckCircle2 size={16} className="text-primary" />
                                    </div>
                                    <div className="space-y-3 mb-4">
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span>Venda Serviço</span>
                                            <span className="text-primary font-medium">+ R$ 2.500,00</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span>Venda Produto</span>
                                            <span className="text-primary font-medium">+ R$ 1.850,00</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-300 opacity-60">
                                            <span>Custos Fixos</span>
                                            <span className="text-slate-400 font-medium">- R$ 980,00</span>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-primary/20">
                                        <p className="text-xs text-slate-500">Lucro Real</p>
                                        <p className="text-2xl font-bold text-primary">+ R$ 3.370,00</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. PLANOS */}
            <LandingPricing />

            {/* 8. COMPARATIVO DETALHADO */}
            <section className="py-20 px-4 border-b border-white/5 bg-slate-950/30">
                <div className="container mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">Comparativo de Recursos</h2>
                        <p className="text-slate-400 text-sm">Entenda exatamente o que cada plano entrega para o seu negócio.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-950/80 border-b border-slate-800">
                                    <th className="p-6 pl-8 w-1/2 text-slate-400 font-bold uppercase text-xs tracking-wider">Recursos</th>
                                    <th className="p-6 text-center w-1/4 text-white font-bold text-base">Start</th>
                                    <th className="p-6 text-center w-1/4 text-primary font-bold text-base bg-primary/5 border-l border-slate-800">Pro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {[
                                    {
                                        category: "FINANCEIRO",
                                        items: [
                                            { name: "Financeiro (visão geral)", start: "Controle essencial", pro: "Completo e estratégico" },
                                            { name: "Caixa e lançamentos", start: "Básico", pro: "Completo" },
                                            { name: "Contas, bancos e cartões", start: true, pro: true },
                                            { name: "Categorias financeiras", start: true, pro: true },
                                            { name: "Relatórios financeiros", start: "Essenciais", pro: "Avançados" },
                                            { name: "Projeções e visão estratégica", start: false, pro: true },
                                        ]
                                    },
                                    {
                                        category: "ROTINAS & EXECUÇÃO",
                                        items: [
                                            { name: "Rotinas (visão geral)", start: "Organização básica", pro: "Execução estruturada" },
                                            { name: "Tarefas", start: true, pro: true },
                                            { name: "Tarefas recorrentes", start: false, pro: true },
                                            { name: "Projetos", start: false, pro: true },
                                            { name: "Equipes", start: false, pro: true },
                                            { name: "Agenda integrada", start: "Básica", pro: "Completa" },
                                        ]
                                    },
                                    {
                                        category: "VENDAS / CRM",
                                        items: [
                                            { name: "CRM de vendas", start: false, pro: true },
                                            { name: "Contatos e histórico", start: true, pro: true },
                                            { name: "Orçamentos", start: false, pro: true },
                                            { name: "Contratos", start: false, pro: true },
                                            { name: "Catálogo de produtos", start: false, pro: true },
                                        ]
                                    },
                                    {
                                        category: "GESTÃO & ESCALA",
                                        items: [
                                            { name: "Relatórios avançados", start: false, pro: true },
                                            { name: "Usuários inclusos", start: "1 usuário", pro: "Até 5 usuários" },
                                            { name: "Permissões por usuário", start: false, pro: true },
                                            { name: "Suporte", start: "Padrão", pro: "Prioritário" },
                                        ]
                                    }
                                ].map((section, sIdx) => (
                                    <React.Fragment key={sIdx}>
                                        <tr className="bg-slate-950/50">
                                            <td colSpan={3} className="p-4 pl-8 text-xs font-bold uppercase text-slate-500 tracking-widest border-y border-slate-800">
                                                {section.category}
                                            </td>
                                        </tr>
                                        {section.items.map((row, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-4 pl-8 text-slate-300 font-medium border-r border-slate-800/30">
                                                    {row.name}
                                                </td>
                                                <td className="p-4 text-center text-slate-400">
                                                    {typeof row.start === 'boolean' ? (
                                                        row.start ? <CheckCircle2 size={18} className="mx-auto text-emerald-500/80" /> : <div className="w-1.5 h-0.5 bg-slate-700 mx-auto rounded-full" />
                                                    ) : (
                                                        <span className="text-xs font-medium bg-slate-800/50 px-2 py-1 rounded text-slate-400">{row.start}</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center text-white bg-primary/[0.02] border-l border-slate-800 relative">
                                                    {/* Pro Highlight Effect */}
                                                    <div className="absolute inset-x-0 top-0 bottom-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                                    {typeof row.pro === 'boolean' ? (
                                                        row.pro ? <CheckCircle2 size={18} className="mx-auto text-primary" /> : <div className="w-1.5 h-0.5 bg-slate-700 mx-auto rounded-full" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-primary">{row.pro}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 9. QUEBRA DE OBJEÇÕES */}
            <section className="py-24 px-4 bg-slate-900">
                <div className="container mx-auto max-w-5xl">
                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { title: '"Meu negócio é pequeno"', text: "Pequeno sem controle não cresce. Com sistema, sim." },
                            { title: '"Não tenho tempo"', text: "Então você precisa mais ainda. O sistema compra tempo." },
                            { title: '"Já uso planilha"', text: "Planilha não escala. O sistema organiza e automatiza." },
                            { title: '"Tenho medo de trocar"', text: "Você testa grátis. Sem risco nenhum." },
                        ].map((obj, i) => (
                            <div key={i} className="bg-slate-950 p-6 rounded-2xl border border-white/5 text-center">
                                <h4 className="text-white font-bold mb-3 italic">{obj.title}</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">{obj.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 10. FAQ */}
            <section className="py-24 px-4 bg-slate-950">
                <div className="container mx-auto max-w-3xl">
                    <h2 className="text-3xl font-bold text-white mb-12 text-center">Perguntas Frequentes</h2>

                    <div className="space-y-4">
                        {[
                            {
                                q: "O Contazze é um ERP?",
                                a: "É um sistema de gestão 360º que vai além do ERP tradicional. Unificamos financeiro, CRM de vendas e gestão de rotinas em uma plataforma fluida e intuitiva, eliminando a complexidade e telas desnecessárias de sistemas antigos."
                            },
                            {
                                q: "Preciso instalar alguma coisa?",
                                a: "Não. O Contazze é 100% online (SaaS). Você acessa instantaneamente pelo navegador do seu computador ou celular, sem precisar de servidores, instalações ou infraestrutura local."
                            },
                            {
                                q: "Meus dados estão seguros?",
                                a: "Sim. Utilizamos criptografia de ponta a ponta, servidores em nuvem de alta disponibilidade e backups automáticos diários. Seus dados estão isolados e protegidos com o mesmo nível de segurança de aplicações bancárias."
                            },
                            {
                                q: "Posso cancelar quando quiser?",
                                a: "Sim. Não exigimos fidelidade e não há contratos de longo prazo. Você tem total liberdade para cancelar sua assinatura a qualquer momento, sem multas ou burocracia."
                            },
                            {
                                q: "O Contazze escala conforme meu negócio cresce?",
                                a: "Definitivamente. Você pode começar como MEI no plano Start e migrar para o Pro conforme sua equipe cresce, liberando recursos avançados de CRM, projetos e gestão de acessos sem perder nenhum dado histórico."
                            },
                            {
                                q: "Qual a diferença entre o plano Start e o Pro?",
                                a: "O plano Start foca no controle essencial: financeiro completo e organização de tarefas. O plano Pro é para crescimento e escala: adiciona CRM de vendas robusto, gestão de projetos, equipes, tarefas recorrentes e relatórios estratégicos."
                            },
                            {
                                q: "Posso usar com minha equipe?",
                                a: "Sim. O plano Pro permite adicionar até 5 usuários com controle granular de permissões, garantindo que cada colaborador acesse apenas o que é pertinente à sua função."
                            },
                            {
                                q: "O Contazze substitui planilhas e outros sistemas?",
                                a: "Sim. O objetivo é a centralização. Substituímos suas planilhas financeiras, controles de tarefas soltos (Trello/Notion) e CRMs isolados (Pipedrive) por um único ecossistema integrado, onde o dado flui automaticamente entre os setores."
                            },
                            {
                                q: "Em quanto tempo consigo começar a usar?",
                                a: "Imediatamente. O setup é projetado para ser intuitivo. Importe seus dados, configure suas categorias e comece a operar no mesmo dia, sem necessidade de treinamentos longos ou implantações complexas."
                            }
                        ].map((faq, i) => (
                            <div key={i} className="border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden">
                                <button
                                    onClick={() => toggleFaq(i)}
                                    className="w-full flex items-center justify-between p-5 text-left text-white font-medium hover:bg-white/5 transition-colors"
                                >
                                    {faq.q}
                                    <ChevronDown size={18} className={cn("text-slate-500 transition-transform", openFaq === i && "rotate-180")} />
                                </button>
                                {openFaq === i && (
                                    <div className="px-5 pb-5 text-slate-400 leading-relaxed text-sm animate-in slide-in-from-top-2 border-t border-slate-800/50 pt-4">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 11. CTA FINAL */}
            <section className="py-32 px-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-primary/5 to-slate-950" />
                {/* Glow effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

                <div className="container mx-auto max-w-4xl relative z-10">
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-10 leading-tight">
                        Ou você controla o negócio. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">Ou o negócio controla você.</span>
                    </h2>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button
                            onClick={scrollToPlans}
                            className="bg-white text-slate-950 hover:bg-slate-200 h-16 px-12 text-xl rounded-2xl font-bold shadow-2xl transform hover:scale-105 transition-all duration-300"
                        >
                            Criar conta agora
                        </Button>
                        <Link to="/login">
                            <Button variant="ghost" className="text-slate-400 hover:text-white h-16 px-8 text-lg rounded-2xl">
                                Já tenho conta
                            </Button>
                        </Link>
                    </div>

                </div>
            </section>
        </PublicLayout>
    );
};
