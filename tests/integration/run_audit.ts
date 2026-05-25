import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve('./.env.local') });

// Setup global mock for import.meta.env BEFORE importing anything else
(global as any).import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
    }
  }
};

// Now dynamically import the actual test script
import('./full_audit').catch(console.error);
