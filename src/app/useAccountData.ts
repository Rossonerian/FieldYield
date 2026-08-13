import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchHoldings,
  fetchNotifications,
  fetchOrders,
  fetchProfileSummary,
  fetchSquadState,
  fetchWallet,
  fetchWatchlist,
  type ApiOrder,
  type HoldingEntry,
  type NotificationEntry,
  type ProfileSummary,
  type SquadState,
  type Wallet,
  type WatchlistEntry,
} from '@/lib/api';

export type AccountResource = 'wallet' | 'summary' | 'holdings' | 'orders' | 'squad' | 'watchlist' | 'notifications';
const ALL_RESOURCES: AccountResource[] = ['wallet', 'summary', 'holdings', 'orders', 'squad', 'watchlist', 'notifications'];

export function useAccountData(token: string | null, enabled: boolean) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [holdings, setHoldings] = useState<HoldingEntry[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [squad, setSquad] = useState<SquadState>({ active: [], reserve: [], active_capacity: 25, reserve_capacity: 15 });
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [errors, setErrors] = useState<Partial<Record<AccountResource, string>>>({});
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async (resources: AccountResource[] = ALL_RESOURCES) => {
    if (!token) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const loaders: Record<AccountResource, () => Promise<unknown>> = {
      wallet: () => fetchWallet(token, controller.signal),
      summary: () => fetchProfileSummary(token, controller.signal),
      holdings: () => fetchHoldings(token, controller.signal),
      orders: () => fetchOrders(token, controller.signal),
      squad: () => fetchSquadState(token, controller.signal),
      watchlist: () => fetchWatchlist(token, controller.signal),
      notifications: () => fetchNotifications(token, controller.signal),
    };
    const settled = await Promise.allSettled(resources.map((resource) => loaders[resource]()));
    if (controller.signal.aborted) return;
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      settled.forEach((result, index) => {
        const resource = resources[index];
        if (result.status === 'rejected') nextErrors[resource] = result.reason instanceof Error ? result.reason.message : `Could not refresh ${resource}.`;
        else delete nextErrors[resource];
      });
      return nextErrors;
    });
    settled.forEach((result, index) => {
      const resource = resources[index];
      if (result.status === 'rejected') return;
      if (resource === 'wallet') setWallet(result.value as Wallet);
      if (resource === 'summary') setSummary(result.value as ProfileSummary);
      if (resource === 'holdings') setHoldings(result.value as HoldingEntry[]);
      if (resource === 'orders') setOrders(result.value as ApiOrder[]);
      if (resource === 'squad') setSquad(result.value as SquadState);
      if (resource === 'watchlist') setWatchlist(result.value as WatchlistEntry[]);
      if (resource === 'notifications') setNotifications(result.value as NotificationEntry[]);
    });
  }, [token]);

  useEffect(() => {
    if (enabled) void refresh();
    return () => controllerRef.current?.abort();
  }, [enabled, refresh]);

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    setWallet(null); setSummary(null); setHoldings([]); setOrders([]);
    setSquad({ active: [], reserve: [], active_capacity: 25, reserve_capacity: 15 });
    setWatchlist([]); setNotifications([]); setErrors({});
  }, []);

  return { wallet, summary, holdings, orders, squad, watchlist, notifications, errors, refresh, clear };
}
