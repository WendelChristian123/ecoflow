const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fetbelqmlgjvmcondxzk.supabase.co';
const supabaseKey = 'sb_publishable_J1JA4w7QyZWgEc4aXYE8nA_0NwGYMgt';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.functions.invoke('push-notify', {
    body: {
      user_id: '1664fa37-2e47-4745-beb5-3b9826fe6f55',
      title: 'Lembrete de Tarefa',
      body: 'A tarefa vence em breve.',
      data: { type: 'task_deadline', id: 'abd3c921-c303-4a32-9837-d8831f9c6164', url: '/' }
    }
  });
  console.log('Error:', error);
  console.log('Data:', data);
}
test();
