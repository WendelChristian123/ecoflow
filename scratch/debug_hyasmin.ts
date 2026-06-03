import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // We want to find Hyasmin
    const { data: users, error: err } = await supabase.from('profiles').select('id, name, role').ilike('name', '%hyasmin%');
    if (err) throw err;
    console.log('User:', users);

    if (users && users.length > 0) {
        const hyasminId = users[0].id;
        
        // Check Teams
        const { data: teams } = await supabase.from('teams').select('id, name, member_ids, lead_id');
        console.log('Teams:', JSON.stringify(teams, null, 2));

        // Check Projects
        const { data: projects } = await supabase.from('projects').select('id, name, member_ids');
        console.log('Projects:', JSON.stringify(projects, null, 2));
    }
}
main().catch(console.error);
