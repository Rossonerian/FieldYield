import goldCoinUrl from '@/assets/gold-coin.svg';
import silverCoinUrl from '@/assets/silver-coin.svg';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CurrencyKind = 'gold' | 'silver';

const currencyIconUrl: Record<CurrencyKind, string> = {
  gold: goldCoinUrl,
  silver: silverCoinUrl,
};

export function CurrencyIcon({
  kind,
  className,
  label,
}: {
  kind: CurrencyKind;
  className?: string;
  label?: string;
}) {
  return (
    <img
      src={currencyIconUrl[kind]}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={cn('fy-currency-icon', className)}
      draggable={false}
    />
  );
}

export function CurrencyAmount({
  kind = 'gold',
  children,
  className,
}: {
  kind?: CurrencyKind;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('fy-currency-value', className)}>
      <CurrencyIcon kind={kind} />
      {children}
    </span>
  );
}

export { goldCoinUrl, silverCoinUrl };
