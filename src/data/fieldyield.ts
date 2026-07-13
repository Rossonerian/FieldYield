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
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  change: number;
  volume: string;
  yield: string;
  owned: number;
  status: 'Open' | 'Split Queued' | 'League Status At Risk' | 'Frozen';
  photo: string;
};

export const players: Player[] = [
  { ticker: 'HA9', name: 'Erling Haaland', club: 'MCI', league: 'EPL', position: 'FWD', price: 286.4, change: 7.8, volume: '84.2k', yield: '12.8%', owned: 42, status: 'Open', photo: 'EH' },
  { ticker: 'JU5', name: 'Jude Bellingham', club: 'RMA', league: 'La Liga', position: 'MID', price: 224.1, change: 4.2, volume: '61.9k', yield: '9.4%', owned: 18, status: 'Split Queued', photo: 'JB' },
  { ticker: 'SA7', name: 'Bukayo Saka', club: 'ARS', league: 'EPL', position: 'FWD', price: 192.7, change: 3.1, volume: '43.4k', yield: '8.7%', owned: 11, status: 'Open', photo: 'BS' },
  { ticker: 'WI11', name: 'Florian Wirtz', club: 'LIV', league: 'EPL', position: 'MID', price: 168.9, change: -2.6, volume: '37.0k', yield: '7.9%', owned: 0, status: 'League Status At Risk', photo: 'FW' },
  { ticker: 'MB10', name: 'Kylian Mbappé', club: 'RMA', league: 'La Liga', position: 'FWD', price: 310.2, change: -9.4, volume: '109k', yield: '10.1%', owned: 6, status: 'Frozen', photo: 'KM' },
  { ticker: 'MU42', name: 'Jamal Musiala', club: 'BAY', league: 'Bundesliga', position: 'MID', price: 156.8, change: 1.8, volume: '31.8k', yield: '7.2%', owned: 14, status: 'Open', photo: 'JM' },
];

export const activity = [
  ['14:52', 'Bought 3.0 HA9 at 286.4 Gold'],
  ['13:10', 'Dividend credited: JU5 +4.28 Gold/share'],
  ['12:41', 'Added SA7 to watchlist'],
  ['10:05', 'EPL market locks in 02:18:44'],
] as const;

export const dividends = [
  ['GW 22', 'HA9', '7.42/share', 'Credited'],
  ['GW 22', 'JU5', '4.28/share', 'Pending'],
  ['GW 21', 'SA7', '3.62/share', 'Credited'],
  ['GW 21', 'MU42', '2.91/share', 'Credited'],
] as const;
