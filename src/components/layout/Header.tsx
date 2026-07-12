import { Bell, ChevronDown } from 'lucide-react';

import { ActionSearchBar, type SearchItem } from '@/features/search/ActionSearchBar';
import { AlertBadge } from '@/components/ui/alert-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from '@/features/theme/ThemeSwitch';
import { cn } from '@/lib/utils';

export type HeaderProps = {
  searchItems: SearchItem[];
  onBalance: () => void;
  onBell: () => void;
  onBrandClick?: () => void;
  onProfile?: () => void;
  notificationCount?: number;
  className?: string;
};

export function Header({
  searchItems,
  onBalance,
  onBell,
  onBrandClick,
  onProfile,
  notificationCount = 6,
  className,
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
        aria-label="Open currency balances: 12,480 Gold and 860 Silver"
      >
        <span aria-hidden="true">◈</span> 12,480 <span>Gold</span>
        <span aria-hidden="true">· ◇</span> 860 <span>Silver</span>
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className="fy-app-header-notifications overflow-visible"
        onClick={onBell}
        aria-label={`Open notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
      >
        <Bell size={19} aria-hidden="true" />
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
          aria-label="Open profile for Rosso Trader, online, Pro plan"
        >
          <Avatar name="Rosso Trader" fallback="RT" status="online" size="sm" />
          <span className="fy-app-header-profile-copy">
            <span className="fy-app-header-profile-name sr-only">Rosso Trader</span>
            <span aria-hidden="true">Pro</span>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
