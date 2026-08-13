import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: boolean };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: false };

  static getDerivedStateFromError(): State { return { error: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('FieldYield render failure', { name: error.name, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fy-auth-screen" aria-label="FieldYield recovery">
        <section className="fy-auth-card">
          <span className="fy-auth-kicker">FieldYield Exchange</span>
          <h1>Something went wrong</h1>
          <p className="fy-muted">Your account data was not changed. Reload the interface to try again.</p>
          <button className="fy-auth-submit" type="button" onClick={() => window.location.reload()}>Reload FieldYield</button>
        </section>
      </main>
    );
  }
}
