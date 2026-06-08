import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('saas_plans').select('*');
    if (error) {
        console.error("Error fetching saas_plans:", error);
    } else {
        console.log("SAAS PLANS:");
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
