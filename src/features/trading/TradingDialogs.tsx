import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { BadgeDelta, getDeltaType } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { TradeButton } from './TradeButton';
import type { ModalName, Player } from '@/data/fieldyield';
import { placeMarketOrder } from '@/lib/api';

export function TradingDialogs({ modal, player, close, token }: { modal: ModalName; player: Player; close: () => void; token: string }) {
  return (
    <>
      <BuyDialog open={modal === 'buy'} player={player} close={close} token={token} />
      <CoinDialog open={modal === 'coins'} close={close} />
      <DividendDialog open={modal === 'dividend'} close={close} />
    </>
  );
}

function BuyDialog({ open, player, close, token }: { open: boolean; player: Player; close: () => void; token: string }) {
  const [quantity, setQuantity] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (!open) { setConfirmed(false); setQuantity('1'); setError(''); } }, [open]);
  const submit = async () => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('Enter a whole share quantity greater than zero.'); return; }
    setSubmitting(true); setError('');
    try { const result = await placeMarketOrder(token, 'buy', player.ticker, parsed, crypto.randomUUID()); if (result.status !== 'FILLED') throw new Error(result.failure_reason || 'The order was rejected.'); setConfirmed(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The order could not be completed.'); }
    finally { setSubmitting(false); }
  };
  const footer = <><Button variant="neutral" onClick={close}>{confirmed ? 'Done' : 'Cancel'}</Button><TradeButton type="buy" disabled={submitting || confirmed} onClick={submit}>{submitting ? 'Submitting…' : confirmed ? 'Confirmed' : 'Confirm Buy'}</TradeButton></>;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title="Confirm Buy" footer={footer}>
      <PlayerSummary player={player} />
      {confirmed && <p className="fy-confirmation-note" role="status">Order accepted by the backend. Wallet and holdings were updated from the authoritative response.</p>}
        <label className="fy-field-label">Shares <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" /></label>
        <div className="fy-quote-line"><span>Price/share</span><strong className="fy-currency-value"><CurrencyIcon kind="gold" />{player.price}</strong></div>
        <div className="fy-quote-line"><span>Total Cost</span><strong className="fy-currency-value"><CurrencyIcon kind="gold" />{(player.price * (Number(quantity) || 0)).toFixed(2)}</strong></div>
      {error && <p className="fy-auth-error" role="alert">{error}</p>}
    </Dialog>
  );
}

function CoinDialog({ open, close }: { open: boolean; close: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title="Wallet" description="Balances are read from your FieldYield account."><div className="fy-empty"><strong>Funding is not available</strong><span>Wallet credits can only be posted by an authorized backend operation.</span></div></Dialog>;
}

function DividendDialog({ open, close }: { open: boolean; close: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title="Dividend Feed" description="Credits appear here when the backend records eligible activity." footer={<Button onClick={close}>Done</Button>}><div className="fy-empty"><strong>No dividend credits yet</strong><span>There is no recorded dividend activity for this account.</span></div></Dialog>;
}

function PlayerSummary({ player }: { player: Player }) {
  return <div className="fy-player-summary"><Avatar name={player.name} fallback={player.photo ?? undefined} showStatus={false} decorative /><span><strong>{player.name}</strong><small>{player.ticker} · {player.league}</small></span><strong className="fy-currency-value"><CurrencyIcon kind="gold" />{player.price}</strong>{player.change == null ? <span className="fy-muted">Change unavailable</span> : <BadgeDelta value={`${Math.abs(player.change)}%`} deltaType={getDeltaType(player.change)} />}</div>;
}
