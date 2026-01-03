
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

// System-wide default tenant ID for global/super-admin views and new user defaults
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to map Supabase user to AppUser
  const mapSupabaseUser = async (sbUser: any): Promise<AppUser | null> => {
    if (!sbUser) return null;

    // Purge legacy hardcoded tenant string if exists
    if (localStorage.getItem('ecoflow-tenant-id') === 'tenant-1') {
      localStorage.removeItem('ecoflow-tenant-id');
    }

    // Default user structure from token only (Offline-safe)
    const storedRole = localStorage.getItem('ecoflow-user-role') as any;

    const appUser: AppUser = {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User',
      email: sbUser.email || '',
      role: storedRole || 'user',
      tenantId: localStorage.getItem('ecoflow-tenant-id') || undefined,
      avatarUrl: '',
      permissions: undefined
    };

    try {
      // Fetch profile AND tenant status with strict enforcement
      // RESTORED TIMEOUT PROTECTION: Prevent hang if RLS/Network stalls
      const profilePromise = supabase
        .from('profiles')
        .select('*, tenants(id, status, financial_status)')
        .eq('id', sbUser.id)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) throw error;

      if (profile) {
        // ENFORCEMENT: Check Status (User & Tenant)
        if (profile.role !== 'super_admin') {
          if (profile.status === 'suspended' || profile.status === 'blocked') {
            console.error("User suspended/blocked");
            throw new Error("Sua conta foi suspensa ou bloqueada. Entre em contato com seu administrador.");
          }
          if (profile.tenants?.status !== 'active') {
            // Allow 'trial' status if we had that conceptualized, but for now stick to active
            // If tenant status is undefined (e.g. mock data issues), let it slide or default to active?
            // Let's be strict but safe: check if explicitly suspended/inactive
            const tStatus = profile.tenants?.status;
            if (tStatus === 'suspended' || tStatus === 'inactive') {
              console.error("Tenant inactive/suspended");
              throw new Error("A sua empresa está inativa ou suspensa. Entre em contato com o suporte.");
            }
          }
        }

        appUser.name = profile.name || appUser.name;
        appUser.role = profile.role || appUser.role;
        appUser.tenantId = profile.tenant_id || appUser.tenantId;
        appUser.avatarUrl = profile.avatar_url || appUser.avatarUrl;

        // Include status in the user object
        (appUser as any).status = profile.status;

        // Force update persistence from DB (Source of Truth)
        if (profile.tenant_id) {
          localStorage.setItem('ecoflow-tenant-id', profile.tenant_id);
        }
        if (profile.role) {
          localStorage.setItem('ecoflow-user-role', profile.role);
        }
      }
    } catch (err: any) {

      console.error('Profile fetch/enforcement check failed:', err.message);

      // CRITICAL: If enforcement failed due to logic (suspended), RE-THROW to logout.
      if (err.message.includes("suspensa") || err.message.includes("inativa") || err.message.includes("bloqueada")) {
        await supabase.auth.signOut();
        throw err;
      }

      // If it's a network/timeout error, we cannot trust the session context (Tenant ID might be wrong/missing).
      // Risk: Infinite loading if we don't resolve.
      // Decision: Alert user and Throw to let initSession handle cleanup.

      // But if we throw, initSession catches and logs out.Ideally we want "Try Again"? 
      // For now, fail safe (Logout) is better than "Ghost State".
      // We will re-throw.
      throw new Error("Falha ao carregar perfil de usuário. Verifique sua conexão e tente novamente. (" + err.message + ")");
    }



    return appUser;
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    const initSession = async () => {
      // console.log('[AuthContext] initSession started');

      try {
        // 1. Try standard getSession with a short timeout (6s)
        const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 6000)
        );

        const { data: { session }, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);

        if (error) throw error;

        if (session?.user) {
          try {
            const mapped = await mapSupabaseUser(session.user);
            if (mounted) setUser(mapped);
          } catch (mapErr: any) {
            console.error("Login enforcement failed:", mapErr);
            if (mounted) {
              setUser(null); // Ensure logged out state
              alert(mapErr.message); // Show message as requested
            }
          }
        }
      } catch (err: any) {
        console.warn("[AuthContext] Session verification failed/timedout:", err);

        // 2. Manual Recovery Strategy (Offline-First Fallback)
        // If getSession hangs, check if we have a valid token in localStorage and use it.
        const keys = Object.keys(localStorage);
        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));

        if (sbKey) {
          try {
            const storedStr = localStorage.getItem(sbKey);
            if (storedStr) {
              const stored = JSON.parse(storedStr);
              if (stored?.user) {
                // console.log('[AuthContext] Recovering session from LocalStorage...');
                // Use the stored user data immediately
                // We wrap mapping in a try-catch to avoid secondary hangs
                try {
                  const mapped = await mapSupabaseUser(stored.user);
                  if (mounted) setUser(mapped);
                } catch (mapErr) {
                  console.error('Error mapping stored user:', mapErr);
                  // Basic fallback if mapping fails
                  if (mounted) {
                    setUser({
                      id: stored.user.id,
                      name: stored.user.user_metadata?.name || '',
                      email: stored.user.email,
                      role: localStorage.getItem('ecoflow-user-role') as any || 'user',
                      tenantId: localStorage.getItem('ecoflow-tenant-id') || DEFAULT_TENANT_ID,
                      avatarUrl: '',
                      permissions: undefined
                    });
                  }
                }
              }
            }
          } catch (parseErr) {
            console.error('[AuthContext] Failed to recover local session:', parseErr);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const mapped = await mapSupabaseUser(session.user);
        if (mounted) setUser(mapped);
      } else {
        if (mounted) {
          setUser(null);
          // Only set loading false if we were loading (though usually init handles it)
          setLoading(false);
        }
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
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('ecoflow-tenant-id');
    localStorage.removeItem('ecoflow-user-role');
  };

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const mapped = await mapSupabaseUser(session.user);
      setUser(mapped);
    }
  };

  const value = { session: !!user, user, loading, signOut, signIn, signUp, refreshSession };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
