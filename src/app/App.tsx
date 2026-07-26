import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartNoAxesCombined, Clock, Gauge, History, Megaphone, Settings, Star, Trophy, Users, WalletCards } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DesktopDock } from '@/components/layout/DesktopDock';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import type { NavigationId } from '@/app/navigation';
import { AuthPage } from '@/features/auth/AuthPage';
import { AssetPage } from '@/features/assets/AssetPage';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Markets } from '@/features/markets/Markets';
import { NotificationDrawer } from '@/features/notifications/NotificationDrawer';
import { Portfolio } from '@/features/portfolio/Portfolio';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { Squad } from '@/features/squad/Squad';
import { TradingDialogs } from '@/features/trading/TradingDialogs';
import { Watchlist } from '@/features/watchlist/Watchlist';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import type { SearchItem } from '@/features/search/ActionSearchBar';
import { type AssetVariant, type ModalName, type Player, type Screen } from '@/data/fieldyield';
import { fetchCurrentUser, fetchMarketPlayers, fetchNotifications, fetchProfileSummary, fetchWallet, fetchWatchlist, syncSupabaseUser, type CurrentUser, type ProfileSummary, type Wallet, type WatchlistEntry } from '@/lib/api';
import { clearOAuthUrl, supabase } from '@/lib/supabase';

const AUTH_TOKEN_KEY = 'fieldyield.authToken';

