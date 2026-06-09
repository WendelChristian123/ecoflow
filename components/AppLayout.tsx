import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useRBAC } from '../context/RBACContext';
import { BottomNavigation } from './BottomNavigation';
import { NotificationPopover } from './NotificationPopover';
import { TrialExpired } from './TrialExpired';
import { TrialBanner } from './TrialBanner';
import { Bell, ChevronLeft } from 'lucide-react';
import { UserProfileModal } from './UserModals';
import { User } from '../types';
import { Avatar, cn } from './Shared';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Building2, ChevronDown } from 'lucide-react';

// Mobile Company Selector
const AppCompanySelector: React.FC = () => {
    const { availableCompanies, currentCompany, switchCompany, isMultiCompany } = useCompany();
    const [isOpen, setIsOpen] = React.useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isMultiCompany) return null;

    return (
        <div className="relative ml-2" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
            >
                <Building2 size={12} />
                <span className="text-[10px] font-semibold max-w-[80px] truncate">{currentCompany?.name || 'Empresa'}</span>
                <ChevronDown size={10} className={cn("transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-popover border border-border rounded-xl shadow-2xl z-[100] p-1 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                    <div className="px-3 py-2 bg-secondary/50 border-b border-border mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trocar Ambiente</p>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                        {[...availableCompanies].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(t => (
                            <button
                                key={t.id}
                                onClick={() => { switchCompany(t.id); setIsOpen(false); }}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center gap-2",
                                    currentCompany?.id === t.id
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-foreground hover:bg-secondary/50"
                                )}
                            >
                                <Building2 size={14} className="shrink-0" />
                                <span className="truncate">{t.name}</span>
                                {currentCompany?.id === t.id && <div className="ml-auto w-2 h-2 rounded-full bg-primary shrink-0"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Compact App Header for mobile
interface AppHeaderProps {
    onOpenProfile: (user: User | null) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onOpenProfile }) => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const getTitle = (): string => {
        const path = location.pathname;
        if (path.startsWith('/dashboard')) return 'Dashboard';
        if (path === '/commercial/overview') return 'Comercial';
        if (path === '/commercial/quotes') return 'Orçamentos';
        if (path.startsWith('/commercial')) return 'Comercial';
        if (path.startsWith('/routines')) return 'Rotinas & Execuções';
        if (path === '/tasks') return 'Tarefas';
        if (path === '/agenda') return 'Compromissos';
        if (path.startsWith('/finance/overview')) return 'Financeiro';
        if (path.startsWith('/finance/transactions')) return 'Lançamentos';
        if (path.startsWith('/finance/accounts')) return 'Contas';
        if (path.startsWith('/finance')) return 'Financeiro';
        if (path.startsWith('/settings')) return 'Configurações';
        return 'Contazze';
    };

    // Show back button for sub-pages
    const isSubPage = (): boolean => {
        const subPages = ['/commercial/quotes', '/finance/transactions', '/finance/accounts', '/agenda'];
        return subPages.some(p => location.pathname === p);
    };

    const userName = user?.name || user?.email?.split('@')[0] || 'Usuário';
    const greeting = getGreeting();

    return (
        <header className="bg-background/90 backdrop-blur-md border-b border-border/50 px-4 py-3 shrink-0 z-[60] sticky top-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    {isSubPage() ? (
                        <button
                            onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
                        >
                            <ChevronLeft size={22} />
                        </button>
                    ) : null}
                    <div className="min-w-0">
                        {!isSubPage() && location.pathname === '/dashboard' ? (
                            <>
                                <p className="text-xs text-muted-foreground font-medium">{greeting},</p>
                                <h1 className="text-lg font-bold text-foreground truncate">{userName}</h1>
                            </>
                        ) : (
                            getTitle() === 'Contazze' ? (
                                <img src="/logo-negativa.svg" alt="Contazze" className="h-6 w-auto object-contain" />
                            ) : (
                                <h1 className="text-lg font-bold text-foreground truncate">{getTitle()}</h1>
                            )
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <AppCompanySelector />
                    <NotificationPopover />
                    {/* Fixed alignment: flex items-center justify-center, and made it clickable */}
                    <button 
                        onClick={() => onOpenProfile(user)}
                        className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 flex items-center justify-center focus:outline-none hover:border-primary/60 transition-colors"
                    >
                        <Avatar name={userName} size="sm" />
                    </button>
                </div>
            </div>
        </header>
    );
};

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
}

// Main App Layout
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentCompany } = useCompany();
    const { isSuperAdmin } = useRBAC();
    const { user, refreshSession } = useAuth();

    // Push notifications — mobile PWA only (no-op on desktop)
    usePushNotifications();

    // FAB modal state
    const [fabModal, setFabModal] = useState<'transaction' | 'quote' | 'task' | 'event' | null>(null);

    // Profile modal
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);

    // Trial check
    const isTrialExpired = !isSuperAdmin && currentCompany?.type === 'trial' && currentCompany?.subscriptionEnd && new Date(currentCompany.subscriptionEnd) < new Date();

    if (isTrialExpired) {
        return <TrialExpired />;
    }

    return (
        <div className="h-[100dvh] w-[100dvw] bg-background flex flex-col text-foreground font-sans overflow-hidden">
            <TrialBanner />
            <AppHeader onOpenProfile={(u) => { setCurrentUserProfile(u); setIsProfileOpen(true); }} />

            {/* Main Content — scrollable, with bottom padding for BottomNav + FAB */}
            <main className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                {children}
            </main>

            {/* Bottom Navigation */}
            <BottomNavigation />

            {/* Profile Modal */}
            <UserProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                user={currentUserProfile}
                onSuccess={() => refreshSession()}
            />

            {/* 
        FAB Modals are handled at the page level.
        The fabModal state is passed down via context or handled by the page.
        For now we expose a global event system via window.
      */}
            {fabModal && <AppFABModalBridge type={fabModal} onClose={() => setFabModal(null)} />}
        </div>
    );
};

// Bridge component: dispatches custom events that pages can listen to
const AppFABModalBridge: React.FC<{ type: string; onClose: () => void }> = ({ type, onClose }) => {
    React.useEffect(() => {
        // Dispatch custom event that page components can listen to
        window.dispatchEvent(new CustomEvent('app-fab-action', { detail: { type } }));
        // The modal will be opened by the page component
        onClose();
    }, [type, onClose]);

    return null;
};
