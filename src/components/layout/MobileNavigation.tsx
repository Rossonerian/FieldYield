import { primaryNavigationItems, type NavigationId } from '@/app/navigation';
import { cn } from '@/lib/utils';

export type MobileNavigationProps = {
  activePage: string;
  onNavigate: (page: NavigationId) => void;
  className?: string;
};

export function MobileNavigation({ activePage, onNavigate, className }: MobileNavigationProps) {
  return (
    <nav
      className={cn('fy-mobile-navigation', className)}
      aria-label="Mobile primary navigation"
    >
      {primaryNavigationItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className="fy-mobile-navigation-item"
          onClick={() => onNavigate(item.id)}
          aria-current={activePage === item.id ? 'page' : undefined}
          aria-label={item.label}
        >
          {item.shortLabel}
        </button>
      ))}
    </nav>
  );
}
