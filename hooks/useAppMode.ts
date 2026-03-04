import { useState, useEffect, useMemo } from 'react';

/**
 * Detects if the app is running in "App mode" (mobile PWA) vs "Web mode".
 * 
 * Detection triggers (any one = App mode):
 * 1. display-mode: standalone (PWA installed)
 * 2. URL hash contains /app/ prefix
 * 3. URL search params contain ?mode=app
 */

function checkIsApp(): boolean {
    if (typeof window === 'undefined') return false;

    // 1. PWA standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true; // iOS Safari

    // 2. Hash-based /app/ prefix (HashRouter uses hash for routing)
    const hash = window.location.hash || '';
    const hasAppPrefix = hash.includes('/app/') || hash === '#/app';

    // 3. Query parameter ?mode=app
    const params = new URLSearchParams(window.location.search);
    const hasAppParam = params.get('mode') === 'app';

    return isStandalone || hasAppPrefix || hasAppParam;
}

export function useAppMode() {
    const [isApp, setIsApp] = useState<boolean>(() => checkIsApp());

    useEffect(() => {
        // Listen for display-mode changes (e.g., user installs PWA while browsing)
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handler = () => setIsApp(checkIsApp());

        mediaQuery.addEventListener('change', handler);

        // Also check on hash changes
        window.addEventListener('hashchange', handler);

        return () => {
            mediaQuery.removeEventListener('change', handler);
            window.removeEventListener('hashchange', handler);
        };
    }, []);

    return useMemo(() => ({
        isApp,
        isWeb: !isApp,
    }), [isApp]);
}

// Static utility for use outside of React components
export const isAppMode = (): boolean => checkIsApp();
