import React from 'react';
import { useAppEnvironment } from '../context/AppEnvironmentContext';
import { Layout } from './Layout';
import { AppLayout } from './AppLayout';

/**
 * Renders AppLayout (mobile) or Layout (web) based on environment detection.
 * This is the ONLY change point in the routing — Layout.tsx remains untouched.
 */
export const LayoutSwitch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isApp } = useAppEnvironment();

    if (isApp) {
        return <AppLayout>{children}</AppLayout>;
    }

    return <Layout>{children}</Layout>;
};
