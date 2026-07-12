import { createClient } from '@supabase/supabase-js';

// Publishable keys are safe in browser code. Keep env vars as the first choice,
// while the deployed preview still works when Vercel's env injection is absent.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://teokfldjerqaodhsdlxr.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_JRdJcuUHGVwNt-J5xabrdw_BzH6PaIR';
export const hasSupabase = Boolean(url && key);
export const supabase = hasSupabase ? createClient(url, key) : null;

export async function ensureAnonymousSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}
