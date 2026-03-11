/**
 * Push Notification Service — Mobile PWA Only
 * 
 * This module handles Web Push subscription lifecycle.
 * ALL functions check `isMobilePWA()` before executing.
 * On desktop/web, every function is a silent no-op.
 * 
 * Limitations:
 * - iOS: Web Push requires iOS 16.4+ with PWA added to home screen
 * - Android: Works on Chrome, Edge, and Chromium-based browsers
 * - Permission denied: Cannot re-prompt; user must change in OS settings
 */

import { supabase } from './supabase';

// VAPID public key — must match the private key stored in Supabase Secrets
const VAPID_PUBLIC_KEY = 'BJ4n14s6bHjCDPWZ6WwK4hI5fHH-CqgDwA-3oq0gMH5S_io1hbjzrBV8VRVcrL7rHaWD3KA102Cac5zCdBlWpXQ';

/**
 * Detect if running as a mobile PWA (standalone mode on a mobile device).
 * Returns false for desktop browsers, even if in standalone mode.
 */
export function isMobilePWA(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  // Check standalone mode
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true; // iOS Safari

  if (!isStandalone) return false;

  // Check mobile via user agent or touch support
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && /Mobile|Tablet/i.test(navigator.userAgent));

  return isMobile;
}

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Convert a base64url string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register push subscription for the current user.
 * Only runs on mobile PWA. Silent no-op on desktop.
 */
export async function registerPushSubscription(userId: string, companyId: string): Promise<boolean> {
  // Guard: mobile PWA only
  if (!isMobilePWA() || !isPushSupported()) {
    return false;
  }

  try {
    // 1. Check/request permission
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return false;
    }

    // 2. Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // 3. Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // 4. Subscribe if no current subscription
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    // 5. Extract subscription data
    const subscriptionJson = subscription.toJSON();
    const endpoint = subscriptionJson.endpoint!;
    const keys = subscriptionJson.keys!;

    // 6. Save to Supabase (upsert by endpoint)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          company_id: companyId,
          endpoint: endpoint,
          keys_p256dh: keys.p256dh,
          keys_auth: keys.auth,
          device_info: navigator.userAgent.substring(0, 200),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('[Push] Failed to save subscription:', error.message);
      return false;
    }

    console.log('[Push] Subscription registered successfully');
    return true;
  } catch (err) {
    console.error('[Push] Registration failed:', err);
    return false;
  }
}

/**
 * Unregister push subscription.
 * Only runs on mobile PWA. Silent no-op on desktop.
 */
export async function unregisterPushSubscription(): Promise<void> {
  if (!isMobilePWA() || !isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      // Remove from Supabase
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

      // Unsubscribe from browser
      await subscription.unsubscribe();

      console.log('[Push] Subscription removed');
    }
  } catch (err) {
    console.error('[Push] Unregister failed:', err);
  }
}

/**
 * Get current push permission status.
 */
export function getPushPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Setup listener for notification click messages from the service worker.
 * The SW posts a message when a notification is clicked and the app is already open.
 */
export function setupNotificationClickListener(
  navigate: (path: string) => void
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'PUSH_NOTIFICATION_CLICK') {
      const url = event.data.url as string;
      if (url) {
        // Extract the hash path (after #)
        const hashPath = url.startsWith('/#') ? url.substring(2) : url;
        navigate(hashPath);
      }
    }
  };

  navigator.serviceWorker?.addEventListener('message', handler);
  return () => navigator.serviceWorker?.removeEventListener('message', handler);
}
