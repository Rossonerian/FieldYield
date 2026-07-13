import { useMemo, useState } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyAmount } from '@/components/ui/currency-icon';
import { CardTitle, GlassCard } from '@/components/shared/field-components';
import { HoldAndReleaseButton } from '@/features/trading/HoldAndReleaseButton';
import { players, type Player, type Screen } from '@/data/fieldyield';

type SquadSlot = { id: string; player: Player };

function createSlots(prefix: string, count: number, offset = 0): SquadSlot[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, player: players[(index + offset) % players.length] }));
}

export function Squad({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const initialActive = useMemo(() => createSlots('active', 18), []);
  const initialReserve = useMemo(() => createSlots('reserve', 8, 2), []);
  const [activeSlots, setActiveSlots] = useState(initialActive);
  const [reserveSlots, setReserveSlots] = useState(initialReserve);
  const [statusMessage, setStatusMessage] = useState('');

  const moveToReserve = (slot: SquadSlot) => {
    if (reserveSlots.length >= 15) return;
    setActiveSlots((current) => current.filter((entry) => entry.id !== slot.id));
    setReserveSlots((current) => [...current, { ...slot, id: `reserve-${slot.id}` }]);
    setStatusMessage(`${slot.player.name} moved to Reserve.`);
  };

  const moveToActive = (slot: SquadSlot) => {
    if (activeSlots.length >= 25) return;
    setReserveSlots((current) => current.filter((entry) => entry.id !== slot.id));
    setActiveSlots((current) => [...current, { ...slot, id: `active-${slot.id}` }]);
    setStatusMessage(`${slot.player.name} moved to Active.`);
  };

  return (
    <div className="fy-screen">
      <BlurFade><h1 className="fy-page-title">Squad</h1></BlurFade>
      <p className="fy-squad-status" role="status" aria-live="polite">{statusMessage}</p>
      <BlurFade><GlassCard><CardTitle title="Pre-Season Team Bonds" action={<Button size="sm" variant="secondary">Add Team Bond</Button>} /><div className="fy-team-bonds">{[
        { team: 'Arsenal', amount: '4,000', detail: 'YoY league position' },
        { team: 'Real Madrid', amount: '3,500', detail: 'YoY league position' },
      ].map((bond) => <div className="fy-bond" key={bond.team}>{bond.team} · <CurrencyAmount>{bond.amount}</CurrencyAmount> · {bond.detail}</div>)}<div className="fy-bond">Add Team Bond</div></div></GlassCard></BlurFade>
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
          {active && <Badge variant="warning"><CurrencyAmount>Earning</CurrencyAmount></Badge>}
          {active
            ? <HoldAndReleaseButton disabled={actionDisabled} idleLabel={actionDisabled ? 'Reserve Full' : 'Hold to Reserve'} aria-label={`Hold to move ${slot.player.name} to reserve`} onComplete={() => onReserve?.(slot)} />
            : <Button disabled={actionDisabled} size="sm" variant="secondary" onClick={() => onActivate?.(slot)}>{actionDisabled ? 'Active Full' : 'Move to Active'}</Button>}
        </div>
      ))}
      {Array.from({ length: Math.max(capacity - slots.length, 0) }, (_, index) => <Button variant="ghost" className="fy-empty-slot" key={`empty-${index}`} onClick={onEmpty}>+ Add from Markets</Button>)}
    </div>
  );
}
