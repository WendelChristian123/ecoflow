import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!); // or service key if needed, but we can query tasks directly with service key
// Actually let's use the service role key to bypass RLS and inspect the actual records
const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: tasks, error } = await admin.from('tasks').select('id, title, owner_id, assignee_id, company_id').limit(10);
  console.log("Tasks:", tasks);
  
  const { data: shares, error: shareErr } = await admin.from('shared_access').select('*').limit(10);
  console.log("Shared Access:", shares);
}
run();
