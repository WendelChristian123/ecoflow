import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Fallback if VITE_SUPABASE_SERVICE_ROLE_KEY is missing, try reading .env or just use anon key with rpc
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.VITE_SUPABASE_URL!, key!);
supabase.rpc('execute_sql', { query: "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'financial_transactions';" })
  .then(console.log).catch(console.error);
