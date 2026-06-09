import { useState, useEffect, useMemo } from 'react';

/**
 * Detects if the app is running in "App mode" (mobile PWA / Mobile Web) vs "Web mode".
 * 
 * Rules:
 * - Desktop/Notebook: Always Web mode (even if installed as PWA).
 * - Mobile (Phones): Always App mode.
 * - Tablet: App mode.
 */

function checkIsApp(): boolean {
    if (typeof window === 'undefined') return false;

    // 1. Allow manual override for testing purposes via URL
    const hash = window.location.hash || '';
    const hasAppPrefix = hash.includes('/app/') || hash === '#/app';
    const params = new URLSearchParams(window.location.search);
    const hasAppParam = params.get('mode') === 'app';
    const hasWebParam = params.get('mode') === 'web';

    if (hasAppPrefix || hasAppParam) return true;
    if (hasWebParam) return false;

    // 2. Detect if device is Mobile or Tablet
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // iPadOS 13+ spoofs desktop macOS but has touch capabilities
    const isIPadOS = (navigator.platform === 'MacIntel' || userAgent.includes('mac')) && navigator.maxTouchPoints > 1;

    const isMobileOrTablet = isMobileUA || isIPadOS;

    // If it's a Desktop device (not mobile and not iPad), force Web Layout
    if (!isMobileOrTablet) {
        return false;
    }

    // If it's Mobile/Tablet, use the App Layout
    return true;
}

export function useAppMode() {
    const [isApp, setIsApp] = useState<boolean>(() => checkIsApp());

    useEffect(() => {
        const handler = () => setIsApp(checkIsApp());

        // Check on hash changes (for our manual override logic)
        window.addEventListener('hashchange', handler);
        // We can listen to resize to update layout dynamically if screen gets very small/large, 
        // but user requested Desktop = Web and Mobile = Mobile, mostly unaffected by resize. 
        // We will keep resize event listener in case orientation changes affect any checks in the future.
        window.addEventListener('resize', handler);

        return () => {
            window.removeEventListener('hashchange', handler);
            window.removeEventListener('resize', handler);
        };
    }, []);

    return useMemo(() => ({
        isApp,
        isWeb: !isApp,
    }), [isApp]);
}

// Static utility for use outside of React components
export const isAppMode = (): boolean => checkIsApp();
