import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AlertBadge, type AlertState } from '@/components/ui/alert-badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { players, type AssetVariant, type Player } from '@/data/fieldyield';
import { fetchNotifications } from '@/lib/api';

type Notification = {
  id: string;
  label: string;
  status: AlertState;
  text: string;
  variant: AssetVariant;
};

export function NotificationDrawer({ open, close, openAsset, token }: { open: boolean; close: () => void; openAsset: (player: Player, variant: AssetVariant) => void; token: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchNotifications(token).then((items) => setNotifications(items.map((item) => ({ id: String(item.id), label: item.kind.replaceAll('_', ' '), status: item.kind.includes('failed') ? 'critical' : item.kind.includes('filled') || item.kind.includes('credit') ? 'success' : 'informational', text: item.message, variant: 'normal' })))).catch(() => setNotifications([]));
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
            const player = players.find((entry) => notification.text.includes(entry.ticker));
            return <NotificationItem key={notification.id} status={notification.status} label={notification.label} onClick={() => { if (player) openAsset(player, notification.variant); }}>{notification.text}</NotificationItem>;
          })}
        </div>
      </aside>
    </BlurFade>
  );
}

export function NotificationItem({ status, label, onClick, children }: { status: AlertState; label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="fy-notification-item" onClick={onClick}><AlertBadge status={status}>{label}</AlertBadge><strong>{children}</strong><span>4m ago</span></button>;
}
