import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configuredSiteUrl = import.meta.env.VITE_SITE_URL as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, {
  // This is a client-only Vite SPA, so the implicit flow is sufficient. The
  // Supabase client consumes the returned hash and persists the session.
  auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

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
