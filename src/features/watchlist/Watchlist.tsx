import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { Input } from '@/components/ui/input';
import { CardTitle, EmptyWatchlist, GlassCard } from '@/components/shared/field-components';
import type { Screen } from '@/data/fieldyield';
import { fetchWatchlist, removeWatchlist, type WatchlistEntry } from '@/lib/api';

export function Watchlist({ setScreen, token }: { setScreen: (screen: Screen) => void; token: string }) {
  const [watched, setWatched] = useState<WatchlistEntry[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { fetchWatchlist(token).then(setWatched).catch(() => setError('Could not load your watchlist.')); }, [token]);

  return (
    <div className="fy-screen">
      <BlurFade><h1 className="fy-page-title">Watchlist</h1></BlurFade>
      <BlurFade><GlassCard><CardTitle title="Watchlist" action={<span className="fy-muted">Tracked locally</span>} />
        {watched.length ? watched.map((entry) => (
          <div className="fy-watch-row" key={entry.id}>
            <span className="fy-drag" aria-hidden="true">☰</span>
            <div className="fy-asset-row"><span>{entry.symbol}<small>{entry.name}</small></span><strong><CurrencyAmount>{entry.bid}</CurrencyAmount></strong></div>
            <Input aria-label={`Price alert for ${entry.name}`} placeholder="Gold alert" />
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${entry.name} from watchlist`} onClick={() => removeWatchlist(token, entry.symbol).then(() => setWatched((current) => current.filter((item) => item.id !== entry.id))).catch(() => setError('Could not remove that player.'))}><X /></Button>
          </div>
        )) : <EmptyWatchlist onBrowse={() => setScreen('markets')} />}
        {error && <p className="fy-auth-error" role="alert">{error}</p>}
      </GlassCard></BlurFade>
    </div>
  );
}
