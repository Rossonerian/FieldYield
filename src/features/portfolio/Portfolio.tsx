import { useMemo, useState } from 'react';
import { WalletIcon } from '@/components/ui/wallet';
import { BlurFade } from '@/components/ui/blur-fade';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Bars, CardTitle, Donut, GlassCard, PlayerTable, TreeMap } from '@/components/shared/field-components';
import { players, type Player } from '@/data/fieldyield';
import { AnimatedIcon } from '@/components/ui/animated-icon';
import type { ProfileSummary } from '@/lib/api';

export function Portfolio({ openAsset, onBuy, summary }: { openAsset: (player: Player) => void; onBuy: (player: Player) => void; summary: ProfileSummary | null }) {
  const [holdingsFilter, setHoldingsFilter] = useState('All');
  const [gameweek, setGameweek] = useState('GW 22');
  const holdings = useMemo(() => players.filter((player) => {
    if (holdingsFilter === 'Active') return player.owned > 10;
    if (holdingsFilter === 'Reserve') return player.owned <= 10;
    return true;
  }), [holdingsFilter]);

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
      <BlurFade delay={0.12}><GlassCard><CardTitle title="Holdings" pills={['All', 'Active', 'Reserve']} selectedPill={holdingsFilter} onPillChange={setHoldingsFilter} /><PlayerTable entries={holdings} openAsset={openAsset} onBuy={onBuy} /></GlassCard></BlurFade>
      <BlurFade delay={0.16}><div className="fy-allocation-grid">
        <GlassCard><h3>By League</h3><Donut /></GlassCard>
        <GlassCard><h3>By Position</h3><Bars labels={['GK', 'DEF', 'MID', 'FWD']} /></GlassCard>
        <GlassCard><h3>By Asset Size</h3><TreeMap /></GlassCard>
      </div></BlurFade>
      <BlurFade delay={0.2}><GlassCard><CardTitle title="Earnings" pills={['GW 20', 'GW 21', 'GW 22']} selectedPill={gameweek} onPillChange={setGameweek} /><Bars labels={gameweek === 'GW 20' ? ['17', '18', '19', '20'] : gameweek === 'GW 21' ? ['18', '19', '20', '21'] : ['19', '20', '21', '22']} gold /></GlassCard></BlurFade>
    </div>
  );
}
