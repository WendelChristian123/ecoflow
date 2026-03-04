import React, { createContext, useContext } from 'react';
import { useAppMode } from '../hooks/useAppMode';

// Tab definitions for Bottom Navigation
export interface AppTab {
    id: string;
    label: string;
    icon: string; // lucide icon name
    path: string;
}

export const APP_TABS: AppTab[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
    { id: 'commercial', label: 'Comercial', icon: 'Briefcase', path: '/commercial/overview' },
    { id: 'routines', label: 'Rotinas', icon: 'CheckSquare', path: '/tasks' },
    { id: 'finance', label: 'Financeiro', icon: 'DollarSign', path: '/finance/overview' },
    { id: 'settings', label: 'Config', icon: 'Settings', path: '/settings' },
];

// Routes blocked in App mode — redirect to /dashboard
export const APP_BLOCKED_ROUTES: string[] = [
    '/commercial/contacts',
    '/commercial/catalog',
    '/commercial/recurring',
    '/finance/categories',
    '/finance/cards',
    '/finance/reports',
    '/projects',
    '/teams',
    '/routines/overview',
];

interface AppEnvironmentContextType {
    isApp: boolean;
    isWeb: boolean;
    appTabs: AppTab[];
    blockedRoutes: string[];
}

const AppEnvironmentContext = createContext<AppEnvironmentContextType>({
    isApp: false,
    isWeb: true,
    appTabs: APP_TABS,
    blockedRoutes: APP_BLOCKED_ROUTES,
});

export const AppEnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isApp, isWeb } = useAppMode();

    return (
        <AppEnvironmentContext.Provider
            value={{
                isApp,
                isWeb,
                appTabs: APP_TABS,
                blockedRoutes: APP_BLOCKED_ROUTES,
            }}
        >
            {children}
        </AppEnvironmentContext.Provider>
    );
};

export const useAppEnvironment = () => {
    const context = useContext(AppEnvironmentContext);
    if (!context) {
        throw new Error('useAppEnvironment must be used within AppEnvironmentProvider');
    }
    return context;
};
