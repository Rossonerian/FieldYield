import { useMemo, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardTitle, GlassCard, PlayerTable } from '@/components/shared/field-components';
import { players, type Player } from '@/data/fieldyield';

type MarketsProps = {
  openAsset: (player: Player) => void;
  onBuy: (player: Player) => void;
};

const leagues = ['All', 'EPL', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Eredivisie', 'Liga Portugal'];
const positions = ['All', 'GK', 'DEF', 'MID', 'FWD'];

export function Markets({ openAsset, onBuy }: MarketsProps) {
  const [league, setLeague] = useState('All');
  const [position, setPosition] = useState('All');
  const [price, setPrice] = useState('All');
  const [query, setQuery] = useState('');
  const [descending, setDescending] = useState(false);

  const filteredPlayers = useMemo(() => players
    .filter((player) => league === 'All' || player.league === league)
    .filter((player) => position === 'All' || player.position === position)
    .filter((player) => {
      if (price === '<◈50') return player.price < 50;
      if (price === '◈50–200') return player.price >= 50 && player.price <= 200;
      if (price === '>◈200') return player.price > 200;
      return true;
    })
    .filter((player) => `${player.name} ${player.ticker} ${player.club}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => descending ? right.price - left.price : left.price - right.price), [descending, league, position, price, query]);

  return (
    <div className="fy-screen fy-markets-screen">
      <BlurFade><h1 className="fy-page-title">Markets</h1></BlurFade>
      <BlurFade>
        <GlassCard className="fy-filter-rail">
          <CardTitle title="Browse Markets" />
          <FilterGroup values={leagues} value={league} onChange={setLeague} label="League" />
          <FilterGroup values={positions} value={position} onChange={setPosition} label="Position" />
          <div className="fy-filter-group fy-market-control-strip">
            <Button variant="filter" aria-pressed={descending} onClick={() => setDescending((current) => !current)}><ListFilter /> Sort price {descending ? 'high' : 'low'}</Button>
            <Input aria-label="Search market" placeholder="Search market" value={query} onChange={(event) => setQuery(event.target.value)} />
            <FilterGroup values={['All', '<◈50', '◈50–200', '>◈200']} value={price} onChange={setPrice} label="Price" inline />
          </div>
        </GlassCard>
      </BlurFade>
      <BlurFade delay={0.08}>
        <GlassCard>
          {filteredPlayers.length > 0
            ? <PlayerTable entries={filteredPlayers} openAsset={openAsset} onBuy={onBuy} />
            : <div className="fy-empty"><strong>No matching assets</strong><span>Adjust the active market filters.</span></div>}
        </GlassCard>
      </BlurFade>
    </div>
  );
}

function FilterGroup({ values, value, onChange, label, inline = false }: { values: string[]; value: string; onChange: (value: string) => void; label: string; inline?: boolean }) {
  const buttons = values.map((entry) => <Button key={entry} variant="filter" size="sm" aria-pressed={value === entry} onClick={() => onChange(entry)}>{entry}</Button>);
  return <div className={inline ? 'fy-filter-inline-group' : 'fy-filter-group'} role="group" aria-label={`${label} filter`}>{buttons}</div>;
}
