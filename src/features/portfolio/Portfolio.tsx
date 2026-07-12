import { useMemo, useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { BadgeDelta } from '@/components/ui/badge-delta';
import { Bars, CardTitle, Donut, GlassCard, PlayerTable, TreeMap } from '@/components/shared/field-components';
import { players, type Player } from '@/data/fieldyield';

export function Portfolio({ openAsset, onBuy }: { openAsset: (player: Player) => void; onBuy: (player: Player) => void }) {
  const [holdingsFilter, setHoldingsFilter] = useState('All');
  const [gameweek, setGameweek] = useState('GW 22');
  const holdings = useMemo(() => players.filter((player) => {
    if (holdingsFilter === 'Active') return player.owned > 10;
    if (holdingsFilter === 'Reserve') return player.owned <= 10;
    return true;
  }), [holdingsFilter]);

  return (
    <div className="fy-screen">
      <BlurFade><h1 className="fy-page-title">Portfolio</h1></BlurFade>
      <BlurFade><div className="fy-summary-grid">
        <GlassCard className="fy-summary-card"><span>Total Value</span><strong className="fy-pixel">◈128,430</strong></GlassCard>
        <GlassCard className="fy-summary-card"><span>Total Return</span><strong className="fy-gain"><BadgeDelta value="+18.4%" deltaType="increase" /></strong></GlassCard>
        <GlassCard className="fy-summary-card"><span>Unrealized P/L</span><strong className="fy-gain">+◈14,228</strong></GlassCard>
        <GlassCard className="fy-summary-card"><span>Weekly Dividends</span><strong className="fy-gold">◈1,086</strong></GlassCard>
      </div></BlurFade>
      <BlurFade delay={0.08}><GlassCard className="fy-callout">Realized P/L from closed trades: <strong>+◈5,842</strong></GlassCard></BlurFade>
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
