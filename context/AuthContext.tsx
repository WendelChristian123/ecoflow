
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to map Supabase user to AppUser
  const mapSupabaseUser = async (sbUser: any): Promise<AppUser | null> => {
    if (!sbUser) return null;

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sbUser.id)
      .single();

    if (profile) {
      // Store tenant choice persistence
      const storedTenant = localStorage.getItem('ecoflow-tenant-id');
      if (!storedTenant && profile.tenant_id) {
        localStorage.setItem('ecoflow-tenant-id', profile.tenant_id);
      }

      return {
        id: sbUser.id,
        name: profile.name,
        email: sbUser.email,
        role: profile.role || 'user',
        tenantId: profile.tenant_id,
        avatarUrl: profile.avatar_url || '',
        permissions: undefined
      };
    }

    // Fallback if profile not found yet (trigger latency)
    return {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || '',
      email: sbUser.email,
      role: 'user',
      tenantId: 'tenant-1',
      avatarUrl: '',
      permissions: undefined
    };
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          const mapped = await mapSupabaseUser(session.user);
          if (mounted) setUser(mapped);
        }
      } catch (err) {
        console.error("Error initializing session:", err);
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
  };

  const value = { session: !!user, user, loading, signOut, signIn, signUp };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
