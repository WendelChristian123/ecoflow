
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User as AppUser } from '../types';

interface AuthContextType {
  session: boolean;
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  refreshSession: () => Promise<void>;
}

// System-wide default company ID for global/super-admin views and new user defaults
const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Basic mapping from Auth User metadata (Synchronous, Safe)
  const mapBasicUser = (sbUser: any): AppUser => {
    return {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || sbUser.email || '',
      email: sbUser.email || '',
      avatarUrl: sbUser.user_metadata?.avatar_url || '',
      role: sbUser.user_metadata?.role || 'user', // Attempt to read role too
      companyId: sbUser.user_metadata?.companyId || sbUser.app_metadata?.companyId, // Check both, prefer companyId
      permissions: undefined
    };
  };

  // 2. Fetch profile to enhance data (Async, Background)
  const fetchUserProfile = async (currentUser: AppUser) => {
    try {
      // console.log('[Auth] Syncing profile in background...');
      // Run profile fetch and permissions fetch in parallel
      const [profileResult, permsResult] = await Promise.all([
        supabase.rpc('get_my_profile'),
        supabase.from('user_permissions').select('*').eq('user_id', currentUser.id)
      ]);

      const profile = profileResult.data;
      const granularPermissions = permsResult.data || [];

      if (profileResult.error) throw profileResult.error;

      if (profile) {
        // ENFORCEMENT: We check status but DO NOT logout automatically.
        // We just log/warn. The UI can handle "suspended" state if needed.
        if (profile.status === 'suspended' || profile.status === 'blocked') {
          console.warn(`[Auth] User status is ${profile.status}`);
        }

        // Persist Source of Truth logic
        // Use company_id from profile
        const cId = profile.company_id;
        if (cId) localStorage.setItem('ecoflow-company-id', cId); // Updated key
        if (profile.role) localStorage.setItem('ecoflow-user-role', profile.role);

        // Update User State with full profile
        setUser(prev => {
          if (!prev || prev.id !== currentUser.id) return prev; // Avoid ordering issues

          const newName = profile.name || prev.name;
          const newRole = profile.role || prev.role;
          const newCompanyId = cId || prev.companyId;
          const newAvatar = profile.avatar_url || prev.avatarUrl;
          const newStatus = profile.status;
          const newPermissions = profile.permissions;
          const newGranularPermissions = granularPermissions;

          // Optimization: Only update state if something changed
          if (
            prev.name === newName &&
            prev.role === newRole &&
            prev.companyId === newCompanyId &&
            prev.avatarUrl === newAvatar &&
            prev.status === newStatus &&
            JSON.stringify(prev.permissions) === JSON.stringify(newPermissions) &&
            JSON.stringify(prev.granular_permissions) === JSON.stringify(newGranularPermissions)
          ) {
            return prev;
          }

          return {
            ...prev,
            name: newName,
            role: newRole,
            companyId: newCompanyId,
            avatarUrl: newAvatar,
            status: newStatus,
            permissions: newPermissions,
            granular_permissions: newGranularPermissions
          } as AppUser;
        });
        // console.log('[Auth] Profile synced.');
      }
    } catch (err: any) {
      console.warn(`[Auth] Background profile sync failed: ${err.message}`);
      // Do nothing. User continues with basic access.
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    const initSession = async () => {
      try {
        // Get session (standard)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          // INSTANT UNLOCK
          const basicUser = mapBasicUser(session.user);
          if (mounted) {
            setUser(basicUser);
            setLoading(false); // <--- CRITICAL: Unblock UI immediately
          }

          // AUDIT: Check for Auto-Login (Session Restore) vs Page Reload
          if (!sessionStorage.getItem('ecoflow_session_logged')) {
            sessionStorage.setItem('ecoflow_session_logged', 'true');
            // Log the auto-login event
            import('../services/api').then(m =>
              m.api.logAuthEvent('LOGIN', 'Acesso Automático (Sessão Restaurada)')
            ).catch(err => console.error('[Auth] Failed to log auto-login:', err));
          }

          // THEN fetch profile in background
          fetchUserProfile(basicUser);
        } else {
          if (mounted) setLoading(false);
        }
      } catch (err) {
        console.error("[Auth] Initial session check failed:", err);
        if (mounted) setLoading(false); // Always unblock
      }
    };

    initSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] State changed: ${event}`, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setLoading(false);
          setUser(null);
          setLoading(false);
          localStorage.removeItem('ecoflow-company-id');
          localStorage.removeItem('ecoflow-user-role');
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') return;

      if (session?.user) {
        // On Login/Update
        const basicUser = mapBasicUser(session.user);

        if (mounted) {
          // Update state immediately if not present or different
          setUser(prev => {
            if (!prev || prev.id !== basicUser.id) {
              return basicUser;
            }
            return prev;
          });

          // Ensure loading is false (important for login flows)
          setLoading(false);
        }

        // Trigger background sync
        fetchUserProfile(basicUser);
      } else if (!session && mounted) {
        // Fallback for null session without explicit SIGNED_OUT
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await import('../services/api').then(m => m.api.logAuthEvent('LOGOUT', 'Logout realizado'));
    } catch (e) {
      console.error(e);
    }
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('ecoflow-company-id');
    localStorage.removeItem('ecoflow-user-role');
  };

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const mapped = mapBasicUser(session.user);
      setUser(mapped);
    }
  };

  const value = React.useMemo(() => ({
    session: !!user,
    user,
    loading,
    signOut,
    signIn,
    signUp,
    refreshSession
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
