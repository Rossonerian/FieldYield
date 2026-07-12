import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export type AvatarStatus = 'online' | 'away' | 'offline' | 'do-not-disturb';

const avatarVariants = cva(
  'fy-avatar group relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full align-middle outline-none transition-transform duration-200 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[var(--pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] motion-reduce:transform-none motion-reduce:transition-none',
  {
    variants: {
      size: {
        sm: 'size-8 text-xs',
        default: 'size-10 text-sm',
        lg: 'size-12 text-base',
        xl: 'size-16 text-lg',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

const statusVariants = cva(
  'fy-avatar-status absolute bottom-0 right-0 z-10 rounded-full border-2 border-[var(--canvas)] shadow-sm',
  {
    variants: {
      status: {
        online: 'bg-emerald-500',
        away: 'bg-amber-400',
        offline: 'bg-slate-400',
        'do-not-disturb': 'bg-rose-500',
      },
      size: {
        sm: 'size-2.5',
        default: 'size-3',
        lg: 'size-3.5',
        xl: 'size-4',
      },
    },
    defaultVariants: {
      status: 'online',
      size: 'default',
    },
  },
);

const statusLabels: Record<AvatarStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
  'do-not-disturb': 'Do not disturb',
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | null;
  alt?: string;
  fallback?: React.ReactNode;
  status?: AvatarStatus;
  statusLabel?: string;
  showStatus?: boolean;
  decorative?: boolean;
  imageClassName?: string;
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      className,
      name,
      src,
      alt,
      fallback,
      status = 'online',
      statusLabel,
      showStatus = true,
      decorative = false,
      size,
      imageClassName,
      ...props
    },
    ref,
  ) => {
    const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
    const hasImage = Boolean(src) && failedSrc !== src;

    return (
      <span
        ref={ref}
        data-slot="avatar"
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        <span className="fy-avatar-frame flex size-full overflow-hidden rounded-full border border-[var(--edge)] bg-[color-mix(in_srgb,var(--teal)_48%,var(--glass))] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_10px_rgba(92,83,70,0.12)]">
          {hasImage ? (
            <img
              src={src ?? undefined}
              alt={decorative ? '' : (alt ?? name)}
              className={cn('fy-avatar-image size-full object-cover', imageClassName)}
              onError={() => setFailedSrc(src ?? null)}
            />
          ) : (
            <span
              className="fy-avatar-fallback flex size-full items-center justify-center font-semibold uppercase tracking-wide"
              role={decorative ? undefined : 'img'}
              aria-label={decorative ? undefined : (alt ?? name)}
              aria-hidden={decorative || undefined}
            >
              <span aria-hidden="true">{fallback ?? getInitials(name)}</span>
            </span>
          )}
        </span>

        {showStatus && (
          <span
            className={statusVariants({ status, size })}
            role="img"
            aria-label={statusLabel ?? statusLabels[status]}
          />
        )}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';
