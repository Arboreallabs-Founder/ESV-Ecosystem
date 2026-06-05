const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const users = [
    { email: 'founder@earlyseed.vc', password: 'password123', role: 'founder' },
    { email: 'admin@earlyseed.vc', password: 'password123', role: 'admin' },
    { email: 'associate@earlyseed.vc', password: 'password123', role: 'associate' },
    { email: 'partner@earlyseed.vc', password: 'password123', role: 'franchise_partner' }
  ];

  for (const u of users) {
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
    });
    if (error) {
      console.log('Error signing up', u.email, error.message);
    } else {
      console.log('Signed up', u.email);
    }
  }
}

main();
