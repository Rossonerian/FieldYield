import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CalendarDays, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchLeagueFixtures, fetchSportsLeagues, type SportsFixture, type SportsLeague } from '@/lib/api';

export function SportsDataNotebook() {
  const [leagues, setLeagues] = useState<SportsLeague[]>([]);
  const [fixtures, setFixtures] = useState<SportsFixture[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('premier-league');
  const [loading, setLoading] = useState(true);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSportsLeagues()
      .then((rows) => {
        if (cancelled) return;
        setLeagues(rows);
        if (rows[0]) setSelectedLeague(rows[0].slug);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFixturesLoading(true);
    fetchLeagueFixtures(selectedLeague)
      .then((rows) => {
        if (!cancelled) setFixtures(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setFixturesLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedLeague]);

  const selected = useMemo(() => leagues.find((league) => league.slug === selectedLeague), [leagues, selectedLeague]);

  return (
    <section className="fy-sports-diary" aria-label="Bzzoiro sports data">
      <div className="fy-sports-diary-spine" aria-hidden="true"><span /><span /><span /></div>
      <div className="fy-sports-diary-content">
        <div className="fy-sports-diary-header">
          <span className="fy-sports-diary-kicker">Bzzoiro live notebook</span>
          <div>
            <h2>Top UEFA league tape</h2>
            <p>Lean provider reads for fixtures, squads and player context.</p>
          </div>
          <Button variant="filter" size="sm" onClick={() => window.location.reload()} aria-label="Refresh sports data"><RefreshCw size={16} /></Button>
        </div>

        {loading && <StatusLine icon={<RefreshCw size={16} />} label="Loading league coverage..." />}
        {error && <StatusLine icon={<AlertCircle size={16} />} label={error} />}
        {!loading && !error && leagues.length === 0 && <StatusLine icon={<AlertCircle size={16} />} label="No league data is available yet." />}

        {leagues.length > 0 && (
          <>
            <div className="fy-sports-league-tabs" role="tablist" aria-label="Top UEFA leagues">
              {leagues.map((league) => (
                <button key={league.slug} type="button" aria-selected={selectedLeague === league.slug} onClick={() => setSelectedLeague(league.slug)}>
                  <Trophy size={14} />
                  <span>{league.name}</span>
                </button>
              ))}
            </div>
            <div className="fy-sports-diary-grid">
              <div className="fy-sports-diary-note">
                <span>League</span>
                <strong>{selected?.name ?? 'Coverage'}</strong>
                <small>{selected?.country ?? 'UEFA'} · season {selected?.current_season_id ?? 'current'}</small>
              </div>
              <div className="fy-sports-fixture-list">
                <span className="fy-sports-fixture-title"><CalendarDays size={15} /> Fixtures</span>
                {fixturesLoading && <span className="fy-sports-muted">Refreshing fixture tape...</span>}
                {!fixturesLoading && fixtures.length === 0 && <span className="fy-sports-muted">No cached fixtures for this league yet.</span>}
                {!fixturesLoading && fixtures.map((fixture) => (
                  <article key={fixture.provider_id} className="fy-sports-fixture">
                    <time>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(fixture.event_date))}</time>
                    <strong>{fixture.home_team} vs {fixture.away_team}</strong>
                    <span>{fixture.status}{fixture.round_name ? ` · ${fixture.round_name}` : ''}</span>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function StatusLine({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="fy-sports-status">{icon}<span>{label}</span></div>;
}
