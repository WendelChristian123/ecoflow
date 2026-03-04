import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, CheckSquare, DollarSign, Settings } from 'lucide-react';
import { APP_TABS } from '../context/AppEnvironmentContext';

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
    LayoutDashboard,
    Briefcase,
    CheckSquare,
    DollarSign,
    Settings,
};

// Map tab IDs to route prefixes for active detection
const TAB_ROUTE_PREFIXES: Record<string, string[]> = {
    dashboard: ['/dashboard'],
    commercial: ['/commercial'],
    routines: ['/tasks', '/agenda'],
    finance: ['/finance'],
    settings: ['/settings'],
};

export const BottomNavigation: React.FC = () => {
    const location = useLocation();

    const getActiveTab = (): string => {
        const path = location.pathname;
        for (const [tabId, prefixes] of Object.entries(TAB_ROUTE_PREFIXES)) {
            if (prefixes.some(p => path.startsWith(p))) return tabId;
        }
        return 'dashboard';
    };

    const activeTab = getActiveTab();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[80] bg-slate-900 border-t border-slate-700/50 backdrop-blur-xl safe-area-bottom">
            <div className="flex items-center justify-around h-16 px-1">
                {APP_TABS.map(tab => {
                    const IconComponent = ICON_MAP[tab.icon];
                    const isActive = activeTab === tab.id;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.path}
                            className="flex flex-col items-center justify-center flex-1 h-full relative group"
                            onClick={(e) => {
                                // Prevent default NavLink active class behavior
                            }}
                        >
                            {/* Active indicator dot */}
                            {isActive && (
                                <div className="absolute top-1 w-5 h-0.5 rounded-full bg-emerald-500 transition-all duration-300" />
                            )}

                            <div className={`
                flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200
                ${isActive
                                    ? 'text-emerald-400 scale-110'
                                    : 'text-slate-500 group-active:scale-95'
                                }
              `}>
                                {IconComponent && <IconComponent size={22} />}
                            </div>

                            <span className={`
                text-[10px] font-medium mt-0.5 transition-all duration-200
                ${isActive ? 'text-emerald-400' : 'text-slate-500'}
              `}>
                                {tab.label}
                            </span>
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};
