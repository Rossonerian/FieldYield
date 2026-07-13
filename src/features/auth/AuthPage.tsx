import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, NotebookTabs, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchCurrentUser, loginUser, registerUser, type CurrentUser } from '@/lib/api';

type AuthMode = 'login' | 'register';

type AuthPageProps = {
  onAuthenticated: (token: string, user: CurrentUser) => void;
};

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1998-01-01');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = mode === 'login' ? 'Enter exchange' : 'Create account';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        await registerUser(email, password, dateOfBirth);
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
      <section className="fy-auth-editorial" aria-labelledby="fy-auth-title">
        <span className="fy-auth-kicker">FieldYield Exchange</span>
        <h1 id="fy-auth-title">Trade the football market from a sharper notebook.</h1>
        <p>
          Sign in to enter the live dashboard, inspect player markets, manage your squad, and track the
          portfolio built around your football thesis.
        </p>
        <div className="fy-auth-proof-grid" aria-label="Platform highlights">
          <span><NotebookTabs size={17} /> Top league market notes</span>
          <span><ShieldCheck size={17} /> Soft 18+ access check</span>
          <span><LockKeyhole size={17} /> Token-secured session</span>
        </div>
      </section>

      <section className="fy-auth-card" aria-labelledby="fy-auth-form-title">
        <div className="fy-auth-card-header">
          <span className="fy-auth-kicker">{mode === 'login' ? 'Welcome back' : 'New account'}</span>
          <h2 id="fy-auth-form-title">{mode === 'login' ? 'Login' : 'Register'}</h2>
        </div>

        <div className="fy-auth-mode-switch" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Login
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        <form className="fy-auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <Input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@fieldyield.app"
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>Password</span>
            <Input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              required
              type="password"
              value={password}
            />
          </label>

          {mode === 'register' && (
            <label>
              <span>Date of birth</span>
              <Input
                autoComplete="bday"
                name="date_of_birth"
                onChange={(event) => setDateOfBirth(event.target.value)}
                required
                type="date"
                value={dateOfBirth}
              />
            </label>
          )}

          {error && <p className="fy-auth-error" role="alert">{error}</p>}

          <Button className="fy-auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Checking...' : submitLabel}
            <ArrowRight size={17} />
          </Button>
        </form>
      </section>
    </main>
  );
}
