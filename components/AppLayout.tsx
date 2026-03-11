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
import { Avatar } from './Shared';

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

    const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
    const greeting = getGreeting();

    return (
        <header className="bg-slate-900 border-b border-slate-800/50 px-4 py-3 shrink-0 z-[60] sticky top-0 safe-area-top">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    {isSubPage() ? (
                        <button
                            onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                        >
                            <ChevronLeft size={22} />
                        </button>
                    ) : null}
                    <div className="min-w-0">
                        {!isSubPage() && location.pathname === '/dashboard' ? (
                            <>
                                <p className="text-xs text-slate-500 font-medium">{greeting},</p>
                                <h1 className="text-lg font-bold text-white truncate">{userName}</h1>
                            </>
                        ) : (
                            <h1 className="text-lg font-bold text-white truncate">{getTitle()}</h1>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <NotificationPopover />
                    {/* Fixed alignment: flex items-center justify-center, and made it clickable */}
                    <button 
                        onClick={() => onOpenProfile(user)}
                        className="w-9 h-9 rounded-full overflow-hidden border-2 border-emerald-500/30 flex items-center justify-center focus:outline-none hover:border-emerald-500/60 transition-colors"
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
        <div className="h-[100dvh] w-[100dvw] bg-slate-950 flex flex-col text-white font-sans overflow-hidden">
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
