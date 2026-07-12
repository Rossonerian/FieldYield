import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

import { cn } from '../../lib/utils';

export type AlertState = 'new' | 'warning' | 'critical' | 'success' | 'informational';

export const alertBadgeVariants = cva(
  'fy-alert-badge inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-full border px-1.5 text-[0.6875rem] font-bold leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_7px_rgba(92,83,70,0.12)]',
  {
    variants: {
      status: {
        new: 'border-[color:color-mix(in_srgb,var(--pink)_56%,var(--edge))] bg-[var(--pink)] text-[var(--solid-white)]',
        warning:
          'border-[color:color-mix(in_srgb,var(--gold)_60%,var(--edge))] bg-[color-mix(in_srgb,var(--gold)_72%,var(--glass))] text-[var(--text)]',
        critical:
          'border-[color:color-mix(in_srgb,var(--red)_64%,var(--edge))] bg-[var(--red)] text-[var(--solid-white)]',
        success:
          'border-[color:color-mix(in_srgb,var(--green)_60%,var(--edge))] bg-[var(--green)] text-[var(--solid-black)]',
        informational:
          'border-[color:color-mix(in_srgb,var(--teal)_58%,var(--edge))] bg-[color-mix(in_srgb,var(--teal)_66%,var(--glass))] text-[var(--text)]',
      },
    },
    defaultVariants: {
      status: 'informational',
    },
  },
);

const alertLabels: Record<AlertState, string> = {
  new: 'New',
  warning: 'Warning',
  critical: 'Critical',
  success: 'Success',
  informational: 'Information',
};

export interface AlertBadgeProps
  extends Omit<HTMLMotionProps<'span'>, 'children' | 'initial' | 'animate' | 'transition'>,
    VariantProps<typeof alertBadgeVariants> {
  children?: React.ReactNode;
  count?: number;
  maxCount?: number;
}

export const AlertBadge = React.forwardRef<HTMLSpanElement, AlertBadgeProps>(
  (
    {
      className,
      status = 'informational',
      children,
      count,
      maxCount = 99,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const resolvedStatus: AlertState = status ?? 'informational';
    const safeCount = typeof count === 'number' ? Math.max(0, count) : undefined;
    const visibleCount = safeCount !== undefined && safeCount > maxCount ? `${maxCount}+` : safeCount;
    const visibleContent =
      children ?? (visibleCount !== undefined ? visibleCount : alertLabels[resolvedStatus]);
    const accessibleLabel =
      ariaLabel ??
      (safeCount !== undefined
        ? `${alertLabels[resolvedStatus]}: ${safeCount} unread notification${safeCount === 1 ? '' : 's'}`
        : alertLabels[resolvedStatus]);

    return (
      <motion.span
        ref={ref}
        data-slot="alert-badge"
        className={cn(alertBadgeVariants({ status: resolvedStatus }), className)}
        aria-label={accessibleLabel}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        {...props}
      >
        {visibleContent}
      </motion.span>
    );
  },
);
AlertBadge.displayName = 'AlertBadge';
