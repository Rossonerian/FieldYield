import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { BadgeDelta, getDeltaType } from '@/components/ui/badge-delta';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { TradeButton } from './TradeButton';
import type { ModalName, Player } from '@/data/fieldyield';
import { ApiError, placeMarketOrder, type ApiOrder } from '@/lib/api';

type Props = { modal: ModalName; player: Player | null; close: () => void; token: string; onSuccess: () => Promise<void> };

export function TradingDialogs({ modal, player, close, token, onSuccess }: Props) {
  return <>
    {player && <TradeDialog open={modal === 'buy'} side="buy" player={player} close={close} token={token} onSuccess={onSuccess} />}
    {player && <TradeDialog open={modal === 'sell'} side="sell" player={player} close={close} token={token} onSuccess={onSuccess} />}
    <CoinDialog open={modal === 'coins'} close={close} />
    <DividendDialog open={modal === 'dividend'} close={close} />
  </>;
}

function TradeDialog({ open, side, player, close, token, onSuccess }: { open: boolean; side: 'buy' | 'sell'; player: Player; close: () => void; token: string; onSuccess: () => Promise<void> }) {
  const [quantity, setQuantity] = useState('1');
  const [result, setResult] = useState<ApiOrder | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const intentKey = useRef('');

  useEffect(() => {
    if (open) intentKey.current = crypto.randomUUID();
    else { intentKey.current = ''; setResult(null); setQuantity('1'); setError(''); setSubmitting(false); }
  }, [open, player.ticker, side]);

  const changeQuantity = (next: string) => {
    setQuantity(next); setResult(null); setError(''); intentKey.current = crypto.randomUUID();
  };

  const submit = async () => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('Enter a whole share quantity greater than zero.'); return; }
    if (!intentKey.current) intentKey.current = crypto.randomUUID();
    setSubmitting(true); setError('');
    try {
      const next = await placeMarketOrder(token, side, player.ticker, parsed, intentKey.current);
      if (next.status !== 'FILLED') throw new Error(next.failure_reason || 'The order was rejected.');
      setResult(next); intentKey.current = ''; await onSuccess();
    } catch (caught) {
      const suffix = caught instanceof ApiError && caught.requestId ? ` (Request ${caught.requestId})` : '';
      setError(`${caught instanceof Error ? caught.message : 'The order could not be completed.'}${suffix}`);
    } finally { setSubmitting(false); }
  };

  const title = side === 'buy' ? 'Confirm Buy' : 'Confirm Sell';
  const estimate = player.price * (Number(quantity) || 0);
  const footer = <><Button variant="neutral" onClick={close}>{result ? 'Done' : 'Cancel'}</Button><TradeButton type={side} disabled={submitting || Boolean(result)} onClick={submit}>{submitting ? 'Submitting…' : result ? 'Confirmed' : title}</TradeButton></>;
  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title={title} footer={footer}>
    <PlayerSummary player={player} />
    {result && <p className="fy-confirmation-note" role="status">Order filled at <CurrencyIcon kind="gold" />{result.execution_price?.toFixed(2) ?? player.price.toFixed(2)} for an authoritative total of <CurrencyIcon kind="gold" />{result.executed_total?.toFixed(2) ?? estimate.toFixed(2)}. Account data was refreshed.</p>}
    <label className="fy-field-label" htmlFor={`${side}-order-shares`}>Shares <Input id={`${side}-order-shares`} value={quantity} onChange={(event) => changeQuantity(event.target.value)} inputMode="numeric" /></label>
    <div className="fy-quote-line"><span>Current quote/share</span><strong className="fy-currency-value"><CurrencyIcon kind="gold" />{player.price}</strong></div>
    <div className="fy-quote-line"><span>Estimated {side === 'buy' ? 'Cost' : 'Proceeds'}</span><strong className="fy-currency-value"><CurrencyIcon kind="gold" />{estimate.toFixed(2)}</strong></div>
    {error && <p className="fy-auth-error" role="alert">{error}</p>}
  </Dialog>;
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
