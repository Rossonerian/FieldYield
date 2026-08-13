import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@/data/fieldyield';
import type { ApiOrder } from '@/lib/api';

const placeOrder = vi.hoisted(() => vi.fn<(
  token: string,
  side: 'buy' | 'sell',
  symbol: string,
  quantity: number,
  idempotencyKey: string,
) => Promise<ApiOrder>>());
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  placeMarketOrder: placeOrder,
}));

import { TradingDialogs } from '@/features/trading/TradingDialogs';

const player: Player = {
  ticker: 'HA9', name: 'Test Player', club: 'Test FC', league: 'EPL', price: 122,
  change: 1, volume: '10', yield: null, owned: 2, status: 'Open', photo: 'TP',
};
const filled = {
  id: 1, player_id: 1, side: 'BUY' as const, quantity: 1, status: 'FILLED',
  failure_reason: null, created_at: '2026-01-01T00:00:00Z', execution_price: 122, executed_total: 122,
};

describe('trading dialogs', () => {
  beforeEach(() => placeOrder.mockReset());

  it('opens global wallet and dividend dialogs without a selected asset', () => {
    const { rerender } = render(<TradingDialogs modal="coins" player={null} close={vi.fn()} token="token" onSuccess={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Wallet' })).toBeInTheDocument();
    rerender(<TradingDialogs modal="dividend" player={null} close={vi.fn()} token="token" onSuccess={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Dividend Feed' })).toBeInTheDocument();
  });

  it('keeps an order key stable across retry and refreshes after success', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    placeOrder.mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValueOnce(filled);
    render(<TradingDialogs modal="buy" player={player} close={vi.fn()} token="token" onSuccess={refresh} />);

    await user.click(screen.getByRole('button', { name: 'Confirm Buy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network interrupted');
    await user.click(screen.getByRole('button', { name: 'Confirm Buy' }));
    await screen.findByText(/authoritative total/i);

    expect(placeOrder).toHaveBeenCalledTimes(2);
    expect(placeOrder.mock.calls[0]?.[4]).toBe(placeOrder.mock.calls[1]?.[4]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('generates a new key when the quantity changes', async () => {
    const user = userEvent.setup();
    placeOrder.mockRejectedValueOnce(new Error('Try again')).mockResolvedValueOnce({ ...filled, side: 'SELL', quantity: 2 });
    render(<TradingDialogs modal="sell" player={player} close={vi.fn()} token="token" onSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Confirm Sell' }));
    await screen.findByRole('alert');
    const firstKey = placeOrder.mock.calls[0]?.[4];
    const input = screen.getByLabelText('Shares');
    await user.clear(input);
    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: 'Confirm Sell' }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2));
    expect(placeOrder.mock.calls[1]?.[4]).not.toBe(firstKey);
  });
});
