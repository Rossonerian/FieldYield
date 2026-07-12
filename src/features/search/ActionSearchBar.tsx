import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SendHorizontal } from 'lucide-react';
import { SearchIcon } from '@/components/ui/search';

import { Button } from '@/components/ui/button';
import { AnimatedIcon } from '@/components/ui/animated-icon';

export const SEARCH_FILTERS = [
  'All',
  'Players',
  'Markets',
  'Portfolio',
  'Trading',
  'Commands',
  'Notifications',
  'Watchlist',
  'Settings',
] as const;

export type SearchFilter = (typeof SEARCH_FILTERS)[number];
export type SearchCategory = Exclude<SearchFilter, 'All'>;
export type SearchItemType =
  | 'Player'
  | 'Market'
  | 'Page'
  | 'Action'
  | 'Trading'
  | 'Portfolio'
  | 'Command'
  | 'Notification'
  | 'Watchlist'
  | 'Settings';

export type SearchItem = {
  /** A stable, application-wide identifier used for result identity and recents. */
  id: string;
  title: string;
  subtitle: string;
  /** The concise result label shown at the end of a result row. */
  type: SearchItemType;
  /** The filter bucket for this existing application action. */
  category: SearchCategory;
  section?: 'Quick Actions' | 'Most Traded Players';
  shortcut?: string;
  keywords?: readonly string[];
  icon: React.ReactNode;
  action: () => void;
};

export type ActionSearchBarProps = {
  items: readonly SearchItem[];
  placeholder?: string;
  className?: string;
};

type DisplaySection =
  | 'Recent Searches'
  | 'Players'
  | 'Quick Actions'
  | 'Most Traded Players'
  | 'Results';

type SearchEntry = {
  item: SearchItem;
  section?: DisplaySection;
};

