import { useState, type CSSProperties } from 'react';
import { Lock, Shield } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BadgeDelta, getDeltaType } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { Input } from '@/components/ui/input';
import { CardTitle, DividendTable, GlassCard, MiniChart, OrderBook, Stats } from '@/components/shared/field-components';
import { TradeButton } from '@/features/trading/TradeButton';
import type { AssetVariant, ModalName, Player } from '@/data/fieldyield';

type AssetPageProps = {
  player: Player;
  variant: AssetVariant;
  tradeSide: 'buy' | 'sell';
  setTradeSide: (side: 'buy' | 'sell') => void;
  setVariant: (variant: AssetVariant) => void;
  setModal: (modal: ModalName) => void;
};

export function AssetPage({ player, variant, tradeSide, setTradeSide, setVariant, setModal }: AssetPageProps) {
  const frozen = variant === 'circuit';
  const retired = variant === 'retired';

  return (
    <div className={`fy-screen fy-asset-screen ${frozen ? 'fy-is-frozen' : ''}`}>
      <BlurFade><GlassCard className="fy-asset-header">
        <Avatar name={player.name} fallback={player.photo} size="xl" showStatus={false} decorative />
        <div className="fy-asset-title"><h1>{player.name}</h1><div><Badge>{player.ticker}</Badge> <Badge>{player.league}</Badge> {player.status !== 'Open' && <Badge variant={player.status.includes('Risk') ? 'danger' : 'warning'}>{player.status}</Badge>} {retired && <Badge>RETIRED ★</Badge>}</div></div>
        <div className="fy-asset-price"><strong className="fy-pixel"><CurrencyAmount>{player.price.toFixed(2)}</CurrencyAmount></strong><BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} /></div>
        <div className="fy-mini-stats"><div><span>Mkt Cap</span><strong><CurrencyAmount>28.6M</CurrencyAmount></strong></div><div><span>Div. Yield</span><strong>{player.yield}</strong></div><div><span>Supply Owned</span><strong>{player.owned}%</strong></div></div>
        {frozen && <div className="fy-warning-banner">Circuit breaker: price dropped 52% in 3 hours. Trading resumes in 11:42.</div>}
        {variant === 'risk' && <div className="fy-warning-banner fy-warning-severe">Nullification final window active. League removal may settle at zero. <TradeButton type="sell" onClick={() => setTradeSide('sell')}>Sell Now →</TradeButton></div>}
      </GlassCard></BlurFade>

      <div className="fy-asset-layout">
        <div className="fy-asset-main">
          <BlurFade delay={0.08}><GlassCard className="fy-chart-card"><CardTitle title="Price Chart" pills={['1D', '1W', '1M', 'Season', 'All Time']} /><div className="fy-chart-area"><MiniChart large frozen={frozen} /><div className="fy-volume-bars">{Array.from({ length: 28 }, (_, index) => <i key={`volume-${index}`} style={{ height: `${20 + (index % 7) * 8}px` } as CSSProperties} />)}</div></div></GlassCard></BlurFade>
          <BlurFade delay={0.12}><GlassCard><CardTitle title="Statistics" pills={['Performance', 'Status']} /><Stats /></GlassCard></BlurFade>
          <BlurFade delay={0.16}><GlassCard><CardTitle title="Order Book" /><OrderBook /></GlassCard></BlurFade>
        </div>
        <div className="fy-asset-side">
          {retired || frozen ? <SpecialPanel variant={variant} /> : <TradingPanel player={player} side={tradeSide} setSide={setTradeSide} setModal={setModal} />}
          <GlassCard><h3>Special Mechanics</h3><div className="fy-mechanic-buttons">{(['normal', 'circuit', 'risk', 'retired'] as AssetVariant[]).map((state) => <Button key={state} size="sm" variant="filter" aria-pressed={variant === state} onClick={() => setVariant(state)}>{state}</Button>)}</div></GlassCard>
        </div>
      </div>
      <BlurFade delay={0.2}><GlassCard><CardTitle title="Dividend History" /><DividendTable /></GlassCard></BlurFade>
      <div className="fy-mobile-action-bar"><TradeButton type="buy" onClick={() => { setTradeSide('buy'); setModal('buy'); }}>Buy</TradeButton><TradeButton type="sell" aria-pressed={tradeSide === 'sell'} onClick={() => setTradeSide('sell')}>Sell</TradeButton></div>
    </div>
  );
}

function TradingPanel({ player, side, setSide, setModal }: { player: Player; side: 'buy' | 'sell'; setSide: (side: 'buy' | 'sell') => void; setModal: (modal: ModalName) => void }) {
  const [order, setOrder] = useState('Market');
  const [sellReviewed, setSellReviewed] = useState(false);

  return (
    <BlurFade delay={0.14}><GlassCard className="fy-trading-panel">
      <div className="fy-trade-tabs"><TradeButton type="buy" aria-pressed={side === 'buy'} onClick={() => { setSide('buy'); setSellReviewed(false); }}>Buy</TradeButton><TradeButton type="sell" aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell</TradeButton></div>
      <div className="fy-pill-row">{['Market', 'Limit', 'Stop', 'Take Profit'].map((entry, index) => <Button key={entry} variant="filter" size="sm" aria-pressed={order === entry} onClick={() => setOrder(entry)}>{index ? <Lock size={12} /> : null}{entry}</Button>)}</div>
      {order !== 'Market' && <div className="fy-upsell"><Lock size={16} /> {order} orders are available on Pro+. Set target/trigger price after upgrade.</div>}
      <label className="fy-field-label">Shares <Input defaultValue="2.0" inputMode="decimal" /></label>
      {order !== 'Market' && <label className="fy-field-label">Target / Trigger Price <Input placeholder="Gold target" inputMode="decimal" /></label>}
      <div className="fy-quote-line"><span>Price/sh</span><strong><CurrencyAmount>{player.price}</CurrencyAmount></strong></div>
      <div className="fy-quote-line"><span>Total</span><strong><CurrencyAmount>{(player.price * 2).toFixed(2)}</CurrencyAmount></strong></div>
      {side === 'buy'
        ? <TradeButton type="buy" className="fy-trade-review" onClick={() => setModal('buy')}>Review Order →</TradeButton>
        : <TradeButton type="sell" className="fy-trade-review" disabled={sellReviewed} onClick={() => setSellReviewed(true)}>{sellReviewed ? 'Sell Reviewed' : 'Review Sell →'}</TradeButton>}
      {sellReviewed && <p className="fy-confirmation-note" role="status">Sell review confirmed in this frontend session. No holding or balance was changed.</p>}
      <Badge variant="success">Spread 0.7% tight</Badge>
    </GlassCard></BlurFade>
  );
}

function SpecialPanel({ variant }: { variant: AssetVariant }) {
  return <GlassCard className="fy-special-panel"><Shield size={28} /><h2>{variant === 'retired' ? 'Archived / Settled' : 'Trading Paused'}</h2><p>{variant === 'retired' ? 'Shares auto-settled at last market value. Historical chart remains viewable; trading is permanently disabled.' : 'Order entry is disabled until the league or asset market reopens.'}</p><Button variant="secondary">View Ledger</Button></GlassCard>;
}
