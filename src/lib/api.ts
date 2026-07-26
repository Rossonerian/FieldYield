const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export type AuthToken = {
  access_token: string;
  token_type: string;
};

export type CurrentUser = {
  id: number;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  avatar_url: string | null;
  date_of_birth: string;
  age_verified: boolean;
  created_at: string;
  updated_at: string;
  account_status: string;
  role: string;
  auth_provider: string;
  preferred_currency: 'gold' | 'silver';
  preferences: Record<string, unknown>;
  signup_bonus_awarded: boolean;
};

export type Wallet = { gold: number; silver: number };
export type ProfileSummary = Wallet & { holdings_count: number; portfolio_market_value: number; portfolio_cost_basis: number; unrealized_pnl: number; realized_pnl: number; orders_count: number; transactions_count: number; unread_notifications: number };
export type WatchlistEntry = { id: number; symbol: string; name: string; league: string; club: string; bid: number; ask: number; updated_at: string; created_at: string };
export type MarketPlayer = { symbol: string; name: string; league: string; club: string; active: boolean; bid: number; ask: number; updated_at: string; source: string };
export type WalletTransaction = { id: number; currency: string; amount: number; reason: string; created_at: string };
export type ApiOrder = { id: number; player_id: number; side: string; quantity: number; status: string; failure_reason: string | null; created_at: string };
export type SquadEntry = { id: number; player_id: number; position: number; symbol: string; name: string; club: string; league: string };
export type HoldingEntry = { symbol: string; name: string; league: string; club: string; quantity: number; average_cost: number; realized_pnl: number; market_price: number; market_value: number };
export type AdminUser = { id: number; email: string; username: string | null; account_status: string; role: string; created_at: string; signup_bonus_awarded: boolean; wallet_gold: number; wallet_silver: number };

export type SportsLeague = {
  provider_id: number;
  slug: string;
  name: string;
  country: string;
  current_season_id: number | null;
  active: boolean;
};

export type SportsFixture = {
  provider_id: number;
  league_id: number;
  season_id: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: string;
  away_team: string;
  event_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  round_name: string | null;
};

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function registerUser(email: string, password: string, dateOfBirth: string, username?: string) {
  return apiPost<{ id: number; email: string; signup_bonus_awarded: boolean }>('/api/v1/auth/register', {
    email,
    password,
    date_of_birth: dateOfBirth,
    username: username || undefined,
  });
}

export function loginUser(email: string, password: string) {
  return apiPost<AuthToken>('/api/v1/auth/login', { email, password });
}

export function syncSupabaseUser(token: string, body: { date_of_birth?: string; username?: string; first_name?: string; last_name?: string }) {
  return apiPost<CurrentUser>('/api/v1/auth/supabase-sync', body, token);
}

export async function fetchCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<CurrentUser>;
}

export async function updateCurrentUser(token: string, body: Partial<Pick<CurrentUser, 'username' | 'first_name' | 'last_name' | 'country' | 'avatar_url' | 'preferred_currency' | 'preferences'>>) {
  return apiPatch<CurrentUser>('/api/v1/users/me', body, token);
}

export function fetchWallet(token: string) { return apiGetWithToken<Wallet>('/api/v1/wallet', token); }
export function fetchWalletLedger(token: string) { return apiGetWithToken<WalletTransaction[]>('/api/v1/wallet/ledger?limit=50', token); }
export function fetchProfileSummary(token: string) { return apiGetWithToken<ProfileSummary>('/api/v1/users/me/summary', token); }
export function fetchMarketPlayers() { return apiGet<MarketPlayer[]>('/api/v1/market/prices'); }
export function fetchOrders(token: string) { return apiGetWithToken<ApiOrder[]>('/api/v1/trading/orders?limit=50', token); }
export function fetchHoldings(token: string) { return apiGetWithToken<HoldingEntry[]>('/api/v1/portfolio/holdings', token); }
export function fetchSquad(token: string) { return apiGetWithToken<SquadEntry[]>('/api/v1/squad', token); }
export function promoteSquad(token: string, symbol: string) { return apiPost<{ status: string }>('/api/v1/squad/promote', { symbol }, token); }
export function demoteSquad(token: string, symbol: string) { return apiPost<{ status: string }>('/api/v1/squad/demote', { symbol }, token); }
export function placeMarketOrder(token: string, side: 'buy' | 'sell', symbol: string, quantity: number, idempotencyKey: string) {
  return apiPost<ApiOrder>(`/api/v1/trading/orders/market-${side}`, { symbol, quantity, idempotency_key: idempotencyKey }, token);
}
export function fetchAdminUsers(token: string, search = '') { return apiGetWithToken<AdminUser[]>(`/api/v1/admin/users?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`, token); }
export function updateAdminUserStatus(token: string, userId: number, accountStatus: 'active' | 'suspended') { return apiPatch<AdminUser>(`/api/v1/admin/users/${userId}/status`, { account_status: accountStatus }, token); }
export function importCatalog(token: string, source: string, records: Array<{ symbol: string; name: string; league: string; club?: string; bid: number; ask: number; active?: boolean }>) {
  return apiPost<{ source: string; created: number; updated: number; total: number }>('/api/v1/admin/catalog/import', { source, records }, token);
}
export function fetchNotifications(token: string) { return apiGetWithToken<Array<{ id: number; kind: string; message: string; read: boolean; created_at: string }>>('/api/v1/notifications?limit=50', token); }
export function markNotificationRead(token: string, notificationId: number) { return apiPost(`/api/v1/notifications/${notificationId}/read`, {}, token); }
export function fetchWatchlist(token: string) { return apiGetWithToken<WatchlistEntry[]>('/api/v1/watchlists', token); }
export function addWatchlist(token: string, symbol: string) { return apiPost<WatchlistEntry>('/api/v1/watchlists', { symbol }, token); }
export async function removeWatchlist(token: string, symbol: string) { const response = await fetch(`${API_BASE_URL}/api/v1/watchlists/${encodeURIComponent(symbol)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Could not remove player from watchlist'); }

async function apiGetWithToken<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchSportsLeagues() {
  return apiGet<SportsLeague[]>('/api/v1/sports/leagues');
}

export function fetchLeagueFixtures(league: string) {
  const params = new URLSearchParams({ league, limit: '6' });
  return apiGet<SportsFixture[]>(`/api/v1/sports/fixtures?${params.toString()}`);
}
