import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  removeWatchlist: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  markNotificationRead: apiMocks.markNotificationRead,
  removeWatchlist: apiMocks.removeWatchlist,
}));

import { NotificationDrawer } from '@/features/notifications/NotificationDrawer';
import { Watchlist } from '@/features/watchlist/Watchlist';

describe('server-backed account mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reconciles notification state after a successful read mutation', async () => {
    const onRead = vi.fn().mockResolvedValue(undefined);
    apiMocks.markNotificationRead.mockResolvedValue({});
    render(
      <NotificationDrawer
        open
        close={vi.fn()}
        token="token"
        notifications={[{ id: 7, kind: 'order_filled', message: 'Order filled safely', read: false, created_at: '2026-01-01T00:00:00Z' }]}
        onRead={onRead}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Order filled safely/ }));

    expect(apiMocks.markNotificationRead).toHaveBeenCalledWith('token', 7);
    expect(onRead).toHaveBeenCalledOnce();
  });

  it('removes a watchlist entry and refreshes authoritative state', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    apiMocks.removeWatchlist.mockResolvedValue(undefined);
    render(
      <Watchlist
        setScreen={vi.fn()}
        token="token"
        watched={[{
          id: 3,
          symbol: 'HA9',
          name: 'Test Player',
          league: 'EPL',
          club: 'Test FC',
          bid: 120,
          ask: 122,
          updated_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        }]}
        refresh={refresh}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove Test Player from watchlist' }));

    expect(apiMocks.removeWatchlist).toHaveBeenCalledWith('token', 'HA9');
    expect(refresh).toHaveBeenCalledOnce();
  });
});
