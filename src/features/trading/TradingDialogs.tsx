import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { BadgeDelta, getDeltaType } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TradeButton } from './TradeButton';
import { dividends, players, type ModalName, type Player } from '@/data/fieldyield';

export function TradingDialogs({ modal, player, close }: { modal: ModalName; player: Player; close: () => void }) {
  return (
    <>
      <BuyDialog open={modal === 'buy'} player={player} close={close} />
      <CoinDialog open={modal === 'coins'} close={close} />
      <DividendDialog open={modal === 'dividend'} close={close} />
    </>
  );
}

function BuyDialog({ open, player, close }: { open: boolean; player: Player; close: () => void }) {
  const [state, setState] = useState<'base' | 'funds' | 'cap'>('base');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (!open) { setConfirmed(false); setState('base'); } }, [open]);
  const footer = <><Button variant="neutral" onClick={close}>{confirmed ? 'Done' : 'Cancel'}</Button><TradeButton type="buy" disabled={state === 'funds' || confirmed} onClick={() => setConfirmed(true)}>{confirmed ? 'Confirmed' : state === 'cap' ? 'Swap & Buy' : 'Confirm Buy'}</TradeButton></>;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title="Confirm Buy" footer={footer}>
      <PlayerSummary player={player} />
      {confirmed && <p className="fy-confirmation-note" role="status">Buy review confirmed in this frontend session. No balance or holding was changed.</p>}
      <div className="fy-segmented" role="group" aria-label="Buy dialog preview state">{(['base', 'funds', 'cap'] as const).map((entry) => <Button key={entry} variant="filter" aria-pressed={state === entry} onClick={() => setState(entry)}>{entry === 'base' ? 'Base' : entry === 'funds' ? 'Insufficient' : 'Squad Cap'}</Button>)}</div>
      {state === 'cap' ? <><h3>Active Squad Full</h3><p>Pick a player to demote to Reserve before purchase.</p>{players.slice(1, 4).map((entry) => <PlayerSummary key={entry.ticker} player={entry} />)}</> : <>
        <label className="fy-field-label">Shares <Input defaultValue="2" inputMode="decimal" /></label>
        <div className="fy-quote-line"><span>Price/share</span><strong>◈{player.price}</strong></div>
        <div className="fy-quote-line"><span>Total Cost</span><strong>◈{(player.price * 2).toFixed(2)}</strong></div>
        <div className="fy-quote-line"><span>Landing in</span><strong>Active Squad 18 → 19/25</strong></div>
        <div className="fy-quote-line"><span>Balance after</span><strong>◈11,907.2</strong></div>
      </>}
      {state === 'funds' && <p className="fy-warning-text">Required ◈572.8 vs available ◈240.0. <Button size="sm" variant="secondary">Add Funds</Button></p>}
    </Dialog>
  );
}

function CoinDialog({ open, close }: { open: boolean; close: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title="Coin Bundle Sheet" description="Closed-loop Gold/Silver balances for FieldYield trading instruments."><div className="fy-bundle-list">{['◈1,000 Gold', '◈5,500 Gold', '◈12,000 Gold'].map((bundle) => <Button className="fy-bundle" variant="secondary" key={bundle}>{bundle}</Button>)}</div></Dialog>;
}

function DividendDialog({ open, close }: { open: boolean; close: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title="Dividend Feed" description="Review available credits. This frontend does not submit a claim." footer={<Button onClick={close}>Done</Button>}><div className="fy-dividend-dialog-list">{dividends.map((row) => <div className="fy-quote-line" key={row.join()}><span>{row[0]} · {row[1]}</span><strong>{row[2]}</strong></div>)}</div></Dialog>;
}

function PlayerSummary({ player }: { player: Player }) {
  return <div className="fy-player-summary"><Avatar name={player.name} fallback={player.photo} showStatus={false} decorative /><span><strong>{player.name}</strong><small>{player.ticker} · {player.league}</small></span><strong>◈{player.price}</strong><BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} /></div>;
}
