import { useState } from 'react';
import { X } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssetRow, CardTitle, EmptyWatchlist, GlassCard } from '@/components/shared/field-components';
import { players, type Player, type Screen } from '@/data/fieldyield';

export function Watchlist({ openAsset, setScreen }: { openAsset: (player: Player) => void; setScreen: (screen: Screen) => void }) {
  const [watchedTickers, setWatchedTickers] = useState(() => players.slice(0, 4).map((player) => player.ticker));
  const watched = watchedTickers.map((ticker) => players.find((player) => player.ticker === ticker)).filter((player): player is Player => Boolean(player));

  return (
    <div className="fy-screen">
      <BlurFade><h1 className="fy-page-title">Watchlist</h1></BlurFade>
      <BlurFade><GlassCard><CardTitle title="Watchlist" action={<span className="fy-muted">Tracked locally</span>} />
        {watched.length ? watched.map((player, index) => (
          <div className="fy-watch-row" key={player.ticker}>
            <span className="fy-drag" aria-hidden="true">☰</span>
            <AssetRow player={player} openAsset={openAsset} />
            <Input aria-label={`Price alert for ${player.name}`} placeholder="Alert ◈" defaultValue={index === 0 ? '300' : ''} />
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${player.name} from watchlist`} onClick={() => setWatchedTickers((current) => current.filter((ticker) => ticker !== player.ticker))}><X /></Button>
          </div>
        )) : <EmptyWatchlist onBrowse={() => setScreen('markets')} />}
      </GlassCard></BlurFade>
    </div>
  );
}
