
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, CheckSquare, Briefcase, Users, Calendar, Settings, LogOut, Menu, X, Bell, ChevronDown, ChevronRight, PieChart, Wallet, CreditCard, Tags, FileText, DollarSign, PanelLeftClose, PanelLeftOpen, Sun, Moon, Monitor, User as UserIcon, Briefcase as CommercialIcon, ShoppingBag, RefreshCw, BarChart2, Building2, Globe, ShieldCheck, Lock, ArrowLeftCircle
} from 'lucide-react';
import { Avatar, cn } from './Shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRBAC } from '../context/RBACContext';
import { useTenant } from '../context/TenantContext';
import { UserProfileModal } from './UserModals';
import { User } from '../types';
import { api } from '../services/api';

// ... SidebarItem and SidebarGroup remain the same ...
interface SidebarItemProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    depth?: number;
    isCollapsed: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, onClick, depth = 0, isCollapsed }) => {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            className={({ isActive }) => cn(
                "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 group relative",
                isCollapsed ? "justify-center px-2" : "px-4",
                (!isCollapsed && depth > 0) && "pl-11",
                isActive
                    ? "bg-primary/10 text-primary border border-primary/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
        >
            <div className="shrink-0">{icon}</div>
            {!isCollapsed && <span>{label}</span>}

            {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md">
                    {label}
                </div>
            )}
        </NavLink>
    );
}

