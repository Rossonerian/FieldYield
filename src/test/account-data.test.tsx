import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requests = vi.hoisted(() => ({
  wallet: vi.fn(),
  summary: vi.fn(),
  holdings: vi.fn(),
  orders: vi.fn(),
  squad: vi.fn(),
  watchlist: vi.fn(),
  notifications: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchWallet: requests.wallet,
  fetchProfileSummary: requests.summary,
  fetchHoldings: requests.holdings,
  fetchOrders: requests.orders,
  fetchSquadState: requests.squad,
  fetchWatchlist: requests.watchlist,
  fetchNotifications: requests.notifications,
}));

import { useAccountData } from '@/app/useAccountData';

describe('account data refresh', () => {
  beforeEach(() => {
    for (const request of Object.values(requests)) request.mockReset();
    requests.wallet.mockRejectedValue(new Error('Wallet unavailable'));
    requests.summary.mockResolvedValue({ gold: 0, silver: 0 });
    requests.holdings.mockResolvedValue([{ symbol: 'HA9', quantity: 2 }]);
    requests.orders.mockResolvedValue([{ id: 1 }]);
    requests.squad.mockResolvedValue({ active: [], reserve: [], active_capacity: 25, reserve_capacity: 15 });
    requests.watchlist.mockResolvedValue([{ id: 2, symbol: 'SA7' }]);
    requests.notifications.mockResolvedValue([{ id: 3, read: false }]);
  });

  it('preserves successful resources when another resource fails', async () => {
    const { result } = renderHook(() => useAccountData('token', true));

    await waitFor(() => expect(result.current.errors.wallet).toBe('Wallet unavailable'));
    expect(result.current.wallet).toBeNull();
    expect(result.current.holdings).toEqual([{ symbol: 'HA9', quantity: 2 }]);
    expect(result.current.orders).toEqual([{ id: 1 }]);
    expect(result.current.watchlist).toEqual([{ id: 2, symbol: 'SA7' }]);
    expect(result.current.notifications).toEqual([{ id: 3, read: false }]);
  });
});
