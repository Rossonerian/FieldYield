import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Circle, Minus, TrendingDown, TrendingUp, Triangle } from 'lucide-react';

import { cn } from '../../lib/utils';

export type DeltaType = 'increase' | 'decrease' | 'neutral';
export type DeltaIconStyle = 'line' | 'filled';

export function getDeltaType(value: number): DeltaType {
  if (value > 0) return 'increase';
  if (value < 0) return 'decrease';
  return 'neutral';
}

export const badgeDeltaVariants = cva(
  'fy-badge-delta inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold tabular-nums leading-none',
  {
    variants: {
      deltaType: {
        increase:
          'border-[color:color-mix(in_srgb,var(--green)_56%,var(--edge))] bg-[color-mix(in_srgb,var(--green)_28%,transparent)] text-[var(--text)]',
        decrease:
          'border-[color:color-mix(in_srgb,var(--red)_56%,var(--edge))] bg-[color-mix(in_srgb,var(--red)_25%,transparent)] text-[var(--text)]',
        neutral:
          'border-[var(--edge)] bg-[color-mix(in_srgb,var(--mauve)_22%,transparent)] text-[var(--muted)]',
      },
      variant: {
        outline: 'bg-transparent shadow-none',
        solid: 'border-transparent shadow-none',
        solidOutline: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
      },
    },
    defaultVariants: {
      deltaType: 'neutral',
      variant: 'solidOutline',
    },
  },
);

export interface BadgeDeltaProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    Omit<VariantProps<typeof badgeDeltaVariants>, 'deltaType'> {
  value: React.ReactNode;
  deltaType?: DeltaType;
  iconStyle?: DeltaIconStyle;
}

const deltaLabels: Record<DeltaType, string> = {
  increase: 'Increase',
  decrease: 'Decrease',
  neutral: 'No change',
};

function DeltaIcon({ deltaType, iconStyle }: { deltaType: DeltaType; iconStyle: DeltaIconStyle }) {
  if (iconStyle === 'filled') {
    if (deltaType === 'neutral') {
      return <Circle className="fy-badge-delta-icon size-2 fill-current" aria-hidden="true" />;
    }

    return (
      <Triangle
        className={cn(
          'fy-badge-delta-icon size-3 fill-current stroke-current',
          deltaType === 'decrease' && 'rotate-180',
        )}
        aria-hidden="true"
      />
    );
  }

  const Icon = deltaType === 'increase' ? TrendingUp : deltaType === 'decrease' ? TrendingDown : Minus;
  return <Icon className="fy-badge-delta-icon size-3.5" strokeWidth={2.25} aria-hidden="true" />;
}

export const BadgeDelta = React.forwardRef<HTMLSpanElement, BadgeDeltaProps>(
  ({ className, value, deltaType: deltaTypeProp, variant, iconStyle = 'line', ...props }, ref) => {
    const deltaType = deltaTypeProp ?? (typeof value === 'number' ? getDeltaType(value) : 'neutral');

    return (
      <span
        ref={ref}
        data-slot="badge-delta"
        className={cn(badgeDeltaVariants({ deltaType, variant }), className)}
        {...props}
      >
        <span className="sr-only">{deltaLabels[deltaType]}: </span>
        <DeltaIcon deltaType={deltaType} iconStyle={iconStyle} />
        <span>{value}</span>
      </span>
    );
  },
);
BadgeDelta.displayName = 'BadgeDelta';
