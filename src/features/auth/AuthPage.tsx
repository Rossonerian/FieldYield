import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Check, Circle, LockKeyhole, Sparkles } from 'lucide-react';
import { fetchCurrentUser, loginUser, registerUser, type CurrentUser } from '@/lib/api';

type AuthMode = 'login' | 'register';

type AuthPageProps = {
  onAuthenticated: (token: string, user: CurrentUser) => void;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRules = useMemo(() => ({
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  }), [password]);

  const strengthScore = Object.values(passwordRules).filter(Boolean).length;
  const strengthLabel = strengthScore === 0 ? 'Empty' : strengthScore === 1 ? 'Weak' : strengthScore === 2 ? 'Good' : 'Strong';

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!emailPattern.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (mode === 'register') {
      if (!username.trim()) {
        setError('Choose a username to create your account.');
        return;
      }
      if (strengthScore < 3) {
        setError('Password must be 8 characters with 1 number and 1 uppercase letter.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        await registerUser(email, password);
      }

      const token = await loginUser(email, password);
      const user = await fetchCurrentUser(token.access_token);
      onAuthenticated(token.access_token, user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="fy-auth-screen" aria-label="FieldYield authentication">
      <section className="fy-auth-card" aria-labelledby="fy-auth-form-title">
        <div className="fy-auth-brand-row">
          <span className="fy-auth-brand-mark"><Sparkles size={18} /></span>
          <span>FieldYield</span>
        </div>

        <div className="fy-auth-card-header">
          <span className="fy-auth-kicker">In-game football exchange</span>
          <h1 id="fy-auth-form-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p>{mode === 'login' ? 'Login to continue to the trading dashboard.' : 'Sign up and receive your starter Gold bonus from the backend.'}</p>
        </div>

        <div className="fy-auth-mode-switch" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>
            Login
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>
            Sign Up
          </button>
        </div>

        <form className={`fy-auth-form fy-auth-form-${mode}`} onSubmit={handleSubmit}>
          <div className="fy-auth-form-panel" key={mode}>
            {mode === 'register' && (
              <label className="fy-floating-field">
                <input
                  autoComplete="username"
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder=" "
                  required
                  value={username}
                />
                <span>Username</span>
              </label>
            )}

            <label className="fy-floating-field">
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder=" "
                required
                type="email"
                value={email}
              />
              <span>Email</span>
            </label>

            <label className="fy-floating-field">
              <input
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder=" "
                required
                type="password"
                value={password}
              />
              <span>Password</span>
            </label>

            {mode === 'register' && (
              <div className="fy-password-strength" aria-live="polite">
                <div className="fy-strength-heading">
                  <span>Password strength</span>
                  <strong>{strengthLabel}</strong>
                </div>
                <div className="fy-strength-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(strengthScore, 0) * 33.33}%` }} />
                </div>
                <ul>
                  <PasswordRule met={passwordRules.length}>Minimum 8 characters</PasswordRule>
                  <PasswordRule met={passwordRules.number}>At least 1 number</PasswordRule>
                  <PasswordRule met={passwordRules.uppercase}>At least 1 uppercase letter</PasswordRule>
                </ul>
              </div>
            )}

            {error && <p className="fy-auth-error" role="alert">{error}</p>}

            <button className="fy-auth-submit" disabled={isSubmitting} type="submit">
              <span>{isSubmitting ? 'Checking...' : mode === 'login' ? 'Login' : 'Sign Up'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </form>

        <p className="fy-auth-footnote">
          <LockKeyhole size={14} /> JWT-secured access. In-game currency only.
        </p>
      </section>
    </main>
  );
}

function PasswordRule({ children, met }: { children: string; met: boolean }) {
  const Icon = met ? Check : Circle;

  return (
    <li className={met ? 'is-met' : undefined}>
      <Icon size={14} />
      <span>{children}</span>
    </li>
  );
}
