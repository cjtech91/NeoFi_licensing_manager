import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nmrhhxsfcxabmoqriloj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcmhoeHNmY3hhYm1vcXJpbG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDE3MzMsImV4cCI6MjA4NTk3NzczM30.jpX2PSm7wgzyFLRcLrC5sAi67o4fdDg0j11KIYfFfYA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Checking machines table...');
  const { error: machinesError } = await supabase.from('machines').select('id').limit(1);
  if (machinesError) {
    console.log('Machines table error:', machinesError.message);
  } else {
    console.log('Machines table exists.');
  }

  console.log('Testing insert with invalid user ID...');
  const { error } = await supabase
    .from('licenses')
    .insert([
      {
        key: 'TEST-KEY-' + Math.random(),
        type: 'lifetime',
        status: 'active',
        created_by: '00000000-0000-0000-0000-000000000000' // Invalid UUID
      }
    ]);

  if (error) {
    console.log('Error caught!');
    console.log('Type of error:', typeof error);
    console.log('Is instance of Error:', error instanceof Error);
    console.log('Keys in error:', Object.keys(error));
    console.log('Error message:', error.message);
    console.log('Full error object:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success (unexpected)!');
  }
}

test();