const SidebarGroup: React.FC<{
    label: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    isCollapsed: boolean;
    highlight?: boolean;
}> = ({ label, icon, isOpen, onToggle, children, isCollapsed, highlight }) => {
    const [isHovered, setIsHovered] = useState(false);

    if (isCollapsed) {
        return (
            <div
                className="mb-2 relative group"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className={cn(
                    "w-full flex items-center justify-center py-2.5 rounded-lg transition-colors cursor-pointer",
                    highlight ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-secondary"
                )}>
                    {icon}
                </div>

                <div className={cn(
                    "absolute left-full top-0 ml-2 w-48 bg-popover border border-border rounded-xl shadow-xl p-2 z-50 transition-all duration-200 origin-left",
                    isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                )}>
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border mb-2">
                        {label}
                    </div>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-2">
            <button
                onClick={onToggle}
                className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    highlight ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-secondary"
                )}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span>{label}</span>
                </div>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className={cn("overflow-hidden transition-all duration-300", isOpen ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0")}>
                {children}
            </div>
        </div>
    );
};

const UserDropdown: React.FC<{ onOpenProfile: () => void }> = ({ onOpenProfile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, signOut, refreshSession } = useAuth();
    const { theme, setTheme } = useTheme();
    const { role, isSuperAdmin } = useRBAC();
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            const logoutPromise = signOut();
            const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
            await Promise.race([logoutPromise, timeoutPromise]);
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            // Force hard reload/redirect to ensure clean state
            window.location.href = '/login';
        }
    };

    const getRoleLabel = () => {
        if (isSuperAdmin) return "SUPER ADMIN";
        return role === 'admin' ? 'Administrador' : 'Membro';
    }

    // Use mapped user name directly
    const userName = user?.name || 'Usuário';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 hover:bg-slate-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            >
                <div className="text-right hidden md:block leading-tight">
                    <p className="text-sm font-semibold text-slate-100 max-w-[150px] truncate">{userName}</p>
                    <p className="text-[11px] text-slate-400 max-w-[150px] truncate opacity-60 font-medium">
                        {user?.email}
                    </p>
                </div>
                <div className="relative">
                    <Avatar name={userName} />
                    {isSuperAdmin && (
                        <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 border border-slate-900" title="Super Admin">
                            <Globe size={8} className="text-white" />
                        </div>
                    )}
                </div>
                <ChevronDown size={14} className={cn("text-slate-500 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-800">
                        <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                        {isSuperAdmin && (
                            <span className="inline-flex items-center gap-1 mt-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20">
                                <Globe size={10} /> SUPER ADMIN
                            </span>
                        )}
                    </div>

                    <div className="p-2">
                        <div className="text-xs text-slate-500 font-semibold px-2 py-1 mb-1">APARÊNCIA</div>
                        <div className="flex bg-slate-800 p-1 rounded-lg">
                            <button onClick={() => setTheme('light')} className={cn("flex-1 p-1.5 rounded flex justify-center hover:bg-slate-700 transition-colors", theme === 'light' && "bg-slate-700 text-emerald-400")} title="Claro"><Sun size={16} /></button>
                            <button onClick={() => setTheme('dark')} className={cn("flex-1 p-1.5 rounded flex justify-center hover:bg-slate-700 transition-colors", theme === 'dark' && "bg-slate-700 text-emerald-400")} title="Escuro"><Moon size={16} /></button>
                            <button onClick={() => setTheme('system')} className={cn("flex-1 p-1.5 rounded flex justify-center hover:bg-slate-700 transition-colors", theme === 'system' && "bg-slate-700 text-emerald-400")} title="Sistema"><Monitor size={16} /></button>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 p-2 space-y-1">
                        <button onClick={() => { onOpenProfile(); setIsOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left">
                            <UserIcon size={16} /> Ver Perfil
                        </button>
                        <NavLink to="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setIsOpen(false)}>
                            <Settings size={16} /> Configurações
                        </NavLink>
                        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors mt-1">
                            <LogOut size={16} /> Sair
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ... TenantSelector and Layout Main Component ...
const TenantSelector: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => {
    const { availableTenants, currentTenant, switchTenant, isMultiTenant } = useTenant();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isMultiTenant) return null;

    return (
        <div className={cn("mb-4 px-3", isCollapsed && "px-2")} ref={wrapperRef}>
            <div className="mb-1 px-1">
                {!isCollapsed && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ambiente Atual</span>}
            </div>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-lg transition-all hover:bg-primary/20",
                        isCollapsed ? "justify-center p-2" : "px-3 py-2 justify-between"
                    )}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 size={18} className="shrink-0 text-primary" />
                        {!isCollapsed && <span className="text-sm font-medium truncate">{currentTenant?.name || 'Selecione...'}</span>}
                    </div>
                    {!isCollapsed && <ChevronDown size={14} className="opacity-70" />}
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 mt-2 p-1 overflow-hidden animate-in fade-in zoom-in-95 origin-top-left">
                        <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800 mb-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alternar Empresa</p>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {availableTenants.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => { switchTenant(t.id); setIsOpen(false); }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center gap-2",
                                        currentTenant?.id === t.id
                                            ? "bg-primary/10 text-primary"
                                            : "text-slate-300 hover:bg-slate-800"
                                    )}
                                >
                                    <Building2 size={14} />
                                    <span className="truncate">{t.name}</span>
                                    {currentTenant?.id === t.id && <div className="ml-auto w-2 h-2 rounded-full bg-primary"></div>}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-slate-800 mt-1 pt-1">
                            <NavLink to="/super-admin/dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">
                                <Settings size={12} /> Gerenciar Empresas
                            </NavLink>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<string[]>([]);
    const { can, isSuperAdmin } = useRBAC();
    const { user, refreshSession } = useAuth();
    const { currentTenant } = useTenant();

    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('ecoflow-sidebar-collapsed');
        return saved === 'true';
    });

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);

    const location = useLocation();
    const isSuperAdminArea = location.pathname.startsWith('/super-admin');

    useEffect(() => {
        localStorage.setItem('ecoflow-sidebar-collapsed', String(isCollapsed));
    }, [isCollapsed]);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    const toggleGroup = (group: string) => {
        setOpenGroups(prev =>
            prev.includes(group) ? [] : [group]
        );
    };

    const handleOpenProfile = async () => {
        if (user) {
            // If we have a fallback user, we use that. If DB profile exists, we use that.
            // Since getGlobalUsers is admin only, we should use getUserProfile or just the auth user data
            // For simplicity in this layout fix, we reconstruct a User object from auth state
            const safeUser: User = {
                id: user.id,
                name: user.user_metadata?.name || user.email || '',
                email: user.email,
                avatarUrl: '',
                role: user.role || 'user'
            };
            setCurrentUserProfile(safeUser);
            setIsProfileOpen(true);
        }
    };

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Painel Principal';
        // ... rest of logic
        if (path.startsWith('/commercial')) return 'Gestão Comercial';
        if (path.startsWith('/routines')) return 'Rotinas & Execução';
        if (path.startsWith('/tasks')) return 'Tarefas';
        if (path.startsWith('/projects')) return 'Projetos';
        if (path.startsWith('/finance')) return 'Financeiro';
        if (path.startsWith('/settings')) return 'Configurações';
        if (path.startsWith('/super-admin')) return 'Backoffice Admin';
        return 'Contazze';
    };


    // Helper to check if the current tenant has contracted a specific module
    const hasModule = (moduleKey: string) => {
        if (isSuperAdmin && !currentTenant) return true; // Safety

        if (currentTenant?.contractedModules) {
            const mods = currentTenant.contractedModules;
            return mods.includes(moduleKey);
        }

        return true;
    };

    return (
        <div className="h-screen w-full bg-background flex text-foreground font-sans selection:bg-primary/30 overflow-hidden transition-colors duration-300">

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 bg-card/85 backdrop-blur-xl border-r border-border/50 transition-all duration-300 flex flex-col h-full shadow-2xl",
                "lg:static",
                isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
                (!isMobileMenuOpen && isCollapsed) ? "lg:w-20" : "lg:w-64"
            )}>
                <div className="h-full flex flex-col">
                    <div className={cn("h-16 flex items-center border-b border-white/5 transition-all px-4 shrink-0 bg-white/5", isCollapsed ? "justify-center" : "justify-between")}>
                        {!isCollapsed ? (
                            <div className="flex items-center gap-2">
                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg glow", isSuperAdminArea ? "bg-primary" : "bg-gradient-to-br from-primary to-primary")}>
                                    {isSuperAdminArea ? <Globe className="h-5 w-5 text-white" /> : <LayoutDashboard className="h-5 w-5 text-white" />}
                                </div>
                                <span className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap overflow-hidden drop-shadow-sm">
                                    {isSuperAdminArea ? 'Contazze Admin' : 'Contazze'}
                                </span>
                            </div>
                        ) : (
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg", isSuperAdminArea ? "bg-primary" : "bg-gradient-to-br from-primary to-primary")}>
                                {isSuperAdminArea ? <Globe className="h-5 w-5 text-white" /> : <LayoutDashboard className="h-5 w-5 text-white" />}
                            </div>
                        )}
                        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-muted-foreground"><X size={20} /></button>
                        <button onClick={toggleSidebar} className="hidden lg:flex text-muted-foreground hover:text-foreground transition-colors">
                            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar overflow-x-hidden">

                        {/* SUPER ADMIN TENANT SELECTOR */}
                        <TenantSelector isCollapsed={isCollapsed} />

                        {/* SUPER ADMIN MENU */}
                        {isSuperAdminArea ? (
                            <>
                                <div className="mb-2 px-3">
                                    <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Gestão Global</div>
                                </div>
                                <SidebarItem isCollapsed={isCollapsed} to="/super-admin/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard Admin" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem isCollapsed={isCollapsed} to="/super-admin/users" icon={<Users size={18} />} label="Usuários" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem isCollapsed={isCollapsed} to="/super-admin/admins" icon={<ShieldCheck size={18} />} label="Super Admins" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem isCollapsed={isCollapsed} to="/super-admin/plans" icon={<CreditCard size={18} />} label="Planos & Preços" onClick={() => setIsMobileMenuOpen(false)} />

                                <div className="my-4 border-t border-white/5"></div>
                                <SidebarItem isCollapsed={isCollapsed} to="/" icon={<ArrowLeftCircle size={18} />} label="Voltar ao App" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        ) : (
                            /* CLIENT MENU */
                            <>
                                <SidebarItem isCollapsed={isCollapsed} to="/" icon={<LayoutDashboard size={18} />} label="Painel Principal" onClick={() => setIsMobileMenuOpen(false)} />
                                <div className="my-4 border-t border-white/10"></div>

                                {/* Commercial Module */}
                                {can('commercial', 'view') && hasModule('mod_commercial') && (
                                    <SidebarGroup
                                        label="Comercial"
                                        icon={<CommercialIcon size={18} />}
                                        isOpen={openGroups.includes('commercial')}
                                        onToggle={() => toggleGroup('commercial')}
                                        isCollapsed={isCollapsed}
                                    >
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/commercial/overview" icon={<PieChart size={16} />} label="Visão Geral" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/commercial/contacts" icon={<Users size={16} />} label="Contatos" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/commercial/quotes" icon={<FileText size={16} />} label="Orçamentos" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/commercial/recurring" icon={<RefreshCw size={16} />} label="Contratos" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/commercial/catalog" icon={<ShoppingBag size={16} />} label="Catálogo" onClick={() => setIsMobileMenuOpen(false)} />
                                    </SidebarGroup>
                                )}

                                {/* Rotinas */}
                                {can('routines', 'view') && hasModule('mod_tasks') && (
                                    <SidebarGroup
                                        label="Rotinas & Execução"
                                        icon={<CheckSquare size={18} />}
                                        isOpen={openGroups.includes('routines')}
                                        onToggle={() => toggleGroup('routines')}
                                        isCollapsed={isCollapsed}
                                    >
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/routines/overview" icon={<BarChart2 size={16} />} label="Visão Geral" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/tasks" icon={<CheckSquare size={16} />} label="Tarefas" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/projects" icon={<Briefcase size={16} />} label="Projetos" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/teams" icon={<Users size={16} />} label="Equipes" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/agenda" icon={<Calendar size={16} />} label="Agenda" onClick={() => setIsMobileMenuOpen(false)} />
                                    </SidebarGroup>
                                )}

                                {/* Financeiro */}
                                {can('finance', 'view') && hasModule('mod_finance') && (
                                    <SidebarGroup
                                        label="Financeiro"
                                        icon={<DollarSign size={18} />}
                                        isOpen={openGroups.includes('finance')}
                                        onToggle={() => toggleGroup('finance')}
                                        isCollapsed={isCollapsed}
                                    >
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/finance/overview" icon={<PieChart size={16} />} label="Visão Geral" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/finance/transactions" icon={<FileText size={16} />} label="Lançamentos" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/finance/accounts" icon={<Wallet size={16} />} label="Contas & Bancos" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/finance/categories" icon={<Tags size={16} />} label="Categorias" onClick={() => setIsMobileMenuOpen(false)} />
                                        <SidebarItem isCollapsed={isCollapsed} depth={1} to="/finance/cards" icon={<CreditCard size={16} />} label="Cartões" onClick={() => setIsMobileMenuOpen(false)} />

                                    </SidebarGroup>
                                )}
                            </>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/10 shrink-0 space-y-1">
                        {!isSuperAdminArea && <SidebarItem isCollapsed={isCollapsed} to="/settings" icon={<Settings size={18} />} label="Configurações" onClick={() => setIsMobileMenuOpen(false)} />}
                        {isSuperAdmin && !isSuperAdminArea && (
                            <SidebarItem isCollapsed={isCollapsed} to="/super-admin/dashboard" icon={<Globe size={18} />} label="Área Super Admin" onClick={() => setIsMobileMenuOpen(false)} />
                        )}
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
                <header className="h-16 border-b border-border/40 bg-background/60 backdrop-blur-xl px-6 flex items-center justify-between shrink-0 z-30 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground"><Menu size={24} /></button>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-semibold text-foreground leading-tight">{getPageTitle()}</h1>
                            {currentTenant && !isSuperAdminArea && (
                                <span className="text-xs text-primary font-medium">{currentTenant.name}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <Bell size={20} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse"></span>
                        </div>
                        <div className="h-6 w-px bg-border"></div>
                        <UserDropdown onOpenProfile={handleOpenProfile} />
                    </div>
                </header>

                {/* Main Content Area - Optimized for 100% Height */}
                <div className="flex-1 overflow-hidden p-4 flex flex-col relative">
                    {children}
                </div>
            </main>

            <UserProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                user={currentUserProfile}
                onSuccess={() => {
                    refreshSession();
                }}
            />
        </div>
    );
};

