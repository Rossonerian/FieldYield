import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  [
    'fy-button group relative isolate inline-flex shrink-0 select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border text-sm font-semibold',
    'transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out',
    'before:pointer-events-none before:absolute before:inset-x-px before:top-px before:-z-10 before:h-1/2 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/35 before:to-transparent before:content-[\'\']',
    'hover:-translate-y-0.5 active:translate-y-px active:scale-[0.985]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]',
    'disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
    'motion-reduce:transform-none motion-reduce:transition-none',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-[color:color-mix(in_srgb,var(--pink)_72%,white)] bg-[var(--pink)] text-[var(--solid-white)] shadow-[0_5px_0_color-mix(in_srgb,var(--pink)_72%,black),0_10px_20px_rgba(92,83,70,0.16)] hover:bg-[color-mix(in_srgb,var(--pink)_90%,black)] hover:shadow-[0_6px_0_color-mix(in_srgb,var(--pink)_72%,black),0_12px_22px_rgba(92,83,70,0.18)] active:shadow-[0_1px_0_color-mix(in_srgb,var(--pink)_70%,black),0_4px_9px_rgba(92,83,70,0.14)]',
        secondary:
          'border-[var(--edge)] bg-[color-mix(in_srgb,var(--teal)_58%,var(--glass))] text-[var(--text)] shadow-[0_4px_0_color-mix(in_srgb,var(--teal)_64%,black),0_8px_16px_rgba(92,83,70,0.12)] hover:bg-[color-mix(in_srgb,var(--teal)_70%,var(--glass))] active:shadow-[0_1px_0_color-mix(in_srgb,var(--teal)_60%,black),0_3px_8px_rgba(92,83,70,0.1)]',
        ghost:
          'border-transparent bg-transparent text-[var(--text)] shadow-none before:hidden hover:bg-[color-mix(in_srgb,var(--mauve)_24%,transparent)] active:shadow-none',
        filter:
          'rounded-full border-[var(--edge)] bg-[color-mix(in_srgb,var(--glass)_78%,transparent)] text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_3px_8px_rgba(92,83,70,0.1)] hover:bg-[color-mix(in_srgb,var(--teal)_30%,var(--glass))] aria-[pressed=true]:border-[color:color-mix(in_srgb,var(--pink)_55%,var(--edge))] aria-[pressed=true]:bg-[var(--pink)] aria-[pressed=true]:text-[var(--solid-white)] aria-[pressed=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_10px_color-mix(in_srgb,var(--pink)_26%,transparent)] active:shadow-[inset_0_1px_2px_rgba(92,83,70,0.2)]',
        success:
          'border-[color:color-mix(in_srgb,var(--green)_72%,white)] bg-[var(--green)] text-[var(--solid-black)] shadow-[0_4px_0_color-mix(in_srgb,var(--green)_68%,black),0_8px_16px_rgba(92,83,70,0.12)] hover:bg-[color-mix(in_srgb,var(--green)_88%,white)] active:shadow-[0_1px_0_color-mix(in_srgb,var(--green)_68%,black),0_3px_8px_rgba(92,83,70,0.1)]',
        danger:
          'border-[color:color-mix(in_srgb,var(--red)_72%,white)] bg-[var(--red)] text-[var(--solid-white)] shadow-[0_4px_0_color-mix(in_srgb,var(--red)_68%,black),0_8px_16px_rgba(92,83,70,0.12)] hover:bg-[color-mix(in_srgb,var(--red)_90%,black)] active:shadow-[0_1px_0_color-mix(in_srgb,var(--red)_68%,black),0_3px_8px_rgba(92,83,70,0.1)]',
        neutral:
          'border-[var(--edge)] bg-[color-mix(in_srgb,var(--mauve)_32%,var(--glass))] text-[var(--text)] shadow-[0_4px_0_color-mix(in_srgb,var(--mauve)_60%,black),0_8px_16px_rgba(92,83,70,0.1)] hover:bg-[color-mix(in_srgb,var(--mauve)_46%,var(--glass))] active:shadow-[0_1px_0_color-mix(in_srgb,var(--mauve)_58%,black),0_3px_8px_rgba(92,83,70,0.08)]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4 py-2',
        lg: 'h-11 px-6 text-base',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, type, variant, size, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        type={asChild ? undefined : (type ?? 'button')}
        data-slot="button"
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
