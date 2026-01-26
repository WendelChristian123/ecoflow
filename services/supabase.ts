
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      headers: { 'x-client-info': 'ecoflow-web' }
    }
  }
);

// --- IP Tracking Init ---
// Fetch public IP and set it as a global header for all subsequent requests
// This allows Database Triggers to capture the IP for Audit Logs
(async () => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000); // 2s timeout
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(id);

    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        // console.log('[Audit] Client IP detected:', data.ip);
        // Mutate the internal global headers (Supabase JS Client supports this)
        // @ts-ignore - Accessing internal headers config safely
        if (supabase['rest']) supabase.rest.headers['x-user-ip'] = data.ip;
        // Fallback if structure is different or for other transports
        // However, standard way to set global headers post-init is tricky in v2.
        // Best way: createClient allows global headers in options, but we don't have IP yet.
        // WE MUST RE-ASSIGN? No, createClient is a singleton here.

        // Hack: Supabase v2 exposes `headers` in the rest client.
        const restClient = (supabase as any).rest;
        if (restClient && restClient.headers) {
          restClient.headers['x-user-ip'] = data.ip;
        }

        // Also set for Realtime/Auth if possible, but Auth usually uses fetch.
        // Authorization header is auto-managed. Custom headers:
        // Note: The BEST way is to make a custom fetch wrapper, but that's invasive.
        // Let's rely on patching the `rest` headers which covers DB operations (RPC/Table).
      }
    }
  } catch (e) {
    // console.warn('[Audit] Failed to capture IP for logs');
  }
})();
