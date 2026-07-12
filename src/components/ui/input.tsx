import * as React from 'react';

import { cn } from '../../lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'fy-input flex h-10 w-full rounded-xl border border-[var(--edge)] bg-[color-mix(in_srgb,var(--glass)_82%,transparent)] px-3 py-2 text-sm text-[var(--text)] shadow-[inset_0_1px_2px_rgba(92,83,70,0.08),inset_0_1px_0_rgba(255,255,255,0.26)] outline-none backdrop-blur-lg',
        'placeholder:text-[var(--muted)] placeholder:opacity-100',
        'transition-[border-color,box-shadow,background-color] duration-200',
        'hover:bg-[color-mix(in_srgb,var(--glass)_92%,transparent)] focus-visible:border-[var(--pink)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--pink)_32%,transparent)]',
        'aria-[invalid=true]:border-[var(--red)] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[color:color-mix(in_srgb,var(--red)_28%,transparent)]',
        'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        'file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text)]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
