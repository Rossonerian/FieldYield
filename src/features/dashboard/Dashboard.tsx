import { useState } from 'react';
import { ActivityIcon } from '@/components/ui/activity';
import { BlurFade } from '@/components/ui/blur-fade';
import { Badge } from '@/components/ui/badge';
import { BadgeDelta } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { CardCarousel } from '@/components/ui/card-carousel';
import { activity, dividends, players, type ModalName, type Player, type Screen } from '@/data/fieldyield';
import { AssetRow, CardTitle, FeedRow, GlassCard, MiniChart, PlayerTable, RankList } from '@/components/shared/field-components';
import { AnimatedIcon } from '@/components/ui/animated-icon';

type DashboardProps = {
  openAsset: (player: Player) => void;
  setScreen: (screen: Screen) => void;
  setModal: (modal: ModalName) => void;
  onBuy: (player: Player) => void;
};

export function Dashboard({ openAsset, setScreen, setModal, onBuy }: DashboardProps) {
  const [moverFilter, setMoverFilter] = useState('Gainers');
  const [trendFilter, setTrendFilter] = useState('Today');
  const [dividendFilter, setDividendFilter] = useState('Recent');
  const moverEntries = moverFilter === 'Losers'
    ? players.filter((player) => player.change < 0)
    : moverFilter === 'Volume'
      ? [...players].sort((left, right) => Number.parseFloat(right.volume) - Number.parseFloat(left.volume)).slice(0, 5)
      : players.filter((player) => player.change >= 0).slice(0, 5);
  const trendingPlayers = trendFilter === 'This Gameweek'
    ? [...players].sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
    : players;
  const visibleDividends = dividendFilter === 'Upcoming'
    ? dividends.filter((row) => row[3] === 'Pending')
    : dividends;

  return (
    <div className="fy-screen fy-dashboard-screen">
      <BlurFade><h1 className="fy-page-title">Dashboard</h1></BlurFade>
      <BlurFade inView>
        <CardCarousel title="Portfolio" ariaLabel="Portfolio summary">
          <GlassCard key="total-value" className="fy-dashboard-card fy-summary-card">
            <span>Total Value</span><strong className="fy-pixel">◈128,430</strong>
            <Button onClick={() => setScreen('portfolio')}>View Breakdown</Button>
          </GlassCard>
          <GlassCard key="daily-pl" className="fy-dashboard-card fy-summary-card">
            <span>Daily P/L</span><strong className="fy-gain">+◈2,184</strong><BadgeDelta value="+3.2%" deltaType="increase" /><MiniChart />
          </GlassCard>
          <GlassCard key="weekly-dividends" className="fy-dashboard-card fy-summary-card">
            <span>Weekly Dividends</span><strong className="fy-gold">◈1,086</strong><Button onClick={() => setModal('dividend')}>Claim</Button>
          </GlassCard>
          <GlassCard key="active-squad" className="fy-dashboard-card fy-summary-card">
            <span>Active Squad</span><strong>18/25</strong><small>Reserve 8/15</small><Button onClick={() => setScreen('squad')}>Manage</Button>
          </GlassCard>
        </CardCarousel>
      </BlurFade>

      <BlurFade delay={0.08} inView>
        <CardCarousel title="Market" ariaLabel="Market insights">
          <GlassCard key="market-movers" className="fy-dashboard-card fy-dashboard-card-wide">
            <CardTitle title="Market Movers" pills={['Gainers', 'Losers', 'Volume']} selectedPill={moverFilter} onPillChange={setMoverFilter} />
            <PlayerTable entries={moverEntries} openAsset={openAsset} compact onBuy={onBuy} />
          </GlassCard>
          <GlassCard key="trending-assets" className="fy-dashboard-card fy-dashboard-card-wide">
            <CardTitle title="Trending Assets" pills={['Today', 'This Gameweek']} selectedPill={trendFilter} onPillChange={setTrendFilter} />
            <div className="fy-two-lists">
              <RankList title="Most Traded" items={trendingPlayers.slice(0, 3)} openAsset={openAsset} />
              <RankList title="Most Added 24h" items={trendingPlayers.slice(2, 5)} openAsset={openAsset} />
            </div>
            <Button variant="ghost" onClick={() => setScreen('markets')}>View All Markets →</Button>
          </GlassCard>
          <GlassCard key="market-closure" className="fy-dashboard-card">
            <CardTitle title="Market Closure" />
            {['EPL', 'La Liga', 'Bundesliga'].map((league, index) => (
              <div className="fy-closure-row" key={league}><Badge variant={index ? 'neutral' : 'success'}>{index ? 'Locked' : 'Open'}</Badge><span>{league}</span><strong>{index ? '18:42:10' : '02:18:44'}</strong></div>
            ))}
          </GlassCard>
        </CardCarousel>
      </BlurFade>

      <BlurFade delay={0.16} inView>
        <CardCarousel title="Activity" ariaLabel="Portfolio activity">
          <GlassCard key="watchlist" className="fy-dashboard-card fy-dashboard-scroll-card">
            <CardTitle title="Watchlist" action={<Button size="sm" variant="secondary" onClick={() => setScreen('watchlist')}>View Watchlist</Button>} />
            {players.slice(0, 5).map((player) => <AssetRow key={player.ticker} player={player} openAsset={openAsset} />)}
          </GlassCard>
          <GlassCard key="dividend-feed" className="fy-dashboard-card">
            <CardTitle title="Dividend Feed" pills={['Recent', 'Upcoming']} selectedPill={dividendFilter} onPillChange={setDividendFilter} />
            {visibleDividends.map((row) => <FeedRow key={row.join()} row={row} onClick={() => setModal('dividend')} />)}
          </GlassCard>
          <GlassCard key="recent-activity" className="fy-dashboard-card">
            <CardTitle title="Recent Activity" icon={<AnimatedIcon icon={ActivityIcon} size={17} aria-hidden="true" />} />
            {activity.map(([time, text]) => <div className="fy-activity-row" key={time}><span>{time}</span><strong>{text}</strong></div>)}
          </GlassCard>
        </CardCarousel>
      </BlurFade>
    </div>
  );
}
