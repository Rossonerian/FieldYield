import { useState, type ComponentProps, type ReactNode } from 'react';
import { Star, X } from 'lucide-react';
import type { Player } from '@/data/fieldyield';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BadgeDelta, getDeltaType } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { TradeButton } from '@/features/trading/TradeButton';
import { cn } from '@/lib/utils';

export function GlassCard({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn('fy-glass-card', className)} {...props} />;
}

type CardTitleProps = {
  title: string;
  icon?: ReactNode;
  pills?: string[];
  selectedPill?: string;
  onPillChange?: (pill: string) => void;
  action?: ReactNode;
};

export function CardTitle({ title, icon, pills = [], selectedPill, onPillChange, action }: CardTitleProps) {
  const [internalSelection, setInternalSelection] = useState(pills[0]);
  const selected = selectedPill ?? internalSelection;

  return (
    <div className="fy-section-title">
      <h2 className="fy-section-title-heading">{icon}{title}</h2>
      <div className="fy-section-title-actions" role="group" aria-label={`${title} filters and actions`}>
        {pills.map((pill) => (
          <Button
            key={pill}
            variant="filter"
            size="sm"
            aria-pressed={selected === pill}
            onClick={() => { setInternalSelection(pill); onPillChange?.(pill); }}
          >
            {pill}
          </Button>
        ))}
        {action}
      </div>
    </div>
  );
}

type PlayerTableProps = {
  entries: Player[];
  openAsset: (player: Player, variant?: 'normal' | 'circuit' | 'risk' | 'retired') => void;
  compact?: boolean;
  onBuy?: (player: Player) => void;
};

export function PlayerTable({ entries, openAsset, compact = false, onBuy }: PlayerTableProps) {
  return (
    <div className="fy-table-wrap" role="region" aria-label="Scrollable football asset table" data-carousel-wheel-native onPointerDown={(event) => event.stopPropagation()}>
      <table className="fy-data-table">
        <caption className="fy-sr-only">Football asset prices, movement, dividend yield, and actions</caption>
        <thead>
          <tr><th scope="col">#</th><th scope="col">Ticker</th><th scope="col">Player</th><th scope="col">League</th>{!compact && <th scope="col">Position</th>}<th scope="col">Price</th><th scope="col">24h Δ%</th>{!compact && <th scope="col">Div Yield</th>}<th scope="col">Actions</th></tr>
        </thead>
        <tbody>
          {entries.map((player, index) => (
            <tr key={player.ticker}>
              <th scope="row">{index + 1}</th>
              <td><Badge>{player.ticker}</Badge></td>
              <td><span className="fy-player-cell"><Avatar name={player.name} fallback={player.photo ?? undefined} size="sm" showStatus={false} decorative />{player.name}</span></td>
              <td>{player.league}</td>
              {!compact && <td>{player.position}</td>}
              <td><CurrencyAmount>{player.price}</CurrencyAmount></td>
              <td>{player.change == null ? 'Not available' : <BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} />}</td>
              {!compact && <td>{player.yield ?? 'Not available'}</td>}
              <td className="fy-row-actions">
                <Button size="sm" variant="secondary" onClick={() => openAsset(player)}>Open Asset</Button>
                {onBuy && <TradeButton type="buy" onClick={() => onBuy(player)}>Buy</TradeButton>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssetRow({ player, openAsset }: { player: Player; openAsset: (player: Player) => void }) {
  return (
    <button type="button" className="fy-asset-row" onClick={() => openAsset(player)}>
      <Avatar name={player.name} fallback={player.photo ?? undefined} size="sm" showStatus={false} decorative />
      <span>{player.ticker}<small>{player.name}</small></span>
      <strong><CurrencyAmount>{player.price}</CurrencyAmount></strong>
      {player.change == null ? <span className="fy-muted">Change unavailable</span> : <BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} />}
      <Badge variant={player.status === 'Open' ? 'success' : 'neutral'}>{player.status ?? 'Status unavailable'}</Badge>
    </button>
  );
}

export function RankList({ title, items, openAsset }: { title: string; items: Player[]; openAsset: (player: Player) => void }) {
  return (
    <div className="fy-rank-list">
      <h3>{title}</h3>
      {items.map((player, index) => (
        <button className="fy-rank-row" type="button" key={player.ticker} onClick={() => openAsset(player)}>
          <span>{index + 1}</span>
          <span>{player.name}</span>
          <strong><CurrencyAmount>{player.price}</CurrencyAmount></strong>
          {player.change == null ? <span className="fy-muted">Change unavailable</span> : <BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} />}
        </button>
      ))}
    </div>
  );
}

export function MiniChart({ large = false, frozen = false }: { large?: boolean; frozen?: boolean }) {
  return <div role="img" className={`fy-mini-chart ${large ? 'fy-mini-chart-large' : ''} ${frozen ? 'fy-mini-chart-frozen' : ''}`} aria-label="Price history is not available" />;
}

export function EmptyWatchlist({ onBrowse }: { onBrowse: () => void }) {
  return <div className="fy-empty"><Star aria-hidden="true" /><p>Your watchlist is empty</p><Button onClick={onBrowse}>Browse Markets</Button></div>;
}

export function RemoveIcon() { return <X size={15} aria-hidden="true" />; }
