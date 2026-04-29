'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = {
  sm: 'text-[18px]',
  md: 'text-[24px]',
  lg: 'text-[32px]',
};

export function StarRating({ value, onChange, readonly = false, size = 'md', label }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-slate-600">{label}</span>
      )}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={cn(
              'transition-colors',
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
            )}
          >
            <span
              className={cn(
                'material-symbols-outlined transition-colors',
                sizeMap[size],
                (hovered || value) >= star
                  ? 'text-amber-400 filled'
                  : 'text-slate-300'
              )}
              style={{
                fontVariationSettings:
                  (hovered || value) >= star
                    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              star
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

