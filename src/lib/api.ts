const configuredApiBase: string | undefined = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = configuredApiBase?.replace(/\/$/, '') ?? '';
const DEFAULT_TIMEOUT_MS = 10_000;

export type AuthToken = { access_token: string; token_type: string };
export type CurrentUser = {
  id: number; email: string; username: string | null; first_name: string | null; last_name: string | null;
  country: string | null; avatar_url: string | null; date_of_birth: string; age_verified: boolean;
  created_at: string; updated_at: string; account_status: string; role: string; auth_provider: string;
  preferred_currency: 'gold' | 'silver'; preferences: Record<string, unknown>; signup_bonus_awarded: boolean;
};
export type Wallet = { gold: number; silver: number };
export type ProfileSummary = Wallet & { holdings_count: number; portfolio_market_value: number; portfolio_cost_basis: number; unrealized_pnl: number; realized_pnl: number; orders_count: number; transactions_count: number; unread_notifications: number };
export type WatchlistEntry = { id: number; symbol: string; name: string; league: string; club: string; bid: number; ask: number; updated_at: string; created_at: string };
export type MarketPlayer = { symbol: string; name: string; league: string; club: string; active: boolean; bid: number; ask: number; updated_at: string; source: string };
export type WalletTransaction = { id: number; currency: string; amount: number; reason: string; created_at: string };
export type ApiOrder = { id: number; player_id: number; side: 'BUY' | 'SELL'; quantity: number; status: string; failure_reason: string | null; created_at: string; execution_price?: number | null; executed_total?: number | null };
export type SquadEntry = { id: number; player_id: number; position: number; symbol: string; name: string; club: string; league: string };
export type ReserveSquadEntry = { player_id: number; symbol: string; name: string; club: string; league: string; quantity: number };
export type SquadState = { active: SquadEntry[]; reserve: ReserveSquadEntry[]; active_capacity: number; reserve_capacity: number };
export type HoldingEntry = { symbol: string; name: string; league: string; club: string; quantity: number; average_cost: number; realized_pnl: number; market_price: number; market_value: number };
export type AdminUser = { id: number; email: string; username: string | null; account_status: string; role: string; created_at: string; signup_bonus_awarded: boolean; wallet_gold: number; wallet_silver: number };
export type NotificationEntry = { id: number; kind: string; message: string; read: boolean; created_at: string };
export type SignupBonusSync = { granted_now: boolean; already_granted: boolean; gold?: number | null; silver?: number | null };
export type SupabaseSyncResponse = { status: 'profile_incomplete' | 'ready'; user: CurrentUser | null; required_fields: string[]; bonus?: SignupBonusSync | null };

export class ApiError extends Error {
  status: number;
  requestId?: string;
  retryable: boolean;

  constructor(status: number, detail: unknown, fallback: string, requestId?: string) {
    const message = typeof detail === 'object' && detail && 'detail' in detail ? String((detail as { detail?: unknown }).detail) : fallback;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = status === 408 || status === 429 || status >= 500;
    const bodyRequestId = typeof detail === 'object' && detail && 'request_id' in detail ? (detail as { request_id?: unknown }).request_id : undefined;
    this.requestId = typeof bodyRequestId === 'string' ? bodyRequestId : requestId;
  }
}

let unauthorizedHandler: (() => void) | null = null;
let forbiddenHandler: ((error: ApiError) => void) | null = null;

