'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          className={cn(
            'w-full rounded-xl border bg-[var(--background)] p-4 text-sm font-medium resize-none text-primary',
            'transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(233,83,53,0.16)] focus:outline-none',
            'placeholder:text-secondary',
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

Textarea.displayName = 'Textarea';

export { Textarea };

