
import { createClient } from '@supabase/supabase-js';
const getEnvVar = (key: string) => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    try { return (import.meta as any).env[key]; } catch(e) { return undefined; }
};
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') as string;
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') as string;

console.log('[Supabase Config] URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('[Supabase Config] Key:', supabaseAnonKey ? 'Set' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { 'x-client-info': 'ecoflow-web' },
      fetch: (url, options) => {
        const companyId = localStorage.getItem('ecoflow-company-id');
        if (companyId && options) {
            options.headers = {
                ...options.headers,
                'x-company-id': companyId
            };
        }
        return fetch(url, options);
      }
    }
  }
);

// --- IP Tracking Init ---
// IP tracking hack removed. IP should be handled by Supabase backend natively if needed.
