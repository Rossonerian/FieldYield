import { memo, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { createTradeParticles, type TradeButtonType, type TradeParticle } from './trade-particles';

type ParticleBurst = { id: number; particles: TradeParticle[]; originX: number; originY: number };

export type TradeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  type: TradeButtonType;
  buttonType?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

const removeAfter = { buy: 560, sell: 660 } satisfies Record<TradeButtonType, number>;
const duration = { buy: 0.5, sell: 0.6 } satisfies Record<TradeButtonType, number>;

export function TradeButton({ type, buttonType = 'button', className, onClick, disabled, children, ...props }: TradeButtonProps) {
  const reduceMotion = useReducedMotion();
  const burstCounter = useRef(0);
  const cleanupTimers = useRef(new Map<number, number>());
  const [bursts, setBursts] = useState<ParticleBurst[]>([]);

  const removeBurst = useCallback((id: number) => {
    setBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled || reduceMotion) return;

    const { width, height, left, top } = event.currentTarget.getBoundingClientRect();
    const id = ++burstCounter.current;
    setBursts((current) => [...current.slice(-2), { id, particles: createTradeParticles(type, width, height, id), originX: left + width / 2, originY: top + height / 2 }]);
    const timer = window.setTimeout(() => {
      removeBurst(id);
      cleanupTimers.current.delete(id);
    }, removeAfter[type]);
    cleanupTimers.current.set(id, timer);
  }, [disabled, onClick, reduceMotion, removeBurst, type]);

  useEffect(() => () => {
    cleanupTimers.current.forEach((timer) => window.clearTimeout(timer));
    cleanupTimers.current.clear();
  }, []);

  return <>
    <button {...props} type={buttonType} disabled={disabled} className={cn('fy-trade-button', `fy-trade-${type}`, className)} onClick={handleClick}>
      <span className="fy-trade-label">{children}</span>
    </button>
    {bursts.length > 0 && createPortal(
      <>
        {bursts.map((burst) => (
            <span key={burst.id} className="fy-trade-particle-portal" style={{ left: burst.originX, top: burst.originY }} aria-hidden="true">
              <CoinFlash type={type} />
              {burst.particles.map((particle) => <CoinParticle key={particle.id} particle={particle} type={type} />)}
            </span>
        ))}
      </>,
      document.body,
    )}
  </>;
}

const CoinParticle = memo(function CoinParticle({ particle, type }: { particle: TradeParticle; type: TradeButtonType }) {
  return (
    <motion.span
      className={cn('fy-trade-coin', `fy-trade-coin-${particle.kind}`)}
      initial={{ x: particle.fromX, y: particle.fromY, scale: 1, opacity: 1 }}
      animate={{ x: particle.toX, y: particle.toY, scale: type === 'buy' ? 0.35 : 0.5, opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration[type], delay: particle.delay, ease: type === 'buy' ? [0.2, 0.9, 0.2, 1] : [0.16, 1, 0.3, 1] }}
      style={{ width: particle.size, height: particle.size, marginLeft: -particle.size / 2, marginTop: -particle.size / 2 }}
    />
  );
});

function CoinFlash({ type }: { type: TradeButtonType }) {
  return (
    <motion.span
      className={cn('fy-trade-flash', `fy-trade-flash-${type}`)}
      initial={{ opacity: 0, scale: 0.35 }}
      animate={{ opacity: [0, 0.5, 0], scale: [0.35, 1.2, 1.55] }}
      exit={{ opacity: 0 }}
      transition={{ duration: type === 'buy' ? 0.34 : 0.42, delay: type === 'buy' ? 0.18 : 0.04, ease: 'easeOut' }}
    />
  );
}
