import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type PointerEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { CheckIcon, type CheckIconHandle } from '@/components/ui/check';
import { cn } from '@/lib/utils';
import { useReducedMotion } from 'motion/react';

type HoldState = 'idle' | 'holding' | 'completed' | 'cancelled';

type HoldAndReleaseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown'> & {
  onComplete: () => void;
  holdDuration?: number;
  idleLabel?: string;
};

export function HoldAndReleaseButton({ onComplete, holdDuration = 900, idleLabel = 'Hold to Reserve', className, disabled, ...props }: HoldAndReleaseButtonProps) {
  const [state, setState] = useState<HoldState>('idle');
  const timer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const activeInput = useRef<'pointer' | 'keyboard' | null>(null);
  const completed = useRef(false);
  const checkRef = useRef<CheckIconHandle>(null);
  const reduceMotion = useReducedMotion();
  const instructionsId = `fy-hold-instructions-${useId().replaceAll(':', '')}`;

  const clearTimers = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    timer.current = null;
    resetTimer.current = null;
  }, []);

  const resetLater = useCallback((delay: number) => {
    resetTimer.current = window.setTimeout(() => {
      setState('idle');
      completed.current = false;
      activeInput.current = null;
    }, delay);
  }, []);

  const start = useCallback((input: 'pointer' | 'keyboard') => {
    if (disabled || state === 'holding' || state === 'completed') return;
    clearTimers();
    activeInput.current = input;
    completed.current = false;
    setState('holding');
    timer.current = window.setTimeout(() => {
      completed.current = true;
      setState('completed');
      activeInput.current = null;
      onComplete();
      resetLater(800);
    }, holdDuration);
  }, [clearTimers, disabled, holdDuration, onComplete, resetLater, state]);

  const cancel = useCallback(() => {
    if (state !== 'holding' || completed.current) return;
    clearTimers();
    activeInput.current = null;
    setState('cancelled');
    resetLater(420);
  }, [clearTimers, resetLater, state]);

  useEffect(() => {
    if (state !== 'holding') return;
    const endPointerHold = () => cancel();
    const endKeyboardHold = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') cancel();
    };
    const cancelOnBlur = () => cancel();
    if (activeInput.current === 'pointer') {
      window.addEventListener('pointerup', endPointerHold, { once: true });
      window.addEventListener('pointercancel', endPointerHold, { once: true });
    } else {
      window.addEventListener('keyup', endKeyboardHold);
    }
    window.addEventListener('blur', cancelOnBlur, { once: true });
    return () => {
      window.removeEventListener('pointerup', endPointerHold);
      window.removeEventListener('pointercancel', endPointerHold);
      window.removeEventListener('keyup', endKeyboardHold);
      window.removeEventListener('blur', cancelOnBlur);
    };
  }, [cancel, state]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (state === 'completed' && !reduceMotion) checkRef.current?.startAnimation();
  }, [reduceMotion, state]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    start('pointer');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      start('keyboard');
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cancel();
    }
  };

  const label = state === 'holding' ? 'Keep holding…' : state === 'completed' ? 'Reserved' : state === 'cancelled' ? 'Hold cancelled' : idleLabel;

  return (
    <button
      {...props}
      type="button"
      className={cn('fy-hold-button', `fy-hold-${state}`, className)}
      style={{ '--fy-hold-duration': `${holdDuration}ms` } as React.CSSProperties}
      disabled={disabled}
      data-state={state}
      aria-describedby={instructionsId}
      onClick={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={cancel}
    >
      <span className="fy-hold-progress" aria-hidden="true" />
      <span className="fy-hold-content">{state === 'completed' && <CheckIcon ref={checkRef} className="fy-animated-icon" size={15} animateOnHover={false} aria-hidden="true" />}{state === 'cancelled' && <RotateCcw size={15} aria-hidden="true" />}{label}</span>
      <span id={instructionsId} className="fy-sr-only">Hold until progress completes. Releasing early cancels.</span>
      <span className="fy-sr-only" aria-live="polite">{state === 'completed' || state === 'cancelled' ? label : ''}</span>
    </button>
  );
}
