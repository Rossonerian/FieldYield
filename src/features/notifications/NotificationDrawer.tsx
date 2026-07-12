import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AlertBadge, type AlertState } from '@/components/ui/alert-badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { players, type AssetVariant, type Player } from '@/data/fieldyield';

type Notification = {
  id: string;
  label: string;
  status: AlertState;
  text: string;
  variant: AssetVariant;
};

const notifications: Notification[] = [
  { id: 'circuit-mb10', label: 'Critical', status: 'critical', text: 'Circuit breaker active on MB10', variant: 'circuit' },
  { id: 'dividend-ha9', label: 'Success', status: 'success', text: 'Dividend credited on HA9', variant: 'normal' },
  { id: 'price-sa7', label: 'New', status: 'new', text: 'Price alert: SA7 crossed ◈190', variant: 'normal' },
  { id: 'schedule-gw23', label: 'Information', status: 'informational', text: 'GW 23 market closure schedule posted', variant: 'normal' },
];

export function NotificationDrawer({ open, close, openAsset }: { open: boolean; close: () => void; openAsset: (player: Player, variant: AssetVariant) => void }) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    window.requestAnimationFrame(() => drawerRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [close, open]);

  if (!open) return null;

  return (
    <BlurFade className="fy-notification-motion" yOffset={0} blur={5}>
      <aside ref={drawerRef} tabIndex={-1} className="fy-notification-drawer" role="dialog" aria-modal="false" aria-labelledby={titleId}>
        <div className="fy-notification-header"><div><h2 id={titleId}>Notifications</h2><span>{notifications.length} unread updates</span></div><AlertBadge status="new" count={notifications.length} /><Button size="icon-sm" variant="ghost" onClick={close} aria-label="Close notifications"><X /></Button></div>
        <div className="fy-notification-list">
          {notifications.map((notification) => {
            const player = players.find((entry) => notification.text.includes(entry.ticker)) ?? players[0];
            return <NotificationItem key={notification.id} status={notification.status} label={notification.label} onClick={() => openAsset(player, notification.variant)}>{notification.text}</NotificationItem>;
          })}
        </div>
      </aside>
    </BlurFade>
  );
}

export function NotificationItem({ status, label, onClick, children }: { status: AlertState; label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="fy-notification-item" onClick={onClick}><AlertBadge status={status}>{label}</AlertBadge><strong>{children}</strong><span>4m ago</span></button>;
}
