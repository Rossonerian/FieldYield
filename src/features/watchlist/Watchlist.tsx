import { useState } from 'react';
import { X } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { CardTitle, EmptyWatchlist, GlassCard } from '@/components/shared/field-components';
import type { Screen } from '@/data/fieldyield';
import { removeWatchlist, type WatchlistEntry } from '@/lib/api';

export function Watchlist({ setScreen, token, watched, refresh }: { setScreen: (screen: Screen) => void; token: string; watched: WatchlistEntry[]; refresh: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [pendingSymbol, setPendingSymbol] = useState('');
  const remove = async (symbol: string) => {
    if (pendingSymbol) return;
    setPendingSymbol(symbol); setError('');
    try { await removeWatchlist(token, symbol); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not remove that player.'); }
    finally { setPendingSymbol(''); }
  };
  return <div className="fy-screen"><BlurFade><h1 className="fy-page-title">Watchlist</h1></BlurFade><BlurFade><GlassCard><CardTitle title="Watchlist" action={<span className="fy-muted">Synced to your account</span>} />
    {watched.length ? watched.map((entry) => <div className="fy-watch-row" key={entry.id}><span className="fy-drag" aria-hidden="true">☰</span><div className="fy-asset-row"><span>{entry.symbol}<small>{entry.name}</small></span><strong><CurrencyAmount>{entry.bid}</CurrencyAmount></strong></div><span className="fy-muted" aria-label="Price alerts unavailable">Price alerts unavailable</span><Button disabled={Boolean(pendingSymbol)} size="icon-sm" variant="ghost" aria-label={`Remove ${entry.name} from watchlist`} onClick={() => { void remove(entry.symbol); }}><X /></Button></div>) : <EmptyWatchlist onBrowse={() => setScreen('markets')} />}
    {error && <p className="fy-auth-error" role="alert">{error}</p>}
  </GlassCard></BlurFade></div>;
}
