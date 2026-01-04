
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
  const mapSupabaseUser = async (sbUser: any, options: { retries?: number; timeout?: number } = {}): Promise<AppUser | null> => {
    if (!sbUser) return null;

    // Purge legacy hardcoded tenant string if exists
    if (localStorage.getItem('ecoflow-tenant-id') === 'tenant-1') {
      localStorage.removeItem('ecoflow-tenant-id');
    }
    // Basic mapping from Auth User metadata (fallback safe)
    const appUser: AppUser = {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || sbUser.email || '',
      email: sbUser.email || '',
      avatarUrl: sbUser.user_metadata?.avatar_url || '',
      role: 'user', // Default, will be updated by profile
      tenantId: undefined, // Will be updated by profile
      permissions: undefined
    };

    try {
      // Fetch profile using RPC with RETRY LOGIC
      // Default: 3 retries, 12s timeout (robust). Can be overridden for speed.
      let profile = null;
      let attempt = 0;
      const maxRetries = options.retries ?? 3;
      const timeoutMs = options.timeout ?? 12000;

      while (attempt <= maxRetries) { // use <= to allow at least 1 attempt if maxRetries is 0
        attempt++;
        try {
          // console.log(`[Auth] Fetching profile (Attempt ${attempt}/${maxRetries + 1})...`);

          // Ensure we have a valid token before asking RPC
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) {
            console.warn("[Auth] No active session during profile fetch retry. Aborting.");
            throw new Error("No active session");
          }

          const profilePromise = supabase.rpc('get_my_profile');
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), timeoutMs)
          );

          const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

          if (error) throw error;

          profile = data;
          // console.log(`[Auth] Profile fetched successfully on attempt ${attempt}`);
          break; // Success
        } catch (err: any) {
          console.warn(`[Auth] Profile fetch failed (Attempt ${attempt}):`, err.message);
          if (attempt > maxRetries) throw err; // Throw on final failure
          // Wait 1s before retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (profile) {
        // ENFORCEMENT: Check Status (User & Tenant)
        if (profile.role !== 'super_admin') {
          if (profile.status === 'suspended' || profile.status === 'blocked') {
            console.error("User suspended/blocked");
            throw new Error("Sua conta foi suspensa ou bloqueada. Entre em contato com seu administrador.");
          }

          if (profile.tenant_id && profile.tenants) {
            const tStatus = profile.tenants.status;
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
        (appUser as any).status = profile.status;

        if (profile.tenant_id) localStorage.setItem('ecoflow-tenant-id', profile.tenant_id);
        if (profile.role) localStorage.setItem('ecoflow-user-role', profile.role);
      }
    } catch (err: any) {
      console.error('Profile fetch/enforcement check failed:', err.message);

      // CRITICAL: If enforcement failed due to logic (suspended), RE-THROW to logout.
      if (err.message.includes("suspensa") || err.message.includes("inativa") || err.message.includes("bloqueada")) {
        await supabase.auth.signOut();
        throw err;
      }

      // If it's a network/timeout error, we re-throw to let the caller handle fallback
      throw new Error("Falha ao carregar perfil de usuário. (" + err.message + ")");
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
                  // Safety: wrap recovery in timeout to avoid infinite loading
                  // Use FAST options: 3s timeout, 1 retry
                  const recoveryPromise = mapSupabaseUser(stored.user, { timeout: 3000, retries: 1 });
                  const recoveryTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Recovery timeout')), 4000)
                  );
                  const mapped = await Promise.race([recoveryPromise, recoveryTimeout]) as any;

                  if (mounted) setUser(mapped);
                } catch (mapErr) {
                  console.warn('[Auth] Could not recover session (likely invalid/expired). Enforcing logout.');
                  if (mounted) setUser(null);
                  supabase.auth.signOut().catch(() => { }); // Clean up client state
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // OPTIMIZATION: Ignore token refreshes (profile data hasn't changed)
      // This prevents redundant RPC calls that spam the DB and cause timeouts
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      console.log(`[Auth] State changed: ${event}`, session?.user?.id);

      if (session?.user) {
        // Silent refresh - If this fails, we don't want to crash the app, just warn.
        try {
          // FAST TRACK: If user is waiting (LOGIN), don't wait 40 seconds. 
          // 4s timeout, 1 retry. Fallback immediately if it fails.
          const mapped = await mapSupabaseUser(session.user, { timeout: 4000, retries: 1 });
          if (mounted) setUser(mapped);
        } catch (err) {
          console.warn("[Auth] Failed to refresh profile on auth change:", err);
          // FALLBACK: If RPC fails, use basic session data so user can at least login
          if (mounted && !user) {
            const fallbackUser: User = {
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email || '',
              email: session.user.email || '',
              role: 'user', // Default safe role
              tenantId: DEFAULT_TENANT_ID,
              avatarUrl: '',
              permissions: undefined
            };
            setUser(fallbackUser);
          }
        }
      } else {
        if (mounted) {
          setUser(null);
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
