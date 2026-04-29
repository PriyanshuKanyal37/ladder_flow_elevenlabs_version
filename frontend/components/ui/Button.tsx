'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'accent-gradient text-white shadow-[0_8px_22px_var(--accent-glow)] hover:brightness-105 active:brightness-95',
      secondary:
        'panel text-primary hover:bg-[var(--surface-raised)] border border-subtle',
      outline:
        'border border-[var(--border-default)] bg-transparent text-primary hover:border-[var(--accent)] hover:text-[var(--accent)]',
      ghost: 'text-secondary hover:bg-[var(--surface-frost)] hover:text-primary',
      danger:
        'border border-[var(--danger)] text-[var(--danger)] hover:bg-[color:rgba(239,68,68,0.12)]',
    };

    const sizes = {
      sm: 'text-xs px-3 py-2 rounded-lg gap-1.5',
      md: 'text-sm px-5 py-3 rounded-xl gap-2',
      lg: 'text-base px-6 py-3.5 rounded-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          !disabled && 'hover:-translate-y-0.5 active:translate-y-0',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <span className="animate-spin size-4 border-2 border-current border-t-transparent rounded-full" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };

