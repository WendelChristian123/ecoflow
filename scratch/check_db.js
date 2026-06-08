import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing environment variables in .env.local");
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log("Signing in...");
    
    // Sign in as wendel.d.f@hotmail.com to view his company's records
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'wendel.d.f@hotmail.com',
        password: 'EcoFlow@2024'
    });
    
    if (authErr) {
        console.error("Login failed:", authErr.message);
        console.log("Trying without login just in case...");
    } else {
        console.log("Logged in successfully! User ID:", authData.user.id);
    }
    
    // 1. Find company by name
    const { data: companies, error: coErr } = await supabase
        .from('companies')
        .select('*');
        
    if (coErr) {
        console.error("Error fetching companies:", coErr);
        return;
    }
    
    console.log("\n--- COMPANIES ---");
    console.log(JSON.stringify(companies, null, 2));
    
    if (!companies || companies.length === 0) {
        console.log("No companies found.");
        return;
    }
    
    const companyId = companies[0].id;
    
    // 2. Fetch modules
    const { data: modules, error: modErr } = await supabase
        .from('company_modules')
        .select('*')
        .eq('company_id', companyId);
        
    console.log("\n--- COMPANY MODULES ---");
    if (modErr) console.error("Error fetching modules:", modErr);
    else console.log(JSON.stringify(modules, null, 2));
    
    // 3. Fetch subscriptions
    const { data: subs, error: subErr } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', companyId);
        
    console.log("\n--- SUBSCRIPTIONS ---");
    if (subErr) console.error("Error fetching subscriptions:", subErr);
    else console.log(JSON.stringify(subs, null, 2));
    
    // 4. Fetch profiles
    const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId);
        
    console.log("\n--- PROFILES ---");
    if (profErr) console.error("Error fetching profiles:", profErr);
    else console.log(JSON.stringify(profiles, null, 2));
}

run();
