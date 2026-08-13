import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  configureApiAuthHandlers,
  fetchCurrentUser,
  placeMarketOrder,
} from '@/lib/api';
import {
  clearPendingProfile,
  readPendingProfile,
  storePendingProfile,
} from '@/lib/supabase';

describe('central API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    configureApiAuthHandlers({});
  });

  it('dispatches a centralized unauthorized response with its request id', async () => {
    const unauthorized = vi.fn();
    configureApiAuthHandlers({ onUnauthorized: unauthorized });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Session expired', request_id: 'request-123' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    const error = await fetchCurrentUser('expired-token').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, requestId: 'request-123', retryable: false });
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('sends the caller-owned idempotency key unchanged', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 4,
      player_id: 2,
      side: 'BUY',
      quantity: 3,
      status: 'FILLED',
      failure_reason: null,
      created_at: '2026-01-01T00:00:00Z',
      execution_price: 10,
      executed_total: 30,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await placeMarketOrder('token', 'buy', 'HA9', 3, 'intent-key');

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(typeof options.body).toBe('string');
    const parsed: unknown = typeof options.body === 'string' ? JSON.parse(options.body) : null;
    expect(parsed).toEqual({
      symbol: 'HA9', quantity: 3, idempotency_key: 'intent-key',
    });
  });
});

describe('pending Supabase profile storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('uses expiring session storage and never duplicates profile data in localStorage', () => {
    storePendingProfile({ date_of_birth: '1990-01-01', username: 'field_user' });
    expect(readPendingProfile()).toEqual({ date_of_birth: '1990-01-01', username: 'field_user' });
    expect(window.localStorage.length).toBe(0);
    clearPendingProfile();
    expect(readPendingProfile()).toBeNull();
  });

  it('cleans expired pending profile state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    storePendingProfile({ date_of_birth: '1990-01-01' });
    vi.setSystemTime(new Date('2026-01-01T00:31:00Z'));
    expect(readPendingProfile()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });
});
