// End-to-end check of organiser login against local Supabase.
// Signs up a new organiser with an email code, reads the code from Mailpit,
// verifies it, and checks the profile. Run: npm run check:login
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .map((l) => /^(\w+)="(.*)"$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const supabase = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const email = `check-${Date.now()}@kitty.local`;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  process.exit(1);
};

async function latestCode(to) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${status.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages = [] } = await res.json();
    if (messages.length > 0) {
      const msg = await (await fetch(`${status.MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json();
      const code = /\b(\d{6})\b/.exec(msg.Text ?? msg.HTML ?? '')?.[1];
      if (code) return { code, subject: msg.Subject };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// 1. Log in with an unknown email must not create an account.
const login = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
if (!login.error) fail('logging in with an unknown email should fail');
console.log(`ok   unknown email cannot log in (${login.error.code ?? login.error.message})`);

// 2. Sign up sends a 6 digit code.
const signUp = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { name: 'Check Organiser', phone: '+919811122233' } } });
if (signUp.error) fail(`sign up: ${signUp.error.message}`);
const mail = await latestCode(email);
if (!mail) fail('no 6 digit code arrived in Mailpit');
console.log(`ok   code email arrived: "${mail.subject}"`);

// 3. A wrong code is rejected, the right one logs in.
const wrong = await supabase.auth.verifyOtp({ email, token: mail.code === '000000' ? '111111' : '000000', type: 'email' });
if (!wrong.error) fail('a wrong code should be rejected');
console.log('ok   wrong code rejected');
const verify = await supabase.auth.verifyOtp({ email, token: mail.code, type: 'email' });
if (verify.error || !verify.data.session) fail(`verify: ${verify.error?.message}`);
console.log('ok   right code logs in');

// 4. The profile exists with the sign-up name, and RLS lets the organiser update it.
const { data: profile, error: readError } = await supabase.from('profiles').select('*').single();
if (readError) fail(`read profile: ${readError.message}`);
if (profile.name !== 'Check Organiser') fail(`profile name is "${profile.name}"`);
if (profile.phone !== '+919811122233') fail(`profile phone is "${profile.phone}"`);
const { error: updateError } = await supabase.from('profiles').update({ phone: '+919876543210', upi_id: 'check@ybl' }).eq('id', profile.id);
if (updateError) fail(`update profile: ${updateError.message}`);
const { count } = await supabase.from('kitties').select('*', { count: 'exact', head: true });
if (count !== 0) fail(`new organiser sees ${count} kitties`);
console.log('ok   profile created with name and mobile, editable, and no kitties visible');

// 5. Returning organiser can log in again.
await supabase.auth.signOut();
await new Promise((r) => setTimeout(r, 1500)); // Supabase allows one code request per second per email
const again = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
if (again.error) fail(`log in again: ${again.error.message}`);
console.log('ok   returning organiser gets a code');
console.log('\nAll login checks passed.');
