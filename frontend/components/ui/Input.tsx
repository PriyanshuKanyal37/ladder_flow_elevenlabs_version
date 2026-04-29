'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-xl border bg-[var(--background)] py-3 text-sm font-medium text-primary',
            'transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(233,83,53,0.16)] focus:outline-none',
            'placeholder:text-secondary',
            icon ? 'pl-10 pr-4' : 'px-4',
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[color:rgba(239,68,68,0.12)]'
              : 'border-subtle',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };

