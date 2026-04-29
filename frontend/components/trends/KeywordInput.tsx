'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface KeywordInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const SUGGESTIONS = [
  'Founder Mindset',
  'Scale Strategy',
  'Product-Market Fit',
  'B2B Sales',
  'Venture Capital',
  'Remote Culture',
];

export function KeywordInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = 'Add themes separated by commas...',
}: KeywordInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const keywords = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const appendSuggestion = (suggestion: string) => {
    const set = new Set(keywords.map((item) => item.toLowerCase()));
    if (set.has(suggestion.toLowerCase())) return;
    const next = [...keywords, suggestion].join(', ');
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="glass-panel p-5 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-kicker">Session Keywords</span>
        <span className="mono-text text-[11px] text-secondary">Cmd/Enter to run</span>
      </div>

      <div className="mb-5 rounded-xl border border-subtle bg-[var(--background)] p-3 md:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {keywords.length > 0 ? (
            keywords.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(233,83,53,0.36)] bg-[color:rgba(233,83,53,0.12)] px-3 py-1.5 text-xs font-medium text-primary"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-sm text-secondary">Add at least one topic to continue.</span>
          )}
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            'w-full border-0 bg-transparent p-0 text-sm text-primary outline-none placeholder:text-secondary',
            disabled && 'cursor-not-allowed opacity-60'
          )}
          placeholder={placeholder}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="label-kicker">Suggestions</span>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => appendSuggestion(suggestion)}
            className="whitespace-nowrap rounded-full border border-subtle bg-[var(--surface-raised)] px-4 py-2 text-xs font-medium text-secondary transition-colors hover:text-primary"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