const DISPLAY_SECTIONS: readonly DisplaySection[] = [
  'Recent Searches',
  'Players',
  'Quick Actions',
  'Most Traded Players',
  'Results',
];
const MAX_RESULTS = 9;
const MAX_DEFAULT_RESULTS = 12;

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fuzzyScore(query: string, item: SearchItem): number {
  const normalizedQuery = normalize(query);
  const haystack = normalize(
    [item.title, item.subtitle, item.type, item.category, ...(item.keywords ?? [])].join(' '),
  );

  if (!normalizedQuery) return 0;
  if (haystack === normalizedQuery) return 1_000;
  if (haystack.startsWith(normalizedQuery)) return 850;

  const directMatch = haystack.indexOf(normalizedQuery);
  if (directMatch >= 0) return 700 - directMatch;

  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -2;

  for (let index = 0; index < haystack.length && queryIndex < normalizedQuery.length; index += 1) {
    if (haystack[index] !== normalizedQuery[queryIndex]) continue;

    score += lastMatchIndex === index - 1 ? 18 : 8;
    lastMatchIndex = index;
    queryIndex += 1;
  }

  return queryIndex === normalizedQuery.length ? score : 0;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function uniqueItemsById(items: readonly SearchItem[]): SearchItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function ActionSearchBar({
  items,
  placeholder = 'Search players, markets or commands',
  className,
}: ActionSearchBarProps) {
  const instanceId = React.useId().replaceAll(':', '');
  const panelId = `fy-search-panel-${instanceId}`;
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const filterRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recentIds, setRecentIds] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState<SearchFilter>('All');
  const debouncedQuery = useDebouncedValue(query, 75);

  const uniqueItems = React.useMemo(() => uniqueItemsById(items), [items]);
  const eligibleItems = React.useMemo(
    () =>
      filter === 'All'
        ? uniqueItems
        : uniqueItems.filter((item) => item.category === filter),
    [filter, uniqueItems],
  );

  const defaultEntries = React.useMemo(() => {
    const eligibleById = new Map(eligibleItems.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const entries: SearchEntry[] = [];
    const append = (entryItems: readonly SearchItem[], section: DisplaySection) => {
      entryItems.forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        entries.push({ item, section });
      });
    };

    append(
      recentIds.flatMap((id) => {
        const item = eligibleById.get(id);
        return item ? [item] : [];
      }),
      'Recent Searches',
    );
    append(
      eligibleItems.filter((item) => item.category === 'Players').slice(0, 3),
      'Players',
    );
    append(
      eligibleItems.filter((item) => item.section === 'Quick Actions'),
      'Quick Actions',
    );
    append(
      eligibleItems.filter((item) => item.section === 'Most Traded Players'),
      'Most Traded Players',
    );
    append(eligibleItems, 'Results');

    return entries.slice(0, MAX_DEFAULT_RESULTS);
  }, [eligibleItems, recentIds]);

  const resultEntries = React.useMemo<SearchEntry[]>(() => {
    const trimmedQuery = debouncedQuery.trim();
    if (!trimmedQuery) return defaultEntries;

    return eligibleItems
      .map((item) => ({ item, score: fuzzyScore(trimmedQuery, item) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) =>
        right.score - left.score || left.item.title.localeCompare(right.item.title),
      )
      .slice(0, MAX_RESULTS)
      .map(({ item }) => ({ item }));
  }, [debouncedQuery, defaultEntries, eligibleItems]);

  const close = React.useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  const selectFilter = React.useCallback((nextFilter: SearchFilter) => {
    setFilter(nextFilter);
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const executeItem = React.useCallback(
    (item: SearchItem | undefined) => {
      if (!item) return;

      item.action();
      setRecentIds((current) => [item.id, ...current.filter((id) => id !== item.id)].slice(0, 4));
      setQuery('');
      close();
      inputRef.current?.blur();
    },
    [close],
  );

  const resultId = React.useCallback(
    (item: SearchItem) => `${panelId}-option-${encodeURIComponent(item.id)}`,
    [panelId],
  );

  React.useEffect(() => {
    setActiveIndex(0);
  }, [filter, query]);

  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(resultEntries.length - 1, 0)));
  }, [resultEntries.length]);

  React.useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, resultEntries]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [close, open]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') {
        return;
      }

      event.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(event.key === 'ArrowUp' ? Math.max(resultEntries.length - 1, 0) : 0);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(resultEntries.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      executeItem(resultEntries[activeIndex]?.item);
    }
  };

  const handleFilterKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % SEARCH_FILTERS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + SEARCH_FILTERS.length) % SEARCH_FILTERS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = SEARCH_FILTERS.length - 1;
    }

    if (nextIndex === undefined) return;
    event.preventDefault();
    selectFilter(SEARCH_FILTERS[nextIndex]);
    filterRefs.current[nextIndex]?.focus();
  };

  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    close();
    inputRef.current?.focus();
  };

  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && wrapperRef.current?.contains(nextTarget)) return;
    close();
  };

  const hasQuery = query.trim().length > 0;
  const activeEntry = resultEntries[activeIndex];

  return (
    <div
      ref={wrapperRef}
      className={`fy-search relative w-[min(100%,42rem)] ${className ?? ''}`}
      onBlurCapture={handleBlurCapture}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div
        className="fy-search-filters flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Search categories"
      >
        {SEARCH_FILTERS.map((filterLabel, index) => (
          <Button
            key={filterLabel}
            ref={(node) => {
              filterRefs.current[index] = node;
            }}
            className="fy-search-filter shrink-0"
            variant="filter"
            size="sm"
            aria-pressed={filter === filterLabel}
            tabIndex={filter === filterLabel ? 0 : -1}
            onClick={() => selectFilter(filterLabel)}
            onKeyDown={(event) => handleFilterKeyDown(event, index)}
          >
            {filterLabel}
          </Button>
        ))}
      </div>

      <label className="fy-search-input-shell grid min-h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-full border border-[var(--edge)] bg-[color-mix(in_srgb,var(--teal)_34%,var(--glass))] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_28px_rgba(92,83,70,0.1)] backdrop-blur-xl transition-[border-color,box-shadow] focus-within:border-[color:color-mix(in_srgb,var(--pink)_58%,var(--edge))] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_12px_34px_rgba(92,83,70,0.14),0_0_22px_color-mix(in_srgb,var(--pink)_20%,transparent)] motion-reduce:transition-none">
        <span className="sr-only">Search FieldYield</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={hasQuery ? 'send' : 'search'}
            className="fy-search-leading-icon grid place-items-center text-[var(--muted)]"
            initial={prefersReducedMotion ? false : { opacity: 0, rotate: -10, scale: 0.88 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, rotate: 10, scale: 0.88 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            aria-hidden="true"
          >
            {hasQuery ? <SendHorizontal size={16} /> : <AnimatedIcon icon={SearchIcon} size={16} aria-hidden="true" />}
          </motion.span>
        </AnimatePresence>
        <input
          ref={inputRef}
          className="fy-search-input h-10 min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={panelId}
          aria-activedescendant={open && activeEntry ? resultId(activeEntry.item) : undefined}
          autoComplete="off"
          spellCheck="false"
        />
        <kbd className="fy-search-shortcut hidden rounded-md border border-[var(--edge)] bg-[var(--glass)] px-2 py-1 text-[0.625rem] text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:inline">
          ⌘/Ctrl K
        </kbd>
      </label>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            className="fy-search-panel absolute inset-x-0 top-full z-50 mt-3 max-h-[min(40rem,calc(100vh-7rem))] overflow-y-auto rounded-[1.375rem] border border-[var(--edge)] bg-[color-mix(in_srgb,var(--teal)_70%,var(--glass))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_28px_70px_rgba(92,83,70,0.24)] backdrop-blur-2xl"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            role="listbox"
            aria-label="Search results"
          >
            {!hasQuery && resultEntries.length > 0 && (
              <SearchSections
                entries={resultEntries}
                activeIndex={activeIndex}
                panelId={panelId}
                executeItem={executeItem}
                resultId={resultId}
                setActiveIndex={setActiveIndex}
                setOptionRef={(index, node) => {
                  optionRefs.current[index] = node;
                }}
              />
            )}
            {hasQuery && resultEntries.length > 0 && (
              <div className="fy-search-results grid gap-1.5">
                {resultEntries.map(({ item }, index) => (
                  <SearchResultRow
                    key={item.id}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    id={resultId(item)}
                    item={item}
                    active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onSelect={() => executeItem(item)}
                  />
                ))}
              </div>
            )}
            {resultEntries.length === 0 && (
              <div className="fy-search-empty grid min-h-36 place-content-center gap-2 px-5 py-6 text-center">
                <strong className="text-sm text-[var(--text)]">No results found</strong>
                <span className="text-xs text-[var(--muted)]">
                  {hasQuery
                    ? 'Try another term or search category.'
                    : `No ${filter.toLocaleLowerCase()} actions are available.`}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchSections({
  entries,
  activeIndex,
  panelId,
  executeItem,
  resultId,
  setActiveIndex,
  setOptionRef,
}: {
  entries: readonly SearchEntry[];
  activeIndex: number;
  panelId: string;
  executeItem: (item: SearchItem) => void;
  resultId: (item: SearchItem) => string;
  setActiveIndex: (index: number) => void;
  setOptionRef: (index: number, node: HTMLButtonElement | null) => void;
}) {
  return (
    <div className="fy-search-results grid gap-1.5">
      {DISPLAY_SECTIONS.map((section) => {
        const sectionEntries = entries
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.section === section);
        if (sectionEntries.length === 0) return null;
        const headingId = `${panelId}-heading-${section.toLocaleLowerCase().replaceAll(' ', '-')}`;

        return (
          <section
            className="fy-search-section grid gap-1.5 border-t border-[var(--edge)] pt-2 first:border-0 first:pt-0"
            key={section}
            role="group"
            aria-labelledby={headingId}
          >
            <h3
              id={headingId}
              className="fy-search-section-title m-0 px-2 pb-1 pt-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
            >
              {section}
            </h3>
            {sectionEntries.map(({ entry: { item }, index }) => (
              <SearchResultRow
                key={item.id}
                ref={(node) => setOptionRef(index, node)}
                id={resultId(item)}
                item={item}
                active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onSelect={() => executeItem(item)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

const SearchResultRow = React.forwardRef<
  HTMLButtonElement,
  {
    id: string;
    item: SearchItem;
    active: boolean;
    onMouseEnter: () => void;
    onSelect: () => void;
  }
>(({ id, item, active, onMouseEnter, onSelect }, ref) => (
  <Button
    ref={ref}
    id={id}
    className="fy-search-result grid h-auto min-h-[3.625rem] w-full grid-cols-[2.375rem_minmax(0,1fr)_auto] gap-2.5 whitespace-normal rounded-2xl border border-transparent bg-[color-mix(in_srgb,var(--glass)_30%,transparent)] px-2.5 py-2 text-left font-normal shadow-none before:hidden hover:translate-y-0 hover:border-[var(--edge)] hover:bg-[color-mix(in_srgb,var(--pink)_24%,var(--glass))] hover:shadow-[0_10px_24px_color-mix(in_srgb,var(--pink)_15%,transparent)] aria-selected:border-[color:color-mix(in_srgb,var(--pink)_45%,var(--edge))] aria-selected:bg-[color-mix(in_srgb,var(--pink)_34%,var(--glass))] aria-selected:shadow-[0_10px_24px_color-mix(in_srgb,var(--pink)_18%,transparent)] motion-reduce:transition-none sm:grid-cols-[2.375rem_minmax(0,1fr)_auto_auto]"
    variant="ghost"
    onMouseEnter={onMouseEnter}
    onClick={onSelect}
    role="option"
    aria-selected={active}
    tabIndex={-1}
  >
    <span
      className="fy-search-result-icon grid size-[2.375rem] place-items-center rounded-[0.8125rem] bg-[color-mix(in_srgb,var(--teal)_38%,var(--glass))] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
      aria-hidden="true"
    >
      {item.icon}
    </span>
    <span className="fy-search-result-copy grid min-w-0 gap-0.5">
      <strong className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</strong>
      <small className="truncate text-xs text-[var(--muted)]">{item.subtitle}</small>
    </span>
    <span className="fy-search-result-type rounded-full border border-[var(--edge)] bg-[color-mix(in_srgb,var(--teal)_30%,var(--glass))] px-2 py-1 text-[0.6875rem] text-[var(--muted)]">
      {item.type}
    </span>
    {item.shortcut && (
      <kbd className="fy-search-result-shortcut hidden min-w-8 rounded-md border border-[var(--edge)] bg-[var(--glass)] px-1.5 py-1 text-center text-[0.625rem] text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:inline">
        {item.shortcut}
      </kbd>
    )}
  </Button>
));
SearchResultRow.displayName = 'SearchResultRow';
