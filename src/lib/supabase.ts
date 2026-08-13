import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredSiteUrl = import.meta.env.VITE_SITE_URL;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, {
  // This is a client-only Vite SPA, so the implicit flow is sufficient. The
  // Supabase client consumes the returned hash and persists the session.
  auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

const PENDING_PROFILE_KEY = 'fieldyield.pendingSupabaseProfile';
const PENDING_PROFILE_TTL_MS = 30 * 60 * 1000;
type PendingProfile = { date_of_birth?: string; username?: string; expires_at: number };

export function storePendingProfile(profile: { date_of_birth?: string; username?: string }): void {
  window.sessionStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify({ ...profile, expires_at: Date.now() + PENDING_PROFILE_TTL_MS } satisfies PendingProfile));
}

export function readPendingProfile(): Omit<PendingProfile, 'expires_at'> | null {
  const raw = window.sessionStorage.getItem(PENDING_PROFILE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingProfile;
    if (!value.expires_at || value.expires_at <= Date.now()) { clearPendingProfile(); return null; }
    return { date_of_birth: value.date_of_birth, username: value.username };
  } catch { clearPendingProfile(); return null; }
}

export function clearPendingProfile(): void {
  window.sessionStorage.removeItem(PENDING_PROFILE_KEY);
}

export function getOAuthRedirectUrl(): string {
  const fallback = window.location.origin.replace(/\/$/, '');
  const configured = configuredSiteUrl?.trim().replace(/\/$/, '');
  if (import.meta.env.PROD && configured && !configured.startsWith('https://')) return fallback;
  return configured || fallback;
}

export function clearOAuthUrl(): void {
  const hasOAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
  const hasOAuthQuery = window.location.search.includes('error=') || window.location.search.includes('code=');
  if (hasOAuthHash || hasOAuthQuery) {
    window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
  }
}
