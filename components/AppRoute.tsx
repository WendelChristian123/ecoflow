import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppEnvironment } from '../context/AppEnvironmentContext';

/**
 * Blocks access to certain routes when in App mode.
 * Wraps around route elements — if the route is blocked in App, redirects to /dashboard.
 * In Web mode, always renders children.
 */
export const AppRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isApp, blockedRoutes } = useAppEnvironment();
    const location = useLocation();

    if (isApp && blockedRoutes.some(r => location.pathname.startsWith(r))) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};
