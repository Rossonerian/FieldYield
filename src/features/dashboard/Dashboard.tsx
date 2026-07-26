import { useState } from 'react';
import { ActivityIcon } from '@/components/ui/activity';
import { BlurFade } from '@/components/ui/blur-fade';
import { BadgeDelta } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { CardCarousel } from '@/components/ui/card-carousel';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import type { ModalName, Player, Screen } from '@/data/fieldyield';
import { AssetRow, CardTitle, GlassCard, MiniChart, PlayerTable, RankList } from '@/components/shared/field-components';
import { AnimatedIcon } from '@/components/ui/animated-icon';
import { cn } from '@/lib/utils';
import type { ProfileSummary, WatchlistEntry } from '@/lib/api';

type DashboardProps = {
  openAsset: (player: Player) => void;
  setScreen: (screen: Screen) => void;
  setModal: (modal: ModalName) => void;
  onBuy: (player: Player) => void;
  summary: ProfileSummary | null;
  players: Player[];
  watchlist: WatchlistEntry[];
};

export function Dashboard({ openAsset, setScreen, setModal, onBuy, summary, players, watchlist }: DashboardProps) {
  const [moverFilter, setMoverFilter] = useState('All');
  const [trendFilter, setTrendFilter] = useState('All');
  const [dividendFilter, setDividendFilter] = useState('Recent');
  const moverEntries = moverFilter === 'Losers' ? players.filter((player) => (player.change ?? 0) < 0) : moverFilter === 'Gainers' ? players.filter((player) => (player.change ?? 0) > 0) : players;
  const trendingPlayers = trendFilter === 'All' ? players : players.filter((player) => player.change != null);

  return (
    <div className="fy-screen fy-dashboard-screen">
      <BlurFade><h1 className="fy-page-title">Dashboard</h1></BlurFade>
      <BlurFade inView>
        <CardCarousel title="Portfolio" ariaLabel="Portfolio summary">
          <GlassCard key="total-value" className="fy-dashboard-card fy-summary-card">
            <span>Total Value</span><strong className="fy-pixel fy-currency-value"><CurrencyIcon kind="gold" />{summary?.portfolio_market_value?.toFixed(2) ?? '0.00'}</strong>
            <Button onClick={() => setScreen('portfolio')}>View Breakdown</Button>
          </GlassCard>
          <GlassCard key="daily-pl" className="fy-dashboard-card fy-summary-card">
            <span>Unrealized P/L</span><strong className={cn('fy-currency-value', summary && summary.unrealized_pnl < 0 ? 'fy-loss' : 'fy-gain')}><CurrencyIcon kind="gold" />{summary?.unrealized_pnl?.toFixed(2) ?? '0.00'}</strong><BadgeDelta value={summary ? `${summary.unrealized_pnl.toFixed(2)}` : '0.00'} deltaType={summary ? (summary.unrealized_pnl > 0 ? 'increase' : summary.unrealized_pnl < 0 ? 'decrease' : 'neutral') : 'neutral'} /><MiniChart />
          </GlassCard>
          <GlassCard key="weekly-dividends" className="fy-dashboard-card fy-summary-card">
            <span>Wallet Gold</span><strong className="fy-gold fy-currency-value"><CurrencyIcon kind="gold" />{summary?.gold?.toFixed(2) ?? '0.00'}</strong><Button onClick={() => setModal('coins')}>View Wallet</Button>
          </GlassCard>
          <GlassCard key="active-squad" className="fy-dashboard-card fy-summary-card">
            <span>Holdings</span><strong>{summary?.holdings_count ?? 0}</strong><small>{summary?.orders_count ?? 0} orders</small><Button onClick={() => setScreen('portfolio')}>View Portfolio</Button>
          </GlassCard>
        </CardCarousel>
      </BlurFade>

      <BlurFade delay={0.08} inView>
        <CardCarousel title="Market" ariaLabel="Market insights">
          <GlassCard key="market-movers" className="fy-dashboard-card fy-dashboard-card-wide">
            <CardTitle title="Market Movers" pills={['All', 'Gainers', 'Losers']} selectedPill={moverFilter} onPillChange={setMoverFilter} />
            <PlayerTable entries={moverEntries} openAsset={openAsset} compact onBuy={onBuy} />
          </GlassCard>
          <GlassCard key="trending-assets" className="fy-dashboard-card fy-dashboard-card-wide">
            <CardTitle title="Trending Assets" pills={['All']} selectedPill={trendFilter} onPillChange={setTrendFilter} />
            <div className="fy-two-lists">
              <RankList title="Most Traded" items={trendingPlayers.slice(0, 3)} openAsset={openAsset} />
              <RankList title="Most Added 24h" items={trendingPlayers.slice(2, 5)} openAsset={openAsset} />
            </div>
            <Button variant="ghost" onClick={() => setScreen('markets')}>View All Markets →</Button>
          </GlassCard>
          <GlassCard key="market-closure" className="fy-dashboard-card">
            <CardTitle title="Market Closure" />
            <div className="fy-empty"><strong>Market schedule unavailable</strong><span>Trading availability will appear when the market service publishes a schedule.</span></div>
          </GlassCard>
        </CardCarousel>
      </BlurFade>

      <BlurFade delay={0.16} inView>
        <CardCarousel title="Activity" ariaLabel="Portfolio activity">
          <GlassCard key="watchlist" className="fy-dashboard-card fy-dashboard-scroll-card">
            <CardTitle title="Watchlist" action={<Button size="sm" variant="secondary" onClick={() => setScreen('watchlist')}>View Watchlist</Button>} />
            {watchlist.length ? watchlist.slice(0, 5).map((entry) => <AssetRow key={entry.id} player={{ ticker: entry.symbol, name: entry.name, club: entry.club, league: entry.league, price: Number(entry.ask), change: null, status: 'Open', photo: entry.name.slice(0, 2).toUpperCase() }} openAsset={openAsset} />) : <div className="fy-empty"><strong>No watched players</strong><span>Add assets from Markets to build your watchlist.</span></div>}
          </GlassCard>
          <GlassCard key="dividend-feed" className="fy-dashboard-card">
            <CardTitle title="Dividend Feed" pills={['Recent']} selectedPill={dividendFilter} onPillChange={setDividendFilter} />
            <div className="fy-empty"><strong>No dividend activity yet</strong><span>Credits will appear here after eligible activity is recorded.</span></div>
          </GlassCard>
          <GlassCard key="recent-activity" className="fy-dashboard-card">
            <CardTitle title="Recent Activity" icon={<AnimatedIcon icon={ActivityIcon} size={17} aria-hidden="true" />} />
            <div className="fy-empty"><strong>No recent activity</strong><span>Your orders and wallet events will appear here.</span></div>
          </GlassCard>
        </CardCarousel>
      </BlurFade>
    </div>
  );
}
