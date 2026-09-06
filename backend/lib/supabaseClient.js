import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error(
    '\n[FATAL] Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env\n' +
    'Copy .env.example to .env and fill in your Supabase project values.\n'
  );
  process.exit(1);
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * SCOPING DECISION (documented, not an oversight):
 * Full multi-user auth (signup/login/sessions) was intentionally scoped out
 * of this 72-hour build to spend the available time on the actual problem
 * (the meaningful-change engine) rather than auth plumbing.
 *
 * Instead, we bootstrap a single demo user on server startup and use it for
 * all watchlist operations. The schema and every query already key off
 * `user_id`, so swapping this for Supabase Auth later is a drop-in change,
 * not a rewrite: replace DEMO_USER_ID with the authenticated user's id from
 * `supabase.auth.getUser()` in each route.
 */
const DEMO_USER_EMAIL = 'demo@smart-watchlist.local';
let demoUserId = null;

export async function getDemoUserId() {
  if (demoUserId) return demoUserId;

  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', DEMO_USER_EMAIL)
    .maybeSingle();

  if (findErr) {
    console.error('Error looking up demo user:', findErr);
    throw findErr;
  }

  if (existing) {
    demoUserId = existing.id;
    return demoUserId;
  }

  const { data: created, error: createErr } = await supabase
    .from('users')
    .insert([{ email: DEMO_USER_EMAIL }])
    .select()
    .single();

  if (createErr) {
    console.error('Error creating demo user:', createErr);
    throw createErr;
  }

  demoUserId = created.id;
  return demoUserId;
}
