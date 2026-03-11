/**
 * usePushNotifications — Mobile PWA Only
 * 
 * React hook that handles push notification registration.
 * On desktop/web, this hook is a complete no-op.
 * 
 * Usage: Place in AppLayout to auto-register when user is authenticated.
 */

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import {
  isMobilePWA,
  isPushSupported,
  registerPushSubscription,
  setupNotificationClickListener,
  getPushPermissionStatus
} from '../services/pushNotifications';
import { useNavigate } from 'react-router-dom';

export function usePushNotifications() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const registeredRef = useRef(false);

  // Check if we should run at all (mobile PWA only)
  const shouldRun = isMobilePWA() && isPushSupported();

  // Register push subscription when user is authenticated
  useEffect(() => {
    if (!shouldRun || !user?.id || !currentCompany?.id || registeredRef.current) return;

    const register = async () => {
      const success = await registerPushSubscription(user.id, currentCompany.id);
      if (success) {
        registeredRef.current = true;
        setPermissionStatus(getPushPermissionStatus());
      }
    };

    // Small delay to avoid blocking app startup
    const timer = setTimeout(register, 3000);
    return () => clearTimeout(timer);
  }, [shouldRun, user?.id, currentCompany?.id]);

  // Setup notification click listener for deep linking
  useEffect(() => {
    if (!shouldRun) return;
    return setupNotificationClickListener(navigate);
  }, [shouldRun, navigate]);

  // Update permission status
  useEffect(() => {
    if (shouldRun) {
      setPermissionStatus(getPushPermissionStatus());
    }
  }, [shouldRun]);

  return {
    isSupported: shouldRun,
    permissionStatus,
  };
}
