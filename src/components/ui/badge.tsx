import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export const badgeVariants = cva(
  'fy-badge inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] motion-reduce:transition-none',
  {
    variants: {
      variant: {
        neutral:
          'border-[var(--edge)] bg-[color-mix(in_srgb,var(--mauve)_25%,var(--glass))] text-[var(--text)]',
        success:
          'border-[color:color-mix(in_srgb,var(--green)_58%,var(--edge))] bg-[color-mix(in_srgb,var(--green)_32%,transparent)] text-[var(--text)]',
        warning:
          'border-[color:color-mix(in_srgb,var(--gold)_58%,var(--edge))] bg-[color-mix(in_srgb,var(--gold)_24%,transparent)] text-[var(--text)]',
        danger:
          'border-[color:color-mix(in_srgb,var(--red)_58%,var(--edge))] bg-[color-mix(in_srgb,var(--red)_26%,transparent)] text-[var(--text)]',
        info:
          'border-[color:color-mix(in_srgb,var(--teal)_58%,var(--edge))] bg-[color-mix(in_srgb,var(--teal)_28%,transparent)] text-[var(--text)]',
        outline: 'border-[var(--edge)] bg-transparent text-[var(--text)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';
