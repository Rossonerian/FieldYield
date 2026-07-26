import { useEffect, useMemo, useState } from 'react';
import { WalletIcon } from '@/components/ui/wallet';
import { BlurFade } from '@/components/ui/blur-fade';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { CardTitle, GlassCard, PlayerTable } from '@/components/shared/field-components';
import type { Player } from '@/data/fieldyield';
import { AnimatedIcon } from '@/components/ui/animated-icon';
import { fetchHoldings, type ProfileSummary } from '@/lib/api';

export function Portfolio({ openAsset, onBuy, summary }: { openAsset: (player: Player) => void; onBuy: (player: Player) => void; summary: ProfileSummary | null }) {
  const [holdingsFilter, setHoldingsFilter] = useState('All');
  const [holdings, setHoldings] = useState<Player[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = window.localStorage.getItem('fieldyield.authToken');
    if (!token) return;
    fetchHoldings(token).then((entries) => setHoldings(entries.map((entry) => ({ ticker: entry.symbol, name: entry.name, club: entry.club, league: entry.league, price: entry.market_price, change: null, volume: null, yield: null, owned: entry.quantity, status: 'Open', photo: entry.name.slice(0, 2).toUpperCase() })))).catch(() => setError('Could not load your holdings.'));
  }, []);
  const filteredHoldings = useMemo(() => holdings.filter((player) => {
    if (holdingsFilter === 'Active') return (player.owned ?? 0) > 0;
    if (holdingsFilter === 'Reserve') return false;
    return true;
  }), [holdings, holdingsFilter]);

  return (
    <div className="fy-screen fy-portfolio-screen">
      <BlurFade><h1 className="fy-page-title"><AnimatedIcon icon={WalletIcon} size={24} aria-hidden="true" />Portfolio</h1></BlurFade>
      <BlurFade><div className="fy-summary-grid">
        <GlassCard className="fy-summary-card"><span>Total Value</span><strong className="fy-pixel fy-currency-value"><CurrencyIcon kind="gold" />{summary?.portfolio_market_value?.toFixed(2) ?? '0.00'}</strong></GlassCard>
        <GlassCard className="fy-summary-card"><span>Orders</span><strong>{summary?.orders_count ?? 0}</strong></GlassCard>
        <GlassCard className="fy-summary-card"><span>Unrealized P/L</span><strong className={summary && summary.unrealized_pnl < 0 ? 'fy-loss fy-currency-value' : 'fy-gain fy-currency-value'}><CurrencyIcon kind="gold" />{summary?.unrealized_pnl?.toFixed(2) ?? '0.00'}</strong></GlassCard>
        <GlassCard className="fy-summary-card"><span>Wallet Gold</span><strong className="fy-gold fy-currency-value"><CurrencyIcon kind="gold" />{summary?.gold?.toFixed(2) ?? '0.00'}</strong></GlassCard>
      </div></BlurFade>
      <BlurFade delay={0.08}><GlassCard className="fy-callout">Realized P/L from closed trades: <strong className="fy-currency-value"><CurrencyIcon kind="gold" />{summary?.realized_pnl?.toFixed(2) ?? '0.00'}</strong></GlassCard></BlurFade>
      <BlurFade delay={0.12}><GlassCard><CardTitle title="Holdings" pills={['All', 'Active', 'Reserve']} selectedPill={holdingsFilter} onPillChange={setHoldingsFilter} />{error ? <p className="fy-auth-error" role="alert">{error}</p> : filteredHoldings.length ? <PlayerTable entries={filteredHoldings} openAsset={openAsset} onBuy={onBuy} /> : <div className="fy-empty"><strong>Your portfolio is empty</strong><span>Complete a trade to see real holdings here.</span></div>}</GlassCard></BlurFade>
      <BlurFade delay={0.16}><GlassCard><h3>Allocation</h3><div className="fy-empty"><strong>No allocation data yet</strong><span>Allocation charts appear after your first holding is settled.</span></div></GlassCard></BlurFade>
      <BlurFade delay={0.2}><GlassCard><h3>Earnings</h3><div className="fy-empty"><strong>No earnings history yet</strong><span>Recorded earnings will appear after the backend posts them.</span></div></GlassCard></BlurFade>
    </div>
  );
}
