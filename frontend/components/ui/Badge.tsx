import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--surface-raised)] text-secondary',
      primary: 'bg-[color:rgba(233,83,53,0.16)] text-[var(--accent)]',
      success: 'bg-[color:rgba(16,185,129,0.16)] text-[var(--success)]',
      warning: 'bg-[color:rgba(245,158,11,0.16)] text-[var(--warning)]',
      error: 'bg-[color:rgba(239,68,68,0.16)] text-[var(--danger)]',
      outline: 'border border-[var(--border-default)] text-secondary',
    };

    const sizes = {
      sm: 'text-[10px] px-1.5 py-0.5',
      md: 'text-xs px-2 py-1',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-semibold rounded-full',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };

