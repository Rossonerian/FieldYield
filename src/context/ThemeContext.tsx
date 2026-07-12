import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = 'fieldyield-theme';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const ThemeContext = createContext<ThemeContextValue | null>(null);
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const prepaintTheme = document.documentElement.dataset.theme;
    if (isTheme(prepaintTheme)) return prepaintTheme;
  }

  return readStoredTheme() ?? getSystemTheme();
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function persistTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A blocked storage API must not prevent an in-session theme change.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const hasExplicitPreference = useRef(readStoredTheme() !== null);

  const setTheme = useCallback((nextTheme: Theme) => {
    hasExplicitPreference.current = true;
    applyTheme(nextTheme);
    persistTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [setTheme, theme]);

  useIsomorphicLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    if (!hasExplicitPreference.current) {
      const systemTheme: Theme = mediaQuery.matches ? 'dark' : 'light';
      applyTheme(systemTheme);
      setThemeState((currentTheme) => currentTheme === systemTheme ? currentTheme : systemTheme);
    }

    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (hasExplicitPreference.current) return;

      const systemTheme: Theme = event.matches ? 'dark' : 'light';
      applyTheme(systemTheme);
      setThemeState(systemTheme);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;

      const storedTheme = isTheme(event.newValue) ? event.newValue : null;
      hasExplicitPreference.current = storedTheme !== null;
      const nextTheme = storedTheme ?? getSystemTheme();
      applyTheme(nextTheme);
      setThemeState(nextTheme);
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