export function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => window.localStorage.getItem(AUTH_TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [requiresSupabaseProfile, setRequiresSupabaseProfile] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(Boolean(authToken));
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [asset, setAsset] = useState<Player | null>(null);
  const [marketPlayers, setMarketPlayers] = useState<Player[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [modal, setModal] = useState<ModalName>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assetState, setAssetState] = useState<AssetVariant>('normal');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const mainRef = useRef<HTMLElement>(null);
  const hasMounted = useRef(false);
  const pageTitle = screen === 'asset' && asset ? asset.name : `${screen.charAt(0).toUpperCase()}${screen.slice(1)}`;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) { clearOAuthUrl(); setAuthToken(data.session.access_token); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) { clearOAuthUrl(); setAuthToken(session.access_token); }
      if (event === 'SIGNED_OUT') {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        setCurrentUser(null);
        setRequiresSupabaseProfile(false);
        setAuthToken(null);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setAuthLoading(false);
      document.title = 'Login · FieldYield';
      return;
    }

    let cancelled = false;
    setAuthLoading(true);
    fetchCurrentUser(authToken)
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(async () => {
        if (supabase) {
          try {
            const { data } = await supabase.auth.getUser();
            const metadata = data.user?.user_metadata as { date_of_birth?: string; username?: string } | undefined;
            const pending = window.localStorage.getItem('fieldyield.pendingSupabaseProfile');
            const stored = pending ? JSON.parse(pending) as { date_of_birth?: string; username?: string } : {};
            const profile = { date_of_birth: metadata?.date_of_birth ?? stored.date_of_birth, username: metadata?.username ?? stored.username };
            if (data.user) {
              const synced = await syncSupabaseUser(authToken, profile);
              if (!cancelled) {
                window.localStorage.removeItem('fieldyield.pendingSupabaseProfile');
                setRequiresSupabaseProfile(false);
                setCurrentUser(synced);
                return;
              }
            }
          } catch (syncError) {
            const message = syncError instanceof Error ? syncError.message : '';
            if (message.includes('Date of birth is required') && !cancelled) {
              setRequiresSupabaseProfile(true);
              return;
            }
          }
        }
        if (!cancelled) {
          void supabase?.auth.signOut();
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
          setAuthToken(null);
          setCurrentUser(null);
          setRequiresSupabaseProfile(false);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    Promise.all([fetchWallet(authToken), fetchProfileSummary(authToken), fetchNotifications(authToken).catch(() => []), fetchMarketPlayers().catch(() => []), fetchWatchlist(authToken).catch(() => [])]).then(([nextWallet, nextSummary, notifications, nextPlayers, nextWatchlist]) => {
      setWallet(nextWallet); setSummary(nextSummary); setNotificationCount(notifications.filter((entry) => !entry.read).length);
      setMarketPlayers(nextPlayers.map((entry) => ({ ticker: entry.symbol, name: entry.name, club: entry.club, league: entry.league, price: Number(entry.ask), change: null, volume: null, yield: null, owned: null, status: entry.active ? 'Open' : 'Frozen', photo: entry.name.slice(0, 2).toUpperCase() })));
      setWatchlist(nextWatchlist);
    }).catch(() => undefined);
  }, [authToken]);

  useEffect(() => {
    document.title = `${pageTitle} · FieldYield`;
    if (hasMounted.current) window.requestAnimationFrame(() => mainRef.current?.focus());
    hasMounted.current = true;
  }, [pageTitle]);

  const navigate = useCallback((target: Screen | NavigationId) => {
    setScreen(target as Screen);
    setDrawerOpen(false);
  }, []);

  const openAsset = useCallback((player: Player, variant: AssetVariant = 'normal', side: 'buy' | 'sell' = 'buy') => {
    setAsset(player);
    setAssetState(variant);
    setTradeSide(side);
    setScreen('asset');
    setDrawerOpen(false);
  }, []);

  const openBuy = useCallback((player: Player) => {
    setAsset(player);
    setTradeSide('buy');
    setModal('buy');
  }, []);
  const openBalances = useCallback(() => setModal('coins'), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeModal = useCallback(() => setModal(null), []);
  const handleAuthenticated = useCallback((token: string, user: CurrentUser) => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    setAuthToken(token);
    setRequiresSupabaseProfile(false);
    setCurrentUser(user);
  }, []);
  const handleLogout = useCallback(() => {
    void supabase?.auth.signOut();
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null); setCurrentUser(null); setWallet(null); setSummary(null); setWatchlist([]); setMarketPlayers([]); setScreen('dashboard');
  }, []);

  const searchItems = useMemo<SearchItem[]>(() => {
    const pageItems: SearchItem[] = [
      { id: 'page-dashboard', title: 'Dashboard', subtitle: 'Open snapshot, movers and dividend feed', type: 'Page', category: 'Commands', icon: <Gauge size={18} />, shortcut: 'D', action: () => navigate('dashboard'), keywords: ['home', 'snapshot', 'market movers'] },
      { id: 'page-markets', title: 'Markets', subtitle: 'Browse footballer trading markets', type: 'Market', category: 'Markets', icon: <ChartNoAxesCombined size={18} />, shortcut: 'M', action: () => navigate('markets'), keywords: ['browse', 'league', 'prices'] },
      { id: 'page-portfolio', title: 'Portfolio', subtitle: 'Open holdings, allocation and earnings', type: 'Portfolio', category: 'Portfolio', icon: <WalletCards size={18} />, shortcut: 'P', action: () => navigate('portfolio'), keywords: ['holdings', 'breakdown', 'allocation', 'returns'] },
      { id: 'page-squad', title: 'Squad', subtitle: 'Manage active and reserve squad slots', type: 'Command', category: 'Commands', icon: <Users size={18} />, shortcut: 'S', action: () => navigate('squad'), keywords: ['manage squad', 'active squad', 'reserve'] },
      { id: 'page-watchlist', title: 'Watchlist', subtitle: 'Open tracked players and price alerts', type: 'Watchlist', category: 'Watchlist', icon: <Star size={18} />, shortcut: 'W', action: () => navigate('watchlist'), keywords: ['alerts', 'tracked'] },
      { id: 'page-settings', title: 'Settings', subtitle: 'Account, subscription, notifications and legal', type: 'Settings', category: 'Settings', icon: <Settings size={18} />, action: () => navigate('settings'), keywords: ['account', 'security', 'subscription'] },
    ];

    const leagueItems: SearchItem[] = [...new Set(marketPlayers.map((player) => player.league))].map((league) => ({
      id: `league-${league.toLowerCase().replaceAll(' ', '-')}`,
      title: league,
      subtitle: 'Browse league assets in Markets',
      type: 'Market',
      category: 'Markets',
      icon: <Trophy size={18} />,
      action: () => navigate('markets'),
      keywords: ['league', 'market', league],
    }));

    const playerItems: SearchItem[] = marketPlayers.map((player, index) => ({
      id: `player-${player.ticker}`,
      title: player.name,
      subtitle: `${player.league} · ${player.ticker} · Open Asset`,
      type: 'Player',
      category: 'Players',
      icon: <span className="fy-search-player-glyph">⚽</span>,
      section: index < 4 ? 'Most Traded Players' : undefined,
      action: () => openAsset(player, player.status === 'Frozen' ? 'circuit' : 'normal'),
      keywords: [player.ticker, player.club, player.position ?? '', player.league, 'open asset', 'footballer'],
    }));

    const actionItems = ([
      ...(asset ? [
        { id: 'action-buy', title: 'Buy Shares', subtitle: 'Open Buy for the selected asset', type: 'Trading', category: 'Trading', icon: <CurrencyIcon kind="gold" />, section: 'Quick Actions', shortcut: 'B', action: () => openBuy(asset), keywords: ['buy', 'purchase', 'shares', 'trade'] },
        { id: 'action-sell', title: 'Sell Shares', subtitle: 'Open the selected asset trading panel', type: 'Trading', category: 'Trading', icon: <span aria-hidden="true">↗</span>, section: 'Quick Actions', action: () => openAsset(asset, 'normal', 'sell'), keywords: ['sell', 'exit', 'shares', 'trade'] },
      ] : []),
      { id: 'action-add-watchlist', title: 'Add to Watchlist', subtitle: 'Open Watchlist management', type: 'Watchlist', category: 'Watchlist', icon: <Star size={18} />, section: 'Quick Actions', action: () => navigate('watchlist'), keywords: ['watch', 'alert', 'track'] },
      { id: 'action-squad', title: 'Manage Squad', subtitle: 'Promote, reserve and inspect squad slots', type: 'Command', category: 'Commands', icon: <Users size={18} />, section: 'Quick Actions', action: () => navigate('squad'), keywords: ['active squad', 'reserve', 'manage'] },
      { id: 'action-dividends', title: 'Review Dividends', subtitle: 'Open weekly dividend credits', type: 'Portfolio', category: 'Portfolio', icon: <CurrencyIcon kind="gold" />, action: () => { navigate('dashboard'); setModal('dividend'); }, keywords: ['dividend', 'claim', 'earnings', 'weekly'] },
      { id: 'action-holdings', title: 'View Holdings', subtitle: 'Open portfolio holdings table', type: 'Portfolio', category: 'Portfolio', icon: <WalletCards size={18} />, action: () => navigate('portfolio'), keywords: ['holdings', 'positions', 'portfolio'] },
      { id: 'action-notifications', title: 'Notifications', subtitle: 'Open dividend, closure and alert drawer', type: 'Notification', category: 'Notifications', icon: <Megaphone size={18} />, action: openDrawer, keywords: ['bell', 'alerts', 'announcements'] },
      { id: 'action-market-closure', title: 'Market Closure', subtitle: 'Open dashboard league closure countdowns', type: 'Market', category: 'Markets', icon: <Clock size={18} />, action: () => navigate('dashboard'), keywords: ['close', 'locked', 'countdown', 'league'] },
      ...(asset ? [{ id: 'action-dividend-history', title: 'Dividend History', subtitle: 'Open asset dividend history table', type: 'Portfolio', category: 'Portfolio', icon: <History size={18} />, action: () => openAsset(asset), keywords: ['dividends', 'history', 'earnings'] }] : []),
    ] as SearchItem[]);

    return [...pageItems, ...playerItems, ...leagueItems, ...actionItems];
  }, [asset, marketPlayers, navigate, openAsset, openBuy, openDrawer]);

  if (authLoading) {
    return (
      <main className="fy-auth-screen fy-auth-loading" aria-label="Loading FieldYield">
        <section className="fy-auth-card">
          <span className="fy-auth-kicker">FieldYield Exchange</span>
          <h1>Opening your FieldYield account...</h1>
          <p className="fy-muted">Checking your saved session.</p>
        </section>
      </main>
    );
  }

  if (!authToken || !currentUser) {
    return <AuthPage onAuthenticated={handleAuthenticated} requiresSupabaseProfile={requiresSupabaseProfile} />;
  }

  return (
    <div className="fy-app-shell">
      <a className="fy-skip-link" href="#fy-main-content">Skip to content</a>
      <Header searchItems={searchItems} onBalance={openBalances} onBell={openDrawer} onBrandClick={() => navigate('dashboard')} onProfile={() => navigate('settings')} notificationCount={notificationCount} wallet={wallet} user={currentUser} />
      <main id="fy-main-content" ref={mainRef} tabIndex={-1} aria-label={`${pageTitle} page`} className="fy-main-frame">
        {screen === 'dashboard' && <Dashboard openAsset={openAsset} setScreen={navigate} setModal={setModal} onBuy={openBuy} summary={summary} players={marketPlayers} watchlist={watchlist} />}
        {screen === 'asset' && asset && <AssetPage player={asset} variant={assetState} tradeSide={tradeSide} setTradeSide={setTradeSide} setVariant={setAssetState} setModal={setModal} />}
        {screen === 'portfolio' && <Portfolio openAsset={openAsset} onBuy={openBuy} summary={summary} />}
        {screen === 'squad' && <Squad setScreen={navigate} token={authToken} players={marketPlayers} />}
        {screen === 'markets' && <Markets openAsset={openAsset} onBuy={openBuy} players={marketPlayers} />}
        {screen === 'watchlist' && <Watchlist setScreen={navigate} token={authToken} />}
        {screen === 'settings' && <SettingsPage token={authToken} user={currentUser} onUpdated={setCurrentUser} onLogout={handleLogout} />}
      </main>
      <DesktopDock activePage={screen} onNavigate={navigate} />
      <MobileNavigation activePage={screen} onNavigate={navigate} />
      <NotificationDrawer open={drawerOpen} close={closeDrawer} token={authToken} />
      {asset && <TradingDialogs modal={modal} player={asset} close={closeModal} token={authToken} />}
    </div>
  );
}
