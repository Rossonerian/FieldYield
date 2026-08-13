import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartNoAxesCombined, Clock, Gauge, History, Megaphone, Settings, Star, Trophy, Users, WalletCards } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DesktopDock } from '@/components/layout/DesktopDock';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import type { NavigationId } from '@/app/navigation';
import { useAccountData, type AccountResource } from '@/app/useAccountData';
import { AuthPage } from '@/features/auth/AuthPage';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import type { SearchItem } from '@/features/search/ActionSearchBar';
import { type AssetVariant, type ModalName, type Player, type Screen } from '@/data/fieldyield';
import { addWatchlist, ApiError, configureApiAuthHandlers, fetchCurrentUser, fetchMarketPlayers, syncSupabaseUser, type CurrentUser } from '@/lib/api';
import { clearOAuthUrl, clearPendingProfile, readPendingProfile, supabase } from '@/lib/supabase';

const AssetPage = lazy(() => import('@/features/assets/AssetPage').then((module) => ({ default: module.AssetPage })));
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })));
const Markets = lazy(() => import('@/features/markets/Markets').then((module) => ({ default: module.Markets })));
const NotificationDrawer = lazy(() => import('@/features/notifications/NotificationDrawer').then((module) => ({ default: module.NotificationDrawer })));
const Portfolio = lazy(() => import('@/features/portfolio/Portfolio').then((module) => ({ default: module.Portfolio })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const Squad = lazy(() => import('@/features/squad/Squad').then((module) => ({ default: module.Squad })));
const TradingDialogs = lazy(() => import('@/features/trading/TradingDialogs').then((module) => ({ default: module.TradingDialogs })));
const Watchlist = lazy(() => import('@/features/watchlist/Watchlist').then((module) => ({ default: module.Watchlist })));

const AUTH_TOKEN_KEY = 'fieldyield.localAuthToken';
type AuthState = 'unauthenticated' | 'authenticating' | 'authenticated_syncing' | 'profile_incomplete' | 'ready' | 'suspended' | 'sync_error';

function LoadingScreen() {
  return <div className="fy-empty" role="status"><strong>Loading account view...</strong></div>;
}

export function App() {
  const initialLocalToken = supabase ? null : window.localStorage.getItem(AUTH_TOKEN_KEY);
  const [authToken, setAuthToken] = useState<string | null>(initialLocalToken);
  const [authState, setAuthState] = useState<AuthState>(initialLocalToken ? 'authenticating' : supabase ? 'authenticating' : 'unauthenticated');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);
  const [syncRetry, setSyncRetry] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [requiresSupabaseProfile, setRequiresSupabaseProfile] = useState(false);
  const [authLoading, setAuthLoading] = useState(Boolean(initialLocalToken || supabase));
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [asset, setAsset] = useState<Player | null>(null);
  const [marketPlayers, setMarketPlayers] = useState<Player[]>([]);
  const [marketError, setMarketError] = useState('');
  const [actionError, setActionError] = useState('');
  const [modal, setModal] = useState<ModalName>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assetState, setAssetState] = useState<AssetVariant>('normal');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const mainRef = useRef<HTMLElement>(null);
  const syncGeneration = useRef(0);
  const hasMounted = useRef(false);
  const watchlistMutation = useRef(false);
  const account = useAccountData(authToken, authState === 'ready');
  const clearAccount = account.clear;
  const refreshAccountData = account.refresh;
  const pageTitle = screen === 'asset' && asset ? asset.name : `${screen.charAt(0).toUpperCase()}${screen.slice(1)}`;

  const clearUserState = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    clearPendingProfile();
    setAuthToken(null); setCurrentUser(null); setRequiresSupabaseProfile(false);
    clearAccount(); setMarketPlayers([]); setBonusMessage(null); setActionError(''); setDrawerOpen(false);
  }, [clearAccount]);

  const handleLogout = useCallback(() => {
    syncGeneration.current += 1;
    void supabase?.auth.signOut();
    clearUserState(); setAuthState('unauthenticated'); setScreen('dashboard');
  }, [clearUserState]);

  useEffect(() => configureApiAuthHandlers({
    onUnauthorized: handleLogout,
    onForbidden: (error) => {
      if (error.message.toLowerCase().includes('suspended')) { setAuthMessage(error.message); setAuthState('suspended'); }
    },
  }), [handleLogout]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) { clearOAuthUrl(); setAuthToken(data.session.access_token); setAuthState('authenticated_syncing'); }
      else { setAuthLoading(false); setAuthState('unauthenticated'); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) { clearOAuthUrl(); setAuthToken(session.access_token); setAuthState('authenticated_syncing'); }
      if (event === 'SIGNED_OUT') { syncGeneration.current += 1; clearUserState(); setAuthState('unauthenticated'); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [clearUserState]);

  useEffect(() => {
    if (!authToken) {
      setAuthLoading(false);
      if (!supabase) setAuthState('unauthenticated');
      document.title = 'Login · FieldYield';
      return;
    }
    const controller = new AbortController();
    const generation = ++syncGeneration.current;
    setAuthLoading(true); setAuthState('authenticated_syncing');
    const synchronize = async () => {
      try {
        const user = await fetchCurrentUser(authToken, controller.signal);
        if (generation === syncGeneration.current) { setCurrentUser(user); setAuthState(user.account_status === 'active' ? 'ready' : 'suspended'); }
      } catch (initialError) {
        if (!supabase || controller.signal.aborted) throw initialError;
        const { data } = await supabase.auth.getUser();
        const metadata = data.user?.user_metadata as { date_of_birth?: string; username?: string } | undefined;
        const pending = readPendingProfile();
        if (!data.user) throw initialError;
        const synced = await syncSupabaseUser(authToken, { date_of_birth: metadata?.date_of_birth ?? pending?.date_of_birth, username: metadata?.username ?? pending?.username }, controller.signal);
        if (generation !== syncGeneration.current) return;
        if (synced.status === 'profile_incomplete') {
          setRequiresSupabaseProfile(true); setAuthState('profile_incomplete'); setAuthMessage('Finish your profile to continue.');
          return;
        }
        if (!synced.user) throw new Error('Profile synchronization failed');
        clearPendingProfile(); setRequiresSupabaseProfile(false); setCurrentUser(synced.user); setAuthState('ready');
        if (synced.bonus?.granted_now) setBonusMessage(`Welcome bonus credited: ${synced.bonus.gold ?? 0} Gold${synced.bonus.silver ? ` and ${synced.bonus.silver} Silver` : ''}.`);
      }
    };
    void synchronize().catch((error) => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 403) { setAuthState('suspended'); setAuthMessage(error.message); return; }
      setAuthState('sync_error'); setAuthMessage('Could not sync your FieldYield profile. You can retry without signing in again.');
    }).finally(() => { if (!controller.signal.aborted) setAuthLoading(false); });
    return () => controller.abort();
  }, [authToken, syncRetry]);

  useEffect(() => {
    if (authState !== 'ready') return;
    const controller = new AbortController();
    void fetchMarketPlayers(controller.signal).then((entries) => {
      setMarketPlayers(entries.map((entry) => ({ ticker: entry.symbol, name: entry.name, club: entry.club, league: entry.league, price: Number(entry.ask), change: null, volume: null, yield: null, owned: null, status: entry.active ? 'Open' : 'Frozen', photo: entry.name.slice(0, 2).toUpperCase() })));
      setMarketError('');
    }).catch((error) => { if (!controller.signal.aborted) setMarketError(error instanceof Error ? error.message : 'Could not load market prices.'); });
    return () => controller.abort();
  }, [authState]);

  useEffect(() => {
    document.title = `${pageTitle} · FieldYield`;
    if (hasMounted.current) window.requestAnimationFrame(() => mainRef.current?.focus());
    hasMounted.current = true;
  }, [pageTitle]);

  const navigate = useCallback((target: Screen | NavigationId) => { setScreen(target); setDrawerOpen(false); }, []);
  const openAsset = useCallback((player: Player, variant: AssetVariant = 'normal', side: 'buy' | 'sell' = 'buy') => { setAsset(player); setAssetState(variant); setTradeSide(side); setScreen('asset'); setDrawerOpen(false); }, []);
  const openBuy = useCallback((player: Player) => { setAsset(player); setTradeSide('buy'); setModal('buy'); }, []);
  const openSell = useCallback((player: Player) => { setAsset(player); setTradeSide('sell'); setModal('sell'); }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const handleAuthenticated = useCallback((token: string, user: CurrentUser) => {
    if (!supabase) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    setAuthToken(token); setRequiresSupabaseProfile(false); setCurrentUser(user); setAuthState('ready');
  }, []);

  const refreshAccount = useCallback((resources?: AccountResource[]) => refreshAccountData(resources), [refreshAccountData]);
  const addSelectedToWatchlist = useCallback(async () => {
    if (!asset) { navigate('markets'); return; }
    if (!authToken || watchlistMutation.current) return;
    watchlistMutation.current = true; setActionError('');
    try { await addWatchlist(authToken, asset.ticker); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 409)) {
        setActionError(error instanceof Error ? error.message : 'Could not update the watchlist.');
        return;
      }
    }
    finally { watchlistMutation.current = false; }
    await refreshAccount(['watchlist']);
  }, [asset, authToken, navigate, refreshAccount]);

  const searchItems = useMemo<SearchItem[]>(() => {
    const pages: SearchItem[] = [
      { id: 'page-dashboard', title: 'Dashboard', subtitle: 'Open snapshot, movers and dividend feed', type: 'Page', category: 'Commands', icon: <Gauge size={18} />, shortcut: 'D', action: () => navigate('dashboard'), keywords: ['home', 'snapshot'] },
      { id: 'page-markets', title: 'Markets', subtitle: 'Browse footballer trading markets', type: 'Market', category: 'Markets', icon: <ChartNoAxesCombined size={18} />, shortcut: 'M', action: () => navigate('markets'), keywords: ['browse', 'prices'] },
      { id: 'page-portfolio', title: 'Portfolio', subtitle: 'Open holdings, allocation and earnings', type: 'Portfolio', category: 'Portfolio', icon: <WalletCards size={18} />, shortcut: 'P', action: () => navigate('portfolio'), keywords: ['holdings'] },
      { id: 'page-squad', title: 'Squad', subtitle: 'Manage active and reserve squad slots', type: 'Command', category: 'Commands', icon: <Users size={18} />, shortcut: 'S', action: () => navigate('squad'), keywords: ['active', 'reserve'] },
      { id: 'page-watchlist', title: 'Watchlist', subtitle: 'Open tracked players and price alerts', type: 'Watchlist', category: 'Watchlist', icon: <Star size={18} />, shortcut: 'W', action: () => navigate('watchlist'), keywords: ['alerts'] },
      { id: 'page-settings', title: 'Settings', subtitle: 'Account, notifications and legal', type: 'Settings', category: 'Settings', icon: <Settings size={18} />, action: () => navigate('settings'), keywords: ['account'] },
    ];
    const leagues: SearchItem[] = [...new Set(marketPlayers.map((player) => player.league))].map((league) => ({ id: `league-${league}`, title: league, subtitle: 'Browse league assets in Markets', type: 'Market', category: 'Markets', icon: <Trophy size={18} />, action: () => navigate('markets'), keywords: ['league', league] }));
    const players: SearchItem[] = marketPlayers.map((player) => ({ id: `player-${player.ticker}`, title: player.name, subtitle: `${player.league} · ${player.ticker} · Open Asset`, type: 'Player', category: 'Players', icon: <span aria-hidden="true">⚽</span>, action: () => openAsset(player), keywords: [player.ticker, player.club, player.league] }));
    const selectedActions: SearchItem[] = asset ? [
        { id: 'action-buy', title: 'Buy Shares', subtitle: 'Open Buy for the selected asset', type: 'Trading', category: 'Trading', icon: <CurrencyIcon kind="gold" />, action: () => openBuy(asset), keywords: ['buy'] },
        { id: 'action-sell', title: 'Sell Shares', subtitle: 'Open Sell for the selected asset', type: 'Trading', category: 'Trading', icon: <span aria-hidden="true">↗</span>, action: () => openSell(asset), keywords: ['sell'] },
      ] : [];
    const historyActions: SearchItem[] = asset ? [{ id: 'action-dividend-history', title: 'Dividend History', subtitle: 'Open asset dividend history', type: 'Portfolio', category: 'Portfolio', icon: <History size={18} />, action: () => openAsset(asset), keywords: ['history'] }] : [];
    const actions: SearchItem[] = [
      ...selectedActions,
      { id: 'action-add-watchlist', title: 'Add to Watchlist', subtitle: asset ? `Track ${asset.name}` : 'Choose a player in Markets', type: 'Watchlist', category: 'Watchlist', icon: <Star size={18} />, action: () => { void addSelectedToWatchlist(); }, keywords: ['watch'] },
      { id: 'action-squad', title: 'Manage Squad', subtitle: 'Promote and reserve players', type: 'Command', category: 'Commands', icon: <Users size={18} />, action: () => navigate('squad'), keywords: ['reserve'] },
      { id: 'action-dividends', title: 'Review Dividends', subtitle: 'Open dividend credits', type: 'Portfolio', category: 'Portfolio', icon: <CurrencyIcon kind="gold" />, action: () => setModal('dividend'), keywords: ['dividend'] },
      { id: 'action-notifications', title: 'Notifications', subtitle: 'Open notification drawer', type: 'Notification', category: 'Notifications', icon: <Megaphone size={18} />, action: () => setDrawerOpen(true), keywords: ['alerts'] },
      { id: 'action-market-closure', title: 'Market Closure', subtitle: 'Open dashboard market status', type: 'Market', category: 'Markets', icon: <Clock size={18} />, action: () => navigate('dashboard'), keywords: ['close'] },
      ...historyActions,
    ];
    return [...pages, ...players, ...leagues, ...actions];
  }, [addSelectedToWatchlist, asset, marketPlayers, navigate, openAsset, openBuy, openSell]);

  if (authLoading) return <main className="fy-auth-screen fy-auth-loading" aria-label="Loading FieldYield"><section className="fy-auth-card"><span className="fy-auth-kicker">FieldYield Exchange</span><h1>Opening your FieldYield account...</h1><p className="fy-muted">Checking your saved session.</p></section></main>;
  if (authState === 'suspended') return <main className="fy-auth-screen" aria-label="Account suspended"><section className="fy-auth-card"><span className="fy-auth-kicker">FieldYield Exchange</span><h1>Account unavailable</h1><p className="fy-muted">{authMessage ?? 'This account is currently suspended.'}</p><button className="fy-auth-submit" type="button" onClick={handleLogout}>Sign out</button></section></main>;
  if (authState === 'sync_error') return <main className="fy-auth-screen" aria-label="Profile sync error"><section className="fy-auth-card"><span className="fy-auth-kicker">FieldYield Exchange</span><h1>Profile sync failed</h1><p className="fy-muted">{authMessage}</p><button className="fy-auth-submit" type="button" onClick={() => setSyncRetry((value) => value + 1)}>Retry sync</button><button className="fy-google-button" type="button" onClick={handleLogout}>Sign out</button></section></main>;
  if (!authToken || !currentUser || authState === 'profile_incomplete') return <AuthPage onAuthenticated={handleAuthenticated} requiresSupabaseProfile={requiresSupabaseProfile} />;

  const accountErrors = Object.entries(account.errors);
  return (
    <div className="fy-app-shell">
      <a className="fy-skip-link" href="#fy-main-content">Skip to content</a>
      <Header searchItems={searchItems} onBalance={() => setModal('coins')} onBell={() => setDrawerOpen(true)} onBrandClick={() => navigate('dashboard')} onProfile={() => navigate('settings')} notificationCount={account.notifications.filter((entry) => !entry.read).length} wallet={account.wallet} user={currentUser} />
      {bonusMessage && <button className="fy-auth-error" type="button" onClick={() => setBonusMessage(null)}>{bonusMessage}</button>}
      {(actionError || marketError || accountErrors.length > 0) && <button className="fy-auth-error" type="button" onClick={() => { setActionError(''); void refreshAccount(); }}>{actionError || marketError || `Some account data could not refresh (${accountErrors.map(([resource]) => resource).join(', ')}). Select to retry.`}</button>}
      <main id="fy-main-content" ref={mainRef} tabIndex={-1} aria-label={`${pageTitle} page`} className="fy-main-frame">
        <Suspense fallback={<LoadingScreen />}>
          {screen === 'dashboard' && <Dashboard openAsset={openAsset} setScreen={navigate} setModal={setModal} onBuy={openBuy} summary={account.summary} players={marketPlayers} watchlist={account.watchlist} />}
          {screen === 'asset' && asset && <AssetPage player={asset} variant={assetState} tradeSide={tradeSide} setTradeSide={setTradeSide} setVariant={setAssetState} setModal={setModal} />}
          {screen === 'portfolio' && <Portfolio openAsset={openAsset} onBuy={openBuy} summary={account.summary} holdings={account.holdings} error={account.errors.holdings} />}
          {screen === 'squad' && <Squad setScreen={navigate} token={authToken} players={marketPlayers} state={account.squad} refresh={() => refreshAccount(['squad', 'summary', 'holdings'])} />}
          {screen === 'markets' && <Markets openAsset={openAsset} onBuy={openBuy} players={marketPlayers} />}
          {screen === 'watchlist' && <Watchlist setScreen={navigate} token={authToken} watched={account.watchlist} refresh={() => refreshAccount(['watchlist'])} />}
          {screen === 'settings' && <SettingsPage token={authToken} user={currentUser} onUpdated={(user) => { setCurrentUser(user); void refreshAccount(['summary']); }} onLogout={handleLogout} />}
        </Suspense>
      </main>
      <DesktopDock activePage={screen} onNavigate={navigate} />
      <MobileNavigation activePage={screen} onNavigate={navigate} />
      <Suspense fallback={null}>
        <NotificationDrawer open={drawerOpen} close={() => setDrawerOpen(false)} token={authToken} notifications={account.notifications} onRead={() => refreshAccount(['notifications', 'summary'])} />
        <TradingDialogs modal={modal} player={asset} close={closeModal} token={authToken} onSuccess={() => refreshAccount(['wallet', 'summary', 'holdings', 'orders', 'squad', 'notifications'])} />
      </Suspense>
    </div>
  );
}
