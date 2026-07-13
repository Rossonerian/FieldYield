import { ChevronDown } from 'lucide-react';
import { BellIcon } from '@/components/ui/bell';

import { ActionSearchBar, type SearchItem } from '@/features/search/ActionSearchBar';
import { AlertBadge } from '@/components/ui/alert-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { AnimatedIcon } from '@/components/ui/animated-icon';
import { ThemeSwitch } from '@/features/theme/ThemeSwitch';
import { cn } from '@/lib/utils';
import type { CurrentUser, Wallet } from '@/lib/api';

export type HeaderProps = {
  searchItems: SearchItem[];
  onBalance: () => void;
  onBell: () => void;
  onBrandClick?: () => void;
  onProfile?: () => void;
  notificationCount?: number;
  className?: string;
  wallet?: Wallet | null;
  user?: CurrentUser | null;
};

export function Header({
  searchItems,
  onBalance,
  onBell,
  onBrandClick,
  onProfile,
  notificationCount = 6,
  className,
  wallet,
  user,
}: HeaderProps) {
  const handleBrandClick = () => {
    if (onBrandClick) {
      onBrandClick();
      return;
    }

    if (typeof window !== 'undefined') window.location.reload();
  };

  return (
    <header className={cn('fy-app-header', className)}>
      <Button
        variant="ghost"
        className="fy-app-header-wordmark"
        onClick={handleBrandClick}
        aria-label="FieldYield home"
      >
        FieldYield
      </Button>

      <ActionSearchBar items={searchItems} />

      <Button
        variant="secondary"
        className="fy-app-header-balance"
        onClick={onBalance}
        aria-label={`Open currency balances: ${wallet?.gold ?? 0} Gold and ${wallet?.silver ?? 0} Silver`}
      >
        <CurrencyIcon kind="gold" /> {wallet?.gold ?? 0} <span>Gold</span>
        <span aria-hidden="true" className="fy-balance-divider">·</span>
        <CurrencyIcon kind="silver" /> {wallet?.silver ?? 0} <span>Silver</span>
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className="fy-app-header-notifications overflow-visible"
        onClick={onBell}
        aria-label={`Open notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
      >
        <AnimatedIcon icon={BellIcon} size={19} aria-hidden="true" />
        {notificationCount > 0 && (
          <AlertBadge
            className="fy-app-header-notification-count"
            status="new"
            count={notificationCount}
          />
        )}
      </Button>

      <div className="fy-app-header-account flex items-center justify-end gap-2">
        <ThemeSwitch />
        <Button
          variant="ghost"
          className="fy-app-header-profile"
          onClick={onProfile}
          aria-label={`Open profile for ${user?.username || user?.email || 'your account'}`}
        >
          <Avatar name={user?.username || user?.email || 'Account'} fallback={(user?.username || user?.email || 'A').slice(0, 2).toUpperCase()} status="online" size="sm" />
          <span className="fy-app-header-profile-copy">
            <span className="fy-app-header-profile-name sr-only">{user?.username || user?.email}</span>
            <span aria-hidden="true">{user?.account_status || 'Active'}</span>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
