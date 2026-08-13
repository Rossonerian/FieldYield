import { useEffect, useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/shared/field-components';
import { fetchAdminUsers, updateAdminUserStatus, updateCurrentUser, type AdminUser, type CurrentUser } from '@/lib/api';

const sections = ['Account', 'Subscription', 'Notifications', 'Security', 'Legal & Terms'];

export function SettingsPage({ token, user, onUpdated, onLogout }: { token: string; user: CurrentUser; onUpdated: (user: CurrentUser) => void; onLogout: () => void }) {
  const [section, setSection] = useState('Account');
  const [form, setForm] = useState({ username: user.username ?? '', first_name: user.first_name ?? '', last_name: user.last_name ?? '', country: user.country ?? '' });
  const [status, setStatus] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminError, setAdminError] = useState('');
  useEffect(() => setForm({ username: user.username ?? '', first_name: user.first_name ?? '', last_name: user.last_name ?? '', country: user.country ?? '' }), [user]);
  async function save() { setStatus('Saving…'); try { const payload = { ...form, username: form.username.trim() || undefined, first_name: form.first_name.trim() || undefined, last_name: form.last_name.trim() || undefined, country: form.country.trim() || undefined }; onUpdated(await updateCurrentUser(token, payload)); setStatus('Profile saved.'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save profile.'); } }
  async function loadAdminUsers() { setAdminError(''); try { setAdminUsers(await fetchAdminUsers(token)); } catch (error) { setAdminError(error instanceof Error ? error.message : 'Could not load users.'); } }

  return (
    <div className="fy-screen fy-settings-screen">
      <BlurFade><h1 className="fy-page-title">Settings</h1></BlurFade>
      <BlurFade><GlassCard className="fy-settings-nav" role="navigation" aria-label="Settings sections">{sections.map((entry) => <Button variant="filter" aria-pressed={entry === section} onClick={() => setSection(entry)} key={entry}>{entry}</Button>)}</GlassCard></BlurFade>
      <BlurFade delay={0.08}><GlassCard className="fy-settings-panel">
        <h2>{section}</h2>
        {section === 'Account' && <>
          <label className="fy-field-label" htmlFor="settings-username">Username <Input id="settings-username" maxLength={32} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="fy-field-label" htmlFor="settings-first-name">First name <Input id="settings-first-name" maxLength={80} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
          <label className="fy-field-label" htmlFor="settings-last-name">Last name <Input id="settings-last-name" maxLength={80} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
          <label className="fy-field-label" htmlFor="settings-country">Country <Input id="settings-country" maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} /></label>
          <label className="fy-field-label" htmlFor="settings-email">Email <Input id="settings-email" type="email" value={user.email} readOnly /></label>
          <p className="fy-muted">Member since {new Date(user.created_at).toLocaleDateString()}</p>
          <p className="fy-muted">Age verification: {user.age_verified ? 'Verified' : 'Required'}</p>
          <p className="fy-muted">Signup bonus: {user.signup_bonus_awarded ? 'Granted once' : 'Not granted'}</p>
          {status && <p role="status" className="fy-muted">{status}</p>}
          <Button onClick={save}>Save profile</Button><Button variant="danger" onClick={onLogout}>Sign out</Button>
        </>}
        {section === 'Notifications' && <p>No notification preference records are configured for this account.</p>}
        {section === 'Subscription' && <p>No subscription data is associated with this account.</p>}
        {section === 'Security' && <p>Your account uses server-validated bearer-token authentication.</p>}
        {section === 'Legal & Terms' && <p>Closed-loop virtual currency disclosure · Terms · Privacy · FAQ</p>}
        {user.role === 'admin' && <div className="fy-admin-panel"><div className="fy-section-title"><h2>Administration</h2><Button size="sm" variant="secondary" onClick={loadAdminUsers}>Refresh users</Button></div>{adminError && <p className="fy-auth-error" role="alert">{adminError}</p>}{adminUsers.length === 0 ? <p className="fy-muted">Load users to review account status and signup bonus state.</p> : <div className="fy-table-wrap"><table className="fy-data-table"><thead><tr><th>User</th><th>Status</th><th>Bonus</th><th>Action</th></tr></thead><tbody>{adminUsers.map((entry) => <tr key={entry.id}><td>{entry.username || entry.email}</td><td>{entry.account_status}</td><td>{entry.signup_bonus_awarded ? 'Granted' : 'Not granted'}</td><td><Button size="sm" variant="filter" onClick={() => updateAdminUserStatus(token, entry.id, entry.account_status === 'active' ? 'suspended' : 'active').then((updated) => setAdminUsers((current) => current.map((item) => item.id === updated.id ? updated : item))).catch((error) => setAdminError(error instanceof Error ? error.message : 'Could not update account.'))}>{entry.account_status === 'active' ? 'Suspend' : 'Restore'}</Button></td></tr>)}</tbody></table></div>}</div>}
      </GlassCard></BlurFade>
    </div>
  );
}
