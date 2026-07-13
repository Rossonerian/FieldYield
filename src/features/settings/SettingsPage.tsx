import { useEffect, useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/shared/field-components';
import { updateCurrentUser, type CurrentUser } from '@/lib/api';

const sections = ['Account', 'Subscription', 'Notifications', 'Security', 'Legal & Terms'];

export function SettingsPage({ token, user, onUpdated }: { token: string; user: CurrentUser; onUpdated: (user: CurrentUser) => void }) {
  const [section, setSection] = useState('Account');
  const [form, setForm] = useState({ username: user.username ?? '', first_name: user.first_name ?? '', last_name: user.last_name ?? '', country: user.country ?? '' });
  const [status, setStatus] = useState('');
  useEffect(() => setForm({ username: user.username ?? '', first_name: user.first_name ?? '', last_name: user.last_name ?? '', country: user.country ?? '' }), [user]);
  async function save() { setStatus('Saving…'); try { const payload = { ...form, username: form.username.trim() || undefined, first_name: form.first_name.trim() || undefined, last_name: form.last_name.trim() || undefined, country: form.country.trim() || undefined }; onUpdated(await updateCurrentUser(token, payload)); setStatus('Profile saved.'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save profile.'); } }

  return (
    <div className="fy-screen fy-settings-screen">
      <BlurFade><h1 className="fy-page-title">Settings</h1></BlurFade>
      <BlurFade><GlassCard className="fy-settings-nav" role="navigation" aria-label="Settings sections">{sections.map((entry) => <Button variant="filter" aria-pressed={entry === section} onClick={() => setSection(entry)} key={entry}>{entry}</Button>)}</GlassCard></BlurFade>
      <BlurFade delay={0.08}><GlassCard className="fy-settings-panel">
        <h2>{section}</h2>
        {section === 'Account' && <>
          <label className="fy-field-label">Username <Input maxLength={32} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="fy-field-label">First name <Input maxLength={80} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
          <label className="fy-field-label">Last name <Input maxLength={80} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
          <label className="fy-field-label">Country <Input maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} /></label>
          <label className="fy-field-label">Email <Input type="email" value={user.email} readOnly /></label>
          <p className="fy-muted">Member since {new Date(user.created_at).toLocaleDateString()}</p>
          <p className="fy-muted">Age verification: {user.age_verified ? 'Verified' : 'Required'}</p>
          {status && <p role="status" className="fy-muted">{status}</p>}
          <Button onClick={save}>Save profile</Button>
        </>}
        {section === 'Notifications' && <p>Notification preferences will appear here when configured for your account.</p>}
        {section === 'Subscription' && <p>No subscription data is associated with this account.</p>}
        {section === 'Security' && <p>Your account uses server-validated bearer-token authentication.</p>}
        {section === 'Legal & Terms' && <p>Closed-loop virtual currency disclosure · Terms · Privacy · FAQ</p>}
      </GlassCard></BlurFade>
    </div>
  );
}
