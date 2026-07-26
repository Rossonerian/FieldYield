import { useEffect, useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { CardTitle, GlassCard } from '@/components/shared/field-components';
import { HoldAndReleaseButton } from '@/features/trading/HoldAndReleaseButton';
import type { Player, Screen } from '@/data/fieldyield';
import { demoteSquad, fetchSquad, promoteSquad } from '@/lib/api';

type SquadSlot = { id: string; player: Player };

export function Squad({ setScreen, token, players }: { setScreen: (screen: Screen) => void; token: string; players: Player[] }) {
  const [activeSlots, setActiveSlots] = useState<SquadSlot[]>([]);
  const [reserveSlots, setReserveSlots] = useState<SquadSlot[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    fetchSquad(token).then((entries) => {
      const mapped = entries.flatMap((entry) => {
        const player = players.find((candidate) => candidate.ticker === entry.symbol);
        return player ? [{ id: String(entry.id), player }] : [];
      });
      setActiveSlots(mapped);
    }).catch(() => setError('Could not load your squad.'));
  }, [players, token]);

  const moveToReserve = (slot: SquadSlot) => {
    if (reserveSlots.length >= 15) return;
    demoteSquad(token, slot.player.ticker).then(() => { setActiveSlots((current) => current.filter((entry) => entry.id !== slot.id)); setReserveSlots((current) => [...current, { ...slot, id: `reserve-${slot.id}` }]); setStatusMessage(`${slot.player.name} moved to Reserve.`); }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not update squad.'));
  };

  const moveToActive = (slot: SquadSlot) => {
    if (activeSlots.length >= 25) return;
    promoteSquad(token, slot.player.ticker).then(() => { setReserveSlots((current) => current.filter((entry) => entry.id !== slot.id)); setActiveSlots((current) => [...current, { ...slot, id: `active-${slot.id}` }]); setStatusMessage(`${slot.player.name} moved to Active.`); }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not update squad.'));
  };

  return (
    <div className="fy-screen">
      <BlurFade><h1 className="fy-page-title">Squad</h1></BlurFade>
      <p className="fy-squad-status" role="status" aria-live="polite">{statusMessage}</p>
      {error && <p className="fy-auth-error" role="alert">{error}</p>}
      <BlurFade delay={0.08}><GlassCard><CardTitle title={`Active Squad ${activeSlots.length}/25`} /><SquadGrid slots={activeSlots} capacity={25} active actionDisabled={reserveSlots.length >= 15} onReserve={moveToReserve} onEmpty={() => setScreen('markets')} /></GlassCard></BlurFade>
      <BlurFade delay={0.14}><GlassCard><CardTitle title={`Reserve Squad ${reserveSlots.length}/15`} /><SquadGrid slots={reserveSlots} capacity={15} actionDisabled={activeSlots.length >= 25} onActivate={moveToActive} onEmpty={() => setScreen('markets')} /></GlassCard></BlurFade>
    </div>
  );
}

function SquadGrid({ slots, capacity, active = false, actionDisabled = false, onReserve, onActivate, onEmpty }: { slots: SquadSlot[]; capacity: number; active?: boolean; actionDisabled?: boolean; onReserve?: (slot: SquadSlot) => void; onActivate?: (slot: SquadSlot) => void; onEmpty: () => void }) {
  return (
    <div className={`fy-squad-grid ${active ? '' : 'fy-squad-reserve'}`}>
      {slots.map((slot) => (
        <div className="fy-squad-card" key={slot.id}>
          <Avatar name={slot.player.name} fallback={slot.player.photo} showStatus={false} />
          <strong>{slot.player.ticker}</strong><span><CurrencyAmount>{slot.player.price}</CurrencyAmount></span>
          {active && <Badge variant="success">Active</Badge>}
          {active
            ? <HoldAndReleaseButton disabled={actionDisabled} idleLabel={actionDisabled ? 'Reserve Full' : 'Hold to Reserve'} aria-label={`Hold to move ${slot.player.name} to reserve`} onComplete={() => onReserve?.(slot)} />
            : <Button disabled={actionDisabled} size="sm" variant="secondary" onClick={() => onActivate?.(slot)}>{actionDisabled ? 'Active Full' : 'Move to Active'}</Button>}
        </div>
      ))}
      {Array.from({ length: Math.max(capacity - slots.length, 0) }, (_, index) => <Button variant="ghost" className="fy-empty-slot" key={`empty-${index}`} onClick={onEmpty}>+ Add from Markets</Button>)}
    </div>
  );
}
