import {
  ChartNoAxesCombined,
  Gauge,
  Settings,
  Star,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

export type NavigationId =
  | 'dashboard'
  | 'markets'
  | 'portfolio'
  | 'squad'
  | 'watchlist'
  | 'settings';

export type NavigationItem = {
  id: NavigationId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: Gauge },
  { id: 'markets', label: 'Markets', shortLabel: 'Markets', icon: ChartNoAxesCombined },
  { id: 'portfolio', label: 'Portfolio', shortLabel: 'Portfolio', icon: WalletCards },
  { id: 'squad', label: 'Squad', shortLabel: 'Squad', icon: Users },
  { id: 'watchlist', label: 'Watchlist', shortLabel: 'Watch', icon: Star },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
] as const satisfies readonly NavigationItem[];

export const primaryNavigationItems = navigationItems.filter((item) => item.id !== 'settings');
export const settingsNavigationItem = navigationItems.find((item) => item.id === 'settings');
