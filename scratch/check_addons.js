import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
    console.log("Checking company_id column in company_addons...");
    const { data: data1, error: error1 } = await supabase
        .from('company_addons')
        .select('company_id')
        .limit(1);
        
    if (error1) {
        console.error("company_id error:", error1.message);
    } else {
        console.log("company_id exists! Data:", data1);
    }

    console.log("Checking tenant_id column in company_addons...");
    const { data: data2, error: error2 } = await supabase
        .from('company_addons')
        .select('tenant_id')
        .limit(1);
        
    if (error2) {
        console.error("tenant_id error:", error2.message);
    } else {
        console.log("tenant_id exists! Data:", data2);
    }
}

run();
