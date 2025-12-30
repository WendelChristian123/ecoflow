
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
      autoRefreshToken: false, // Disable auto refresh to check if this is the cause of the hang
    }
  }
);
