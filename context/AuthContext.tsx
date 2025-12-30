
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to map Supabase user to AppUser
  const mapSupabaseUser = async (sbUser: any): Promise<AppUser | null> => {
    if (!sbUser) return null;

    // Default user structure from token only (Offline-safe)
    // Try to recover stored role to prevent flickering to 'user' on slow connections
    const storedRole = localStorage.getItem('ecoflow-user-role') as any;

    const appUser: AppUser = {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User',
      email: sbUser.email || '',
      role: storedRole || 'user', // Use stored role if available, otherwise default
      tenantId: 'tenant-1', // Default
      avatarUrl: '',
      permissions: undefined
    };

    try {
      // Fetch profile with short timeout to avoid hanging the UI
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
      );

      const result: any = await Promise.race([profilePromise, timeoutPromise]);
      const profile = result?.data;

      if (profile) {
        appUser.name = profile.name || appUser.name;
        appUser.role = profile.role || appUser.role;
        appUser.tenantId = profile.tenant_id || appUser.tenantId;
        appUser.avatarUrl = profile.avatar_url || appUser.avatarUrl;

        // Store tenant choice persistence
        const storedTenant = localStorage.getItem('ecoflow-tenant-id');
        if (!storedTenant && profile.tenant_id) {
          localStorage.setItem('ecoflow-tenant-id', profile.tenant_id);
        }

        // Store role persistence for next load
        if (profile.role) {
          localStorage.setItem('ecoflow-user-role', profile.role);
        }
      }
    } catch (err) {
      console.warn('Profile fetch skipped/failed (using robust offline data):', err);
    }

    return appUser;
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    const initSession = async () => {
      // console.log('[AuthContext] initSession started');

      try {
        // 1. Try standard getSession with a short timeout (3s)
        const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 3000)
        );

        const { data: { session }, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);

        if (error) throw error;

        if (session?.user) {
          const mapped = await mapSupabaseUser(session.user);
          if (mounted) setUser(mapped);
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
                      role: 'user',
                      tenantId: 'tenant-1',
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
