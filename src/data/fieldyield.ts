export type Screen =
  | 'dashboard'
  | 'asset'
  | 'portfolio'
  | 'squad'
  | 'markets'
  | 'watchlist'
  | 'settings';

export type AssetVariant = 'normal' | 'circuit' | 'risk' | 'retired';
export type ModalName = 'buy' | 'coins' | 'dividend' | null;

export type Player = {
  ticker: string;
  name: string;
  club: string;
  league: string;
  position?: 'GK' | 'DEF' | 'MID' | 'FWD' | null;
  price: number;
  change?: number | null;
  volume?: string | null;
  yield?: string | null;
  owned?: number | null;
  status?: 'Open' | 'Split Queued' | 'League Status At Risk' | 'Frozen' | string | null;
  photo?: string | null;
};
