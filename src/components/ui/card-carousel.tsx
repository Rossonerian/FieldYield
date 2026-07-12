import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './button';

export interface CardCarouselProps {
  children: ReactNode;
  title: ReactNode;
  className?: string;
  ariaLabel?: string;
}

type StoppableAnimation = {
  stop: () => void;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const pointsMatch = (left: number[], right: number[]) =>
  left.length === right.length && left.every((point, index) => point === right[index]);

export function CardCarousel({
  children,
  title,
  className,
  ariaLabel,
}: CardCarouselProps) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const itemCount = items.length;
  const titleId = useId();
  const viewportId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const snapPointsRef = useRef<number[]>([]);
  const animationRef = useRef<StoppableAnimation | null>(null);
  const tiltAnimationRef = useRef<StoppableAnimation | null>(null);
  const wheelLockUntilRef = useRef(0);
  const x = useMotionValue(0);
  const tilt = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [snapPoints, setSnapPoints] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const settleAt = useCallback(
    (requestedIndex: number) => {
      if (itemCount === 0) {
        activeIndexRef.current = 0;
        setActiveIndex(0);
        x.set(0);
        return;
      }

      const nextIndex = clamp(requestedIndex, 0, itemCount - 1);
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      animationRef.current?.stop();

      const destination = snapPointsRef.current[nextIndex];
      if (destination === undefined) return;

      if (reduceMotion) {
        x.set(destination);
        return;
      }

      animationRef.current = animate(x, destination, {
        type: 'spring',
        stiffness: 360,
        damping: 38,
        mass: 0.8,
      });
    },
    [itemCount, reduceMotion, x],
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return undefined;

    const measure = () => {
      const cardElements = Array.from(track.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );

      const measuredPoints = cardElements.map(
        (card) => viewport.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2),
      );

      snapPointsRef.current = measuredPoints;
      setSnapPoints((current) =>
        pointsMatch(current, measuredPoints) ? current : measuredPoints,
      );

      if (measuredPoints.length === 0) {
        activeIndexRef.current = 0;
        setActiveIndex(0);
        x.set(0);
        return;
      }

      const measuredIndex = clamp(activeIndexRef.current, 0, measuredPoints.length - 1);
      activeIndexRef.current = measuredIndex;
      setActiveIndex(measuredIndex);
      animationRef.current?.stop();
      x.set(measuredPoints[measuredIndex]);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    Array.from(track.children).forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [itemCount, x]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
      tiltAnimationRef.current?.stop();
    },
    [],
  );

  const moveBy = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = activeIndexRef.current;
      const nextIndex = clamp(currentIndex + direction, 0, Math.max(itemCount - 1, 0));
      if (nextIndex === currentIndex) return false;

      settleAt(nextIndex);
      return true;
    },
    [itemCount, settleAt],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-carousel-wheel-native]')) {
        return;
      }
      const horizontalDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : viewport.closest('[aria-roledescription="carousel"]')?.matches(':focus-within')
              ? event.deltaY
              : 0;

      if (Math.abs(horizontalDelta) < 8 || performance.now() < wheelLockUntilRef.current) {
        return;
      }

      const direction = horizontalDelta > 0 ? 1 : -1;
      if (!moveBy(direction)) return;

      event.preventDefault();
      wheelLockUntilRef.current = performance.now() + 260;
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [moveBy]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.currentTarget !== event.target) return;

    if (event.key === 'ArrowLeft' && moveBy(-1)) {
      event.preventDefault();
    } else if (event.key === 'ArrowRight' && moveBy(1)) {
      event.preventDefault();
    }
  };

  const handleDragStart = () => {
    animationRef.current?.stop();
    tiltAnimationRef.current?.stop();
    setIsDragging(true);
  };

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!reduceMotion) {
      tilt.set(clamp(info.velocity.x / 420, -2.4, 2.4));
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);

    const projectedPosition = x.get() + info.velocity.x * 0.12;
    const points = snapPointsRef.current;
    const nearestIndex = points.reduce(
      (nearest, point, index) =>
        Math.abs(projectedPosition - point) < Math.abs(projectedPosition - points[nearest])
          ? index
          : nearest,
      activeIndexRef.current,
    );

    settleAt(nearestIndex);
    if (reduceMotion) {
      tilt.set(0);
    } else {
      tiltAnimationRef.current = animate(tilt, 0, {
        type: 'spring',
        stiffness: 420,
        damping: 38,
      });
    }
  };

  const firstSnapPoint = snapPoints[0] ?? 0;
  const lastSnapPoint = snapPoints.at(-1) ?? 0;
  const accessibleName = ariaLabel ?? (typeof title === 'string' ? title : 'Card carousel');

  return (
    <section
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      aria-roledescription="carousel"
      className={clsx(
        'fieldyield-card-carousel grid min-w-0 gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]',
        className,
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 id={titleId} className="m-0 min-w-0 text-base font-semibold text-[var(--text)] sm:text-lg">
          {title}
        </h2>

        <div
          role="group"
          className="flex shrink-0 items-center gap-2"
          aria-label={`${accessibleName} controls`}
        >
          <Button
            variant="secondary"
            size="icon-sm"
            aria-controls={viewportId}
            aria-label={`Previous ${accessibleName} card`}
            className="rounded-full"
            disabled={activeIndex === 0 || itemCount === 0}
            onClick={() => moveBy(-1)}
          >
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.2} />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-controls={viewportId}
            aria-label={`Next ${accessibleName} card`}
            className="rounded-full"
            disabled={activeIndex >= itemCount - 1 || itemCount === 0}
            onClick={() => moveBy(1)}
          >
            <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} />
          </Button>
        </div>
      </div>

      <div
        id={viewportId}
        ref={viewportRef}
        className="min-w-0 overflow-hidden py-2 [perspective:1200px]"
      >
        <motion.div
          ref={trackRef}
          className="flex cursor-grab touch-pan-y gap-3 will-change-transform active:cursor-grabbing sm:gap-4"
          style={{ x, rotateY: tilt, transformStyle: 'preserve-3d' }}
          animate={reduceMotion ? undefined : { scale: isDragging ? 0.995 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          drag={itemCount > 1 ? 'x' : false}
          dragConstraints={{
            left: Math.min(firstSnapPoint, lastSnapPoint),
            right: Math.max(firstSnapPoint, lastSnapPoint),
          }}
          dragDirectionLock
          dragElastic={0.12}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        >
          {items.map((child, index) => {
            const childKey = isValidElement(child) && child.key !== null ? child.key : undefined;
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={childKey ?? `fieldyield-carousel-item-${index}`}
                role="group"
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${index + 1} of ${itemCount}`}
                aria-roledescription="slide"
                data-active={isActive ? 'true' : 'false'}
                inert={!isActive}
                className="min-w-0 shrink-0 basis-[86%] sm:basis-[70%] md:basis-[58%] lg:basis-[48%] xl:basis-[40%]"
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: isActive ? 1 : 0.86,
                        scale: isActive ? 1 : 0.975,
                      }
                }
                transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              >
                {child}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {itemCount > 1 && (
        <div
          role="group"
          className="flex items-center justify-center gap-1.5"
          aria-label={`${accessibleName} pagination`}
        >
          {items.map((child, index) => {
            const childKey = isValidElement(child) && child.key !== null ? child.key : undefined;
            const isActive = index === activeIndex;

            return (
              <button
                key={
                  childKey !== undefined
                    ? `indicator-${String(childKey)}`
                    : `indicator-${index}`
                }
                type="button"
                aria-label={`Go to ${accessibleName} card ${index + 1}`}
                aria-pressed={isActive}
                className="group grid size-6 place-items-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
                onClick={() => settleAt(index)}
              ><span className={clsx('h-2 rounded-full transition-[width,background-color,opacity] duration-200', isActive ? 'w-6 bg-[var(--pink)] opacity-100' : 'w-2 bg-[var(--muted)] opacity-35 group-hover:opacity-60')} /></button>
            );
          })}
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {itemCount > 0 ? `${accessibleName}, card ${activeIndex + 1} of ${itemCount}` : `${accessibleName} is empty`}
      </p>
    </section>
  );
}
