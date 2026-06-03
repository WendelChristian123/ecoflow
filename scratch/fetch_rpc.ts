import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'admin_update_user_rpc';"
    });
    if (error) {
        console.error('Error fetching RPC:', error);
    } else {
        console.log('RPC Definition:', data);
    }
}
main().catch(console.error);
