import { useMemo, useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { CardTitle, GlassCard } from '@/components/shared/field-components';
import { HoldAndReleaseButton } from '@/features/trading/HoldAndReleaseButton';
import type { Player, Screen } from '@/data/fieldyield';
import { demoteSquad, promoteSquad, type SquadState } from '@/lib/api';

type SquadSlot = { id: string; player: Player };

export function Squad({ setScreen, token, players, state, refresh }: { setScreen: (screen: Screen) => void; token: string; players: Player[]; state: SquadState; refresh: () => Promise<void> }) {
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const activeSlots = useMemo(() => state.active.flatMap((entry) => { const player = players.find((candidate) => candidate.ticker === entry.symbol); return player ? [{ id: String(entry.id), player }] : []; }), [players, state.active]);
  const reserveSlots = useMemo(() => state.reserve.flatMap((entry) => { const player = players.find((candidate) => candidate.ticker === entry.symbol); return player ? [{ id: `reserve-${entry.player_id}`, player }] : []; }), [players, state.reserve]);

  const mutate = async (slot: SquadSlot, destination: 'active' | 'reserve') => {
    if (pending) return;
    setPending(true); setError('');
    try {
      if (destination === 'active') await promoteSquad(token, slot.player.ticker);
      else await demoteSquad(token, slot.player.ticker);
      await refresh();
      setStatusMessage(`${slot.player.name} moved to ${destination === 'active' ? 'Active' : 'Reserve'}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update squad.'); }
    finally { setPending(false); }
  };

  return <div className="fy-screen">
    <BlurFade><h1 className="fy-page-title">Squad</h1></BlurFade>
    <p className="fy-squad-status" role="status" aria-live="polite">{statusMessage}</p>
    {error && <p className="fy-auth-error" role="alert">{error}</p>}
    <BlurFade delay={0.08}><GlassCard><CardTitle title={`Active Squad ${activeSlots.length}/${state.active_capacity}`} /><SquadGrid slots={activeSlots} capacity={state.active_capacity} active actionDisabled={pending || reserveSlots.length >= state.reserve_capacity} onReserve={(slot) => { void mutate(slot, 'reserve'); }} onEmpty={() => setScreen('markets')} /></GlassCard></BlurFade>
    <BlurFade delay={0.14}><GlassCard><CardTitle title={`Reserve Squad ${reserveSlots.length}/${state.reserve_capacity}`} /><SquadGrid slots={reserveSlots} capacity={state.reserve_capacity} actionDisabled={pending || activeSlots.length >= state.active_capacity} onActivate={(slot) => { void mutate(slot, 'active'); }} onEmpty={() => setScreen('markets')} /></GlassCard></BlurFade>
  </div>;
}

function SquadGrid({ slots, capacity, active = false, actionDisabled = false, onReserve, onActivate, onEmpty }: { slots: SquadSlot[]; capacity: number; active?: boolean; actionDisabled?: boolean; onReserve?: (slot: SquadSlot) => void; onActivate?: (slot: SquadSlot) => void; onEmpty: () => void }) {
  return <div className={`fy-squad-grid ${active ? '' : 'fy-squad-reserve'}`}>
    {slots.map((slot) => <div className="fy-squad-card" key={slot.id}>
      <Avatar name={slot.player.name} fallback={slot.player.photo} showStatus={false} />
      <strong>{slot.player.ticker}</strong><span><CurrencyAmount>{slot.player.price}</CurrencyAmount></span>
      {active && <Badge variant="success">Active</Badge>}
      {active ? <HoldAndReleaseButton disabled={actionDisabled} idleLabel={actionDisabled ? 'Reserve Full' : 'Hold to Reserve'} aria-label={`Hold to move ${slot.player.name} to reserve`} onComplete={() => onReserve?.(slot)} /> : <Button disabled={actionDisabled} size="sm" variant="secondary" onClick={() => onActivate?.(slot)}>{actionDisabled ? 'Active Full' : 'Move to Active'}</Button>}
    </div>)}
    {Array.from({ length: Math.max(capacity - slots.length, 0) }, (_, index) => <Button variant="ghost" className="fy-empty-slot" key={`empty-${index}`} onClick={onEmpty}>+ Add from Markets</Button>)}
  </div>;
}
