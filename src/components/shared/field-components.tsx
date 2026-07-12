import { useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Star, X } from 'lucide-react';
import { players, dividends, type Player } from '@/data/fieldyield';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BadgeDelta, getDeltaType } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  const activateRow = (event: KeyboardEvent<HTMLTableRowElement>, player: Player) => {
    if (event.currentTarget !== event.target) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAsset(player, player.status === 'Frozen' ? 'circuit' : 'normal');
    }
  };

  return (
    <div className="fy-table-wrap" role="region" aria-label="Scrollable football asset table" tabIndex={0} data-carousel-wheel-native onPointerDown={(event) => event.stopPropagation()}>
      <table className="fy-data-table">
        <caption className="fy-sr-only">Football asset prices, movement, dividend yield, and actions</caption>
        <thead>
          <tr><th>#</th><th>Ticker</th><th>Player</th><th>League</th>{!compact && <th>Position</th>}<th>Price</th><th>24h Δ%</th>{!compact && <th>Div Yield</th>}<th>Actions</th></tr>
        </thead>
        <tbody>
          {entries.map((player, index) => (
            <tr
              key={player.ticker}
              tabIndex={0}
              onKeyDown={(event) => activateRow(event, player)}
              onClick={() => openAsset(player, player.status === 'Frozen' ? 'circuit' : 'normal')}
              aria-label={`Open ${player.name}`}
            >
              <td>{index + 1}</td>
              <td><Badge>{player.ticker}</Badge></td>
              <td><span className="fy-player-cell"><Avatar name={player.name} fallback={player.photo} size="sm" showStatus={false} decorative />{player.name}</span></td>
              <td>{player.league}</td>
              {!compact && <td>{player.position}</td>}
              <td>◈{player.price}</td>
              <td><BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} /></td>
              {!compact && <td>{player.yield}</td>}
              <td className="fy-row-actions">
                <Button size="sm" variant="ghost" onClick={(event) => event.stopPropagation()}>Watch</Button>
                <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); openAsset(player); }}>Open Asset</Button>
                <TradeButton type="buy" onClick={(event) => { event.stopPropagation(); onBuy?.(player); }}>Buy</TradeButton>
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
      <Avatar name={player.name} fallback={player.photo} size="sm" showStatus={false} decorative />
      <span>{player.ticker}<small>{player.name}</small></span>
      <strong>◈{player.price}</strong>
      <BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} />
      <Badge variant={player.status === 'Open' ? 'success' : 'neutral'}>{player.status}</Badge>
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
          <strong>◈{player.price}</strong>
          <BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} />
        </button>
      ))}
    </div>
  );
}

export function FeedRow({ row, onClick }: { row: (typeof dividends)[number]; onClick?: () => void }) {
  return (
    <button className="fy-feed-row" type="button" onClick={onClick}>
      <span>{row[0]}</span><strong>{row[1]}</strong><em>{row[2]}</em>
      <Badge variant={row[3] === 'Pending' ? 'warning' : 'success'}>{row[3]}</Badge>
    </button>
  );
}

export function MiniChart({ large = false, frozen = false }: { large?: boolean; frozen?: boolean }) {
  return (
    <div role="img" className={`fy-mini-chart ${large ? 'fy-mini-chart-large' : ''} ${frozen ? 'fy-mini-chart-frozen' : ''}`} aria-label={frozen ? 'Price movement chart with a circuit-breaker freeze period' : 'Price movement chart trending upward'}>
      {Array.from({ length: 18 }, (_, index) => (
        <i key={`chart-${index}`} style={{ '--fy-chart-height': `${24 + ((index * 13) % 44)}%` } as CSSProperties} />
      ))}
    </div>
  );
}

export function Stats() {
  return (
    <div className="fy-stats">
      {['Goals', 'Assists', 'xG', 'xA', 'Rating'].map((stat, index) => (
        <div key={stat}><span>{stat}</span><b style={{ width: `${52 + index * 9}%` }} /></div>
      ))}
      <p><Badge variant="success">Fit</Badge> Transfer note: no active speculation.</p>
    </div>
  );
}

export function OrderBook() {
  return (
    <div className="fy-depth">
      <div><h3>Bid</h3>{[286.1, 285.8, 285.4].map((price) => <p key={price}>◈{price} <span>240</span></p>)}</div>
      <div><h3>Ask</h3>{[286.8, 287.2, 287.6].map((price) => <p key={price}>◈{price} <span>180</span></p>)}</div>
      <Badge variant="success">Spread 0.7% tight</Badge>
    </div>
  );
}

export function DividendTable() {
  return (
    <div className="fy-table-wrap" role="region" aria-label="Scrollable dividend history table" tabIndex={0} data-carousel-wheel-native onPointerDown={(event) => event.stopPropagation()}>
      <table className="fy-data-table">
        <caption className="fy-sr-only">Dividend history by matchweek with yield and credit status</caption>
        <thead><tr><th>Matchweek</th><th>Dividend/share</th><th>Yield at price</th><th>Status</th><th>Trailing-4-GW</th></tr></thead>
        <tbody>{dividends.map((row) => <tr key={row.join()}><td>{row[0]}</td><td>{row[2]}</td><td>2.2%</td><td><Badge variant={row[3] === 'Pending' ? 'warning' : 'success'}>{row[3]}</Badge></td><td>◈18.22</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function Donut() { return <div role="img" className="fy-donut" aria-label="League allocation: Premier League 38 percent, La Liga 34 percent, other leagues 28 percent" />; }
export function Bars({ labels, gold = false }: { labels: string[]; gold?: boolean }) { return <div role="img" className="fy-bars" aria-label={`Bar chart comparing ${labels.join(', ')}`}>{labels.map((label, index) => <div key={label}><i className={gold ? 'fy-bar-gold' : ''} style={{ height: `${40 + index * 14}px` }} /><span>{label}</span></div>)}</div>; }
export function TreeMap() { return <div role="img" className="fy-tree-map" aria-label="Asset-size allocation split across four holding groups"><i /><i /><i /><i /></div>; }

export function EmptyWatchlist({ onBrowse }: { onBrowse: () => void }) {
  return <div className="fy-empty"><Star aria-hidden="true" /><p>Your watchlist is empty</p><Button onClick={onBrowse}>Browse Markets</Button></div>;
}

export function RemoveIcon() { return <X size={15} aria-hidden="true" />; }

export { players };
