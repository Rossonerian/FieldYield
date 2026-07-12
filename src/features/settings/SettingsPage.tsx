import { useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/shared/field-components';

const sections = ['Account', 'Subscription', 'Notifications', 'Security', 'Legal & Terms'];

export function SettingsPage() {
  const [section, setSection] = useState('Account');

  return (
    <div className="fy-screen fy-settings-screen">
      <BlurFade><h1 className="fy-page-title">Settings</h1></BlurFade>
      <BlurFade><GlassCard className="fy-settings-nav" role="navigation" aria-label="Settings sections">{sections.map((entry) => <Button variant="filter" aria-pressed={entry === section} onClick={() => setSection(entry)} key={entry}>{entry}</Button>)}</GlassCard></BlurFade>
      <BlurFade delay={0.08}><GlassCard className="fy-settings-panel">
        <h2>{section}</h2>
        {section === 'Account' && <>
          <label className="fy-field-label">Display name <Input defaultValue="Rosso Trader" /></label>
          <label className="fy-field-label">Email <Input type="email" defaultValue="rosso@example.com" /></label>
          <h3>Security</h3><div className="fy-toggle-row">2FA <Badge variant="success">Enabled</Badge><Button size="sm" variant="secondary">Manage</Button></div>
          <h3>Subscription</h3><div className="fy-toggle-row">Current tier <Badge variant="warning">Pro</Badge><Button size="sm">Upgrade</Button><Button size="sm" variant="neutral">Cancel</Button></div>
          <h3>Wallet & Currency</h3><div className="fy-toggle-row">Gold ◈12,480 · Silver ◇860 <Button size="sm">Add Funds</Button></div>
        </>}
        {section === 'Notifications' && <>{['Circuit breaker alerts', 'Dividend credited', 'League closure warnings', 'Price alerts', 'Weekly digest'].map((entry) => <label className="fy-toggle-row" key={entry}>{entry}<input type="checkbox" defaultChecked /></label>)}</>}
        {section === 'Subscription' && <p>Current plan: Pro. Manage the existing FieldYield subscription preferences here.</p>}
        {section === 'Security' && <p>Two-factor authentication is enabled for this frontend profile.</p>}
        {section === 'Legal & Terms' && <p>Closed-loop virtual currency disclosure · Terms · Privacy · FAQ</p>}
      </GlassCard></BlurFade>
    </div>
  );
}