export function configureApiAuthHandlers(handlers: { onUnauthorized?: () => void; onForbidden?: (error: ApiError) => void }) {
  unauthorizedHandler = handlers.onUnauthorized ?? null;
  forbiddenHandler = handlers.onForbidden ?? null;
  return () => { unauthorizedHandler = null; forbiddenHandler = null; };
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; token?: string; signal?: AbortSignal; timeoutMs?: number };

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail: unknown = await response.json().catch(() => null);
      const error = new ApiError(response.status, detail, `Request failed with ${response.status}`, response.headers.get('x-request-id') ?? undefined);
      if (options.token && response.status === 401) unauthorizedHandler?.();
      if (options.token && response.status === 403) forbiddenHandler?.(error);
      throw error;
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof ApiError)) {
      throw new ApiError(408, null, options.signal?.aborted ? 'Request was cancelled.' : 'Request timed out. Please retry.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function registerUser(email: string, password: string, dateOfBirth: string, username?: string) {
  return apiRequest<{ id: number; email: string; signup_bonus_awarded: boolean }>('/api/v1/auth/register', { method: 'POST', body: { email, password, date_of_birth: dateOfBirth, username: username || undefined } });
}
export function loginUser(email: string, password: string) { return apiRequest<AuthToken>('/api/v1/auth/login', { method: 'POST', body: { email, password } }); }
export function syncSupabaseUser(token: string, body: { date_of_birth?: string; username?: string; first_name?: string; last_name?: string }, signal?: AbortSignal) { return apiRequest<SupabaseSyncResponse>('/api/v1/auth/supabase-sync', { method: 'POST', body, token, signal }); }
export function fetchCurrentUser(token: string, signal?: AbortSignal) { return apiRequest<CurrentUser>('/api/v1/users/me', { token, signal }); }
export function updateCurrentUser(token: string, body: Partial<Pick<CurrentUser, 'username' | 'first_name' | 'last_name' | 'country' | 'avatar_url' | 'preferred_currency' | 'preferences'>>, signal?: AbortSignal) { return apiRequest<CurrentUser>('/api/v1/users/me', { method: 'PATCH', body, token, signal }); }
export function fetchWallet(token: string, signal?: AbortSignal) { return apiRequest<Wallet>('/api/v1/wallet', { token, signal }); }
export function fetchWalletLedger(token: string, signal?: AbortSignal) { return apiRequest<WalletTransaction[]>('/api/v1/wallet/ledger?limit=50', { token, signal }); }
export function fetchProfileSummary(token: string, signal?: AbortSignal) { return apiRequest<ProfileSummary>('/api/v1/users/me/summary', { token, signal }); }
export function fetchMarketPlayers(signal?: AbortSignal) { return apiRequest<MarketPlayer[]>('/api/v1/market/prices', { signal }); }
export function fetchOrders(token: string, signal?: AbortSignal) { return apiRequest<ApiOrder[]>('/api/v1/trading/orders?limit=50', { token, signal }); }
export function fetchHoldings(token: string, signal?: AbortSignal) { return apiRequest<HoldingEntry[]>('/api/v1/portfolio/holdings', { token, signal }); }
export function fetchSquad(token: string, signal?: AbortSignal) { return apiRequest<SquadEntry[]>('/api/v1/squad', { token, signal }); }
export function fetchSquadState(token: string, signal?: AbortSignal) { return apiRequest<SquadState>('/api/v1/squad/state', { token, signal }); }
export function promoteSquad(token: string, symbol: string) { return apiRequest<{ status: string }>('/api/v1/squad/promote', { method: 'POST', body: { symbol }, token }); }
export function demoteSquad(token: string, symbol: string) { return apiRequest<{ status: string }>('/api/v1/squad/demote', { method: 'POST', body: { symbol }, token }); }
export function placeMarketOrder(token: string, side: 'buy' | 'sell', symbol: string, quantity: number, idempotencyKey: string) { return apiRequest<ApiOrder>(`/api/v1/trading/orders/market-${side}`, { method: 'POST', body: { symbol, quantity, idempotency_key: idempotencyKey }, token }); }
export function creditTestWallet(token: string, currency: 'gold' | 'silver', amount: number, idempotencyKey: string) { return apiRequest<Wallet>('/api/v1/wallet/credit', { method: 'POST', body: { currency, amount, idempotency_key: idempotencyKey }, token }); }
export function fetchAdminUsers(token: string, search = '') { return apiRequest<AdminUser[]>(`/api/v1/admin/users?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`, { token }); }
export function updateAdminUserStatus(token: string, userId: number, accountStatus: 'active' | 'suspended') { return apiRequest<AdminUser>(`/api/v1/admin/users/${userId}/status`, { method: 'PATCH', body: { account_status: accountStatus }, token }); }
export function importCatalog(token: string, source: string, records: Array<{ symbol: string; name: string; league: string; club?: string; bid: number; ask: number; active?: boolean }>) { return apiRequest<{ source: string; created: number; updated: number; total: number }>('/api/v1/admin/catalog/import', { method: 'POST', body: { source, records }, token, timeoutMs: 20_000 }); }
export function fetchNotifications(token: string, signal?: AbortSignal) { return apiRequest<NotificationEntry[]>('/api/v1/notifications?limit=50', { token, signal }); }
export function markNotificationRead(token: string, notificationId: number) { return apiRequest<NotificationEntry>(`/api/v1/notifications/${notificationId}/read`, { method: 'POST', body: {}, token }); }
export function fetchWatchlist(token: string, signal?: AbortSignal) { return apiRequest<WatchlistEntry[]>('/api/v1/watchlists', { token, signal }); }
export function addWatchlist(token: string, symbol: string) { return apiRequest<WatchlistEntry>('/api/v1/watchlists', { method: 'POST', body: { symbol }, token }); }
export function removeWatchlist(token: string, symbol: string) { return apiRequest<void>(`/api/v1/watchlists/${encodeURIComponent(symbol)}`, { method: 'DELETE', token }); }
