import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

import { cn } from '../../lib/utils';

type MotionViewport = NonNullable<HTMLMotionProps<'div'>['viewport']>;

export interface BlurFadeProps
  extends Omit<
    HTMLMotionProps<'div'>,
    'initial' | 'animate' | 'whileInView' | 'transition' | 'viewport'
  > {
  delay?: number;
  duration?: number;
  yOffset?: number;
  blur?: number;
  inView?: boolean;
  once?: boolean;
  inViewMargin?: MotionViewport['margin'];
}

export const BlurFade = React.forwardRef<HTMLDivElement, BlurFadeProps>(
  (
    {
      children,
      className,
      delay = 0,
      duration = 0.38,
      yOffset = 10,
      blur = 8,
      inView = false,
      once = true,
      inViewMargin = '-32px',
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const hidden = { opacity: 0, y: yOffset, filter: `blur(${blur}px)` };
    const visible = { opacity: 1, y: 0, filter: 'blur(0px)' };

    return (
      <motion.div
        ref={ref}
        data-slot="blur-fade"
        className={cn('fy-blur-fade', className)}
        initial={reduceMotion ? false : hidden}
        animate={!inView || reduceMotion ? visible : undefined}
        whileInView={inView && !reduceMotion ? visible : undefined}
        viewport={inView && !reduceMotion ? { once, margin: inViewMargin } : undefined}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration, delay, ease: [0.16, 1, 0.3, 1] }
        }
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
BlurFade.displayName = 'BlurFade';
