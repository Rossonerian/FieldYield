const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export type AuthToken = {
  access_token: string;
  token_type: string;
};

export type CurrentUser = {
  id: number;
  email: string;
  age_verified: boolean;
};

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

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function registerUser(email: string, password: string, dateOfBirth: string) {
  return apiPost<{ id: number; email: string }>('/api/v1/auth/register', {
    email,
    password,
    date_of_birth: new Date(dateOfBirth).toISOString(),
  });
}

export function loginUser(email: string, password: string) {
  return apiPost<AuthToken>('/api/v1/auth/login', { email, password });
}

export async function fetchCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<CurrentUser>;
}

export function fetchSportsLeagues() {
  return apiGet<SportsLeague[]>('/api/v1/sports/leagues');
}

export function fetchLeagueFixtures(league: string) {
  const params = new URLSearchParams({ league, limit: '6' });
  return apiGet<SportsFixture[]>(`/api/v1/sports/fixtures?${params.toString()}`);
}
