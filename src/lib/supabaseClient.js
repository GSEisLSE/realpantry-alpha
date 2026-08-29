import { createClient } from '@supabase/supabase-js';

// These are public client settings. The publishable key is intentionally safe
// to ship in browser code; access to household data is enforced by Supabase RLS.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ovgltrjnhqyuqjsjvzlg.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_klY9L5sc43bLJJuieK2Jjg_KLPHASuZ';

export const cloudConfigured = Boolean(url && publishableKey);

export const supabase = cloudConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
