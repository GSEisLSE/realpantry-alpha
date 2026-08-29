import { cloudConfigured, supabase } from './supabaseClient.js';

export async function getSession() {
  if (!cloudConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export function onAuthChange(callback) {
  if (!cloudConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email) {
  if (!cloudConfigured) throw new Error('Cloud is not configured.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!cloudConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function ensureHousehold(user) {
  if (!user) throw new Error('Authentication required.');

  const { data: memberships, error: memberError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .limit(1);
  if (memberError) throw memberError;
  if (memberships?.length) return memberships[0].household_id;

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ created_by: user.id, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago' })
    .select('id')
    .single();
  if (householdError) throw householdError;

  const { error: bootstrapError } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, role: 'owner' });
  if (bootstrapError) throw bootstrapError;

  return household.id;
}

export async function loadCloudState(householdId) {
  const { data, error } = await supabase
    .from('alpha_state_snapshots')
    .select('state, state_version, updated_at')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveCloudState(householdId, state) {
  const cloudState = {
    ...state,
    version: 3,
    cloud: { ...(state.cloud || {}), householdId, lastSyncedAt: new Date().toISOString() },
  };
  const { error } = await supabase
    .from('alpha_state_snapshots')
    .upsert({
      household_id: householdId,
      state_version: 3,
      state: cloudState,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return cloudState;
}

export async function trackCloudEvent(householdId, event, childId = null, weeklyPlanId = null) {
  if (!householdId || !event) return;
  const { error } = await supabase.from('alpha_events').insert({
    household_id: householdId,
    child_id: childId || null,
    weekly_plan_id: weeklyPlanId || null,
    event_name: event.name,
    payload: event.payload || {},
    created_at: event.at || new Date().toISOString(),
  });
  if (error) throw error;
}
