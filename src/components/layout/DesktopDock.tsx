import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';

import {
  primaryNavigationItems,
  settingsNavigationItem,
  type NavigationId,
  type NavigationItem,
} from '@/app/navigation';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

export type DesktopDockProps = {
  activePage: string;
  onNavigate: (page: NavigationId) => void;
  className?: string;
};

export function DesktopDock({ activePage, onNavigate, className }: DesktopDockProps) {
  const pointerX = useMotionValue(Number.POSITIVE_INFINITY);
  const reduceMotion = useReducedMotion();

  return (
    <motion.nav
      className={cn('fy-desktop-dock', className)}
      aria-label="Primary navigation"
      initial={reduceMotion ? false : { opacity: 0, y: 18, x: '-50%', scale: 0.96 }}
      animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
      }
      onPointerMove={(event) => pointerX.set(event.clientX)}
      onPointerLeave={() => pointerX.set(Number.POSITIVE_INFINITY)}
    >
      <div className="fy-desktop-dock-group">
        {primaryNavigationItems.map((item) => (
          <DockItem
            key={item.id}
            item={item}
            active={activePage === item.id}
            pointerX={pointerX}
            reduceMotion={Boolean(reduceMotion)}
            onSelect={onNavigate}
          />
        ))}
      </div>

      <span className="fy-desktop-dock-divider" aria-hidden="true" />

      {settingsNavigationItem && (
        <DockItem
          item={settingsNavigationItem}
          active={activePage === settingsNavigationItem.id}
          pointerX={pointerX}
          reduceMotion={Boolean(reduceMotion)}
          onSelect={onNavigate}
        />
      )}
    </motion.nav>
  );
}

type DockItemProps = {
  item: NavigationItem;
  active: boolean;
  pointerX: MotionValue<number>;
  reduceMotion: boolean;
  onSelect: (page: NavigationId) => void;
};

function DockItem({ item, active, pointerX, reduceMotion, onSelect }: DockItemProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const distance = useTransform(pointerX, (latest) => {
    const bounds = buttonRef.current?.getBoundingClientRect();
    return bounds ? latest - bounds.left - bounds.width / 2 : Number.POSITIVE_INFINITY;
  });
  const scaleTarget = active ? [1.08, 1.34, 1.08] : [1, 1.34, 1];
  const yTarget = active ? [-2, -8, -2] : [0, -7, 0];
  const scale = useSpring(useTransform(distance, [-120, 0, 120], scaleTarget), {
    stiffness: 360,
    damping: 28,
    mass: 0.42,
  });
  const y = useSpring(useTransform(distance, [-120, 0, 120], yTarget), {
    stiffness: 360,
    damping: 30,
    mass: 0.42,
  });
  const Icon = item.icon;

  return (
    <Tooltip content={item.label}>
    <motion.button
      ref={buttonRef}
      type="button"
      className="fy-desktop-dock-item"
      style={reduceMotion ? undefined : { scale, y }}
      onClick={() => onSelect(item.id)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <motion.span
          className="fy-desktop-dock-active-indicator"
          layoutId="fy-desktop-dock-active-indicator"
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 34 }
          }
          aria-hidden="true"
        />
      )}
      <motion.span
        className="fy-desktop-dock-icon"
        aria-hidden="true"
        animate={active && !reduceMotion ? { rotate: [0, -3, 3, 0] } : { rotate: 0 }}
        whileHover={!reduceMotion ? { rotate: [0, -4, 4, 0] } : undefined}
        transition={{ duration: 0.38, ease: 'easeInOut' }}
      >
        <Icon size={22} strokeWidth={2.2} />
      </motion.span>
    </motion.button>
    </Tooltip>
  );
}
