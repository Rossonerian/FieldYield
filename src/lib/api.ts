const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export type SportsLeague = {
  provider_id: number;
  slug: string;
  name: string;
  country: string;
  current_season_id: number | null;
  active: boolean;
};

export type SportsFixture = {
  provider_id: number;
  league_id: number;
  season_id: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: string;
  away_team: string;
  event_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  round_name: string | null;
};

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchSportsLeagues() {
  return apiGet<SportsLeague[]>('/api/v1/sports/leagues');
}

export function fetchLeagueFixtures(league: string) {
  const params = new URLSearchParams({ league, limit: '6' });
  return apiGet<SportsFixture[]>(`/api/v1/sports/fixtures?${params.toString()}`);
}
