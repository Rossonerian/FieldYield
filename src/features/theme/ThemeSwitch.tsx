import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

export type ThemeSwitchProps = {
  className?: string;
};

export function ThemeSwitch({ className }: ThemeSwitchProps) {
  const { theme, setTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const generatedId = useId();
  const inputId = `fy-theme-switch-${generatedId.replace(/:/g, '')}`;
  const darkMode = theme === 'dark';
  const actionLabel = `Switch to ${darkMode ? 'light' : 'dark'} mode`;
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 470, damping: 32, mass: 0.55 };

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'fy-theme-switch relative inline-flex h-9 w-[4.25rem] shrink-0 cursor-pointer select-none items-center rounded-full',
        className,
      )}
      title={actionLabel}
      data-theme={theme}
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
    >
      <input
        id={inputId}
        className="fy-theme-switch-input peer sr-only"
        type="checkbox"
        checked={darkMode}
        onChange={(event) => setTheme(event.currentTarget.checked ? 'dark' : 'light')}
        aria-label={actionLabel}
      />

      <span
        className={cn(
          'fy-theme-switch-track absolute inset-0 overflow-hidden rounded-full border border-[var(--edge)]',
          'bg-[color-mix(in_srgb,var(--teal)_58%,var(--glass))] shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_4px_12px_rgba(35,53,54,0.14)]',
          'transition-[background-color,box-shadow] duration-300 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--pink)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--canvas)]',
          'motion-reduce:transition-none',
        )}
        aria-hidden="true"
      >
        <motion.span
          className="fy-theme-switch-stars absolute inset-0"
          initial={false}
          animate={{ opacity: darkMode ? 1 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22 }}
        >
          <span className="fy-theme-switch-star absolute left-2.5 top-2 size-1 rounded-full bg-white/85 shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
          <span className="fy-theme-switch-star absolute left-[1.15rem] top-[1.25rem] size-0.5 rounded-full bg-white/70" />
          <span className="fy-theme-switch-star absolute left-[1.65rem] top-1.5 size-0.5 rounded-full bg-white/80" />
        </motion.span>

        <motion.span
          className="fy-theme-switch-clouds absolute inset-0"
          initial={false}
          animate={{ opacity: darkMode ? 0 : 1, x: darkMode ? -5 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: 'easeOut' }}
        >
          <span className="fy-theme-switch-cloud absolute bottom-1 right-1.5 h-2.5 w-7 rounded-full bg-white/65" />
          <span className="fy-theme-switch-cloud absolute bottom-2 right-3 size-3 rounded-full bg-white/75" />
          <span className="fy-theme-switch-cloud absolute bottom-[0.4rem] right-1.5 size-3.5 rounded-full bg-white/60" />
        </motion.span>

        <motion.span
          className={cn(
            'fy-theme-switch-orb absolute left-0 top-0.5 grid size-8 place-items-center rounded-full border border-white/45',
            'bg-[var(--glass)] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_3px_9px_rgba(35,53,54,0.24)]',
          )}
          initial={false}
          animate={{ x: darkMode ? 34 : 2, rotate: darkMode ? 180 : 0 }}
          transition={transition}
        >
          <motion.span
            className="fy-theme-switch-sun absolute grid place-items-center"
            initial={false}
            animate={{ opacity: darkMode ? 0 : 1, scale: darkMode ? 0.7 : 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          >
            <Sun size={16} strokeWidth={2.25} aria-hidden="true" />
          </motion.span>
          <motion.span
            className="fy-theme-switch-moon absolute grid place-items-center"
            initial={false}
            animate={{ opacity: darkMode ? 1 : 0, scale: darkMode ? 1 : 0.7 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          >
            <Moon size={15} strokeWidth={2.25} aria-hidden="true" />
          </motion.span>
        </motion.span>
      </span>
    </label>
  );
}
