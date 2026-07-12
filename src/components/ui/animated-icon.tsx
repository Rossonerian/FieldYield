import type { ComponentType, HTMLAttributes } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export type AnimatedIconComponent = ComponentType<
  HTMLAttributes<HTMLDivElement> & {
    size?: number;
    animateOnHover?: boolean;
  }
>;

export type AnimatedIconProps = HTMLAttributes<HTMLDivElement> & {
  icon: AnimatedIconComponent;
  size?: number;
  animateOnHover?: boolean;
};

/** Shared adapter for the individually imported Lucide Animated components. */
export function AnimatedIcon({ icon: Icon, size = 18, animateOnHover = true, className, ...props }: AnimatedIconProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Icon
      {...props}
      className={cn('fy-animated-icon', className)}
      size={size}
      animateOnHover={reduceMotion ? false : animateOnHover}
    />
  );
}
