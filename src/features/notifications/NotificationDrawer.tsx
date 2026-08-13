import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AlertBadge, type AlertState } from '@/components/ui/alert-badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { markNotificationRead, type NotificationEntry } from '@/lib/api';

export function NotificationDrawer({ open, close, token, notifications, onRead }: { open: boolean; close: () => void; token: string; notifications: NotificationEntry[]; onRead: () => Promise<void> }) {
  const [error, setError] = useState('');
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    window.requestAnimationFrame(() => drawerRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus.current?.focus(); };
  }, [close, open]);
  if (!open) return null;
  const unread = notifications.filter((entry) => !entry.read).length;
  return <BlurFade className="fy-notification-motion" yOffset={0} blur={5}><aside ref={drawerRef} tabIndex={-1} className="fy-notification-drawer" aria-labelledby={titleId}>
    <div className="fy-notification-header"><div><h2 id={titleId}>Notifications</h2><span>{unread} unread updates</span></div><AlertBadge status="new" count={unread} /><Button size="icon-sm" variant="ghost" onClick={close} aria-label="Close notifications"><X /></Button></div>
    {error && <p className="fy-auth-error" role="alert">{error}</p>}
    <div className="fy-notification-list">{notifications.map((notification) => <NotificationItem key={notification.id} status={notification.kind.includes('failed') ? 'critical' : notification.kind.includes('filled') || notification.kind.includes('credit') ? 'success' : 'informational'} label={notification.kind.replaceAll('_', ' ')} onClick={notification.read ? undefined : () => { void markNotificationRead(token, notification.id).then(onRead).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not mark notification as read.')); }}>{notification.message}</NotificationItem>)}</div>
  </aside></BlurFade>;
}

export function NotificationItem({ status, label, onClick, children }: { status: AlertState; label: string; onClick?: () => void; children: ReactNode }) {
  const content = <><AlertBadge status={status}>{label}</AlertBadge><strong>{children}</strong><span>Recorded update</span></>;
  return onClick ? <button type="button" className="fy-notification-item" onClick={onClick}>{content}</button> : <div className="fy-notification-item fy-notification-item-static">{content}</div>;
}
