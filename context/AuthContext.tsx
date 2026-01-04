
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

  // Helper to map Supabase user to AppUser (Safe, Non-Blocking)
  const mapSupabaseUser = async (sbUser: any): Promise<AppUser> => {
    // 1. Basic mapping from Auth User metadata (Always succeeds)
    const appUser: AppUser = {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || sbUser.email || '',
      email: sbUser.email || '',
      avatarUrl: sbUser.user_metadata?.avatar_url || '',
      role: 'user', // Default
      tenantId: undefined,
      permissions: undefined
    };

    // 2. Try to fetch profile to enhance data (Async, Best Effort)
    try {
      // Ensure we have a valid token
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (!currentSession || sessionError) {
        console.warn("[Auth] No active session for profile fetch. Using basic data.");
        return appUser;
      }

      // RPC Call - with simple timeout to avoid hanging, but NOT throwing to caller
      const profilePromise = supabase.rpc('get_my_profile');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('RPC Timeout')), 10000));

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) throw error;

      if (profile) {
        // Update user with real profile data
        appUser.name = profile.name || appUser.name;
        appUser.role = profile.role || appUser.role;
        appUser.tenantId = profile.tenant_id || appUser.tenantId;
        appUser.avatarUrl = profile.avatar_url || appUser.avatarUrl;
        (appUser as any).status = profile.status;

        // Persist Source of Truth
        if (profile.tenant_id) localStorage.setItem('ecoflow-tenant-id', profile.tenant_id);
        if (profile.role) localStorage.setItem('ecoflow-user-role', profile.role);

        // Optional: We could set an error state here if status is suspended, 
        // but user explicitly asked NOT to auto-logout.
        // We will just let the UI handle accessing restricted areas based on 'status'.
      }

    } catch (err: any) {
      console.warn(`[Auth] Profile sync failed (using token data): ${err.message}`);
      // We ignore errors and return the basic user to allow app access
    }

    return appUser;
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    const initSession = async () => {
      try {
        // Simple, standard check. No wrappers, no race conditions.
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          // Success! Map user and allow access.
          const user = await mapSupabaseUser(session.user);
          if (mounted) setUser(user);
        }
      } catch (err) {
        console.error("[Auth] Initial session check failed:", err);
        // Do nothing. User remains null, UI will show login.
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] State changed: ${event}`, session?.user?.id);

      if (event === 'SIGNED_OUT' || !session) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') return; // Ignore

      if (session?.user) {
        // On Login/Update: Fast update
        if (mounted) {
          // 1. Set basic user immediately (if not set) to unblock UI
          if (!user) {
            const basic = await mapSupabaseUser(session.user); // This is now safe/fast-ish?
            // Actually mapSupabaseUser tries RPC. 
            // To be truly non-blocking, we should maybe set basic FIRST?
            // usage: We rely on mapSupabaseUser's internal timeout (10s) not to block TOO long, 
            // BUT for 'SIGNED_IN', we might want instant feedback.
            // Let's rely on the fact that mapSupabaseUser catches connection errors.
            setUser(basic);
          } else {
            // already have user, maybe just refreshing profile
            const updated = await mapSupabaseUser(session.user);
            setUser(updated);
          }
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
