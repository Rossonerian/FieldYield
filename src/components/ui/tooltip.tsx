import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TooltipProps = {
  children: ReactElement<{ 'aria-describedby'?: string }>;
  content: ReactNode;
  className?: string;
};

export function Tooltip({ children, content, className }: TooltipProps) {
  const id = useId();
  if (!isValidElement(children)) return children;

  return (
    <span className={cn('fy-tooltip-root', className)}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className="fy-tooltip-content">{content}</span>
    </span>
  );
}
