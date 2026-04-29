'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SUGGESTIONS = ['Founder Mindset', 'Scale Strategy', 'Product-Market Fit', 'B2B Sales', 'Venture Capital', 'Remote Culture', 'Pricing Strategy', 'GTM Motion'];

const STEPS = [
  { id: 1, label: 'Keywords' },
  { id: 2, label: 'Research' },
  { id: 3, label: 'Angles' },
  { id: 4, label: 'Outline' },
];

export default function DiscoverPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commitChip = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setKeywords((prev) => {
      if (prev.map((k) => k.toLowerCase()).includes(trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
    setInputText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.endsWith(',')) {
      commitChip(v.slice(0, -1));
    } else {
      setInputText(v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputText.trim()) {
        commitChip(inputText);
      } else if (keywords.length > 0) {
        handleSubmit();
      }
    }
    if (e.key === 'Backspace' && inputText === '' && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  };

  const appendSuggestion = (s: string) => {
    setKeywords((prev) => {
      if (prev.map((k) => k.toLowerCase()).includes(s.toLowerCase())) return prev;
      return [...prev, s];
    });
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    const all = inputText.trim() ? [...keywords, inputText.trim()] : keywords;
    if (all.length === 0 || isLoading) return;
    setIsLoading(true);
    sessionStorage.setItem('trending-keywords', all.join(', '));
    router.push('/discover/trending');
  };

  return (
    <div className="screen-frame min-h-screen px-4 py-6 md:px-8">

      {/* Step progress */}
      <nav className="mb-8 flex items-center justify-center">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const active = step.id === 1;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all"
                    style={
                      active
                        ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 14px rgba(233,83,53,0.4)' }
                        : { background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
                    }
                  >
                    {step.id}
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-2.5 mb-4 h-px w-10 bg-[var(--border-default)] md:w-14" />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-[26px] font-extrabold tracking-tight text-primary sm:text-[32px]">
            What do you want to talk about?
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            Enter keywords or themes — we&apos;ll find high-value angles for your session.
          </p>
        </div>

        {/* Keyword card */}
        <div
          className="mb-4 rounded-2xl p-5 md:p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Session Keywords</p>
            <p className="text-[10px] text-[var(--text-secondary)]">Enter to add · Enter again to continue</p>
          </div>

          <div
            className="mb-4 min-h-[56px] rounded-xl p-3 transition-all focus-within:ring-1 focus-within:ring-[var(--accent)]"
            style={{ background: 'var(--background)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: 'rgba(233,83,53,0.12)', border: '1px solid rgba(233,83,53,0.25)', color: 'var(--accent)' }}
                >
                  {k}
                </span>
              ))}
            </div>
            <input
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={keywords.length === 0 ? 'e.g. Founder Mindset, Scale Strategy, B2B Sales' : 'Add more topics...'}
              className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Quick Suggestions</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => {
                const selected = keywords.map((k) => k.toLowerCase()).includes(s.toLowerCase());
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => appendSuggestion(s)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all"
                    style={{
                      background: selected ? 'rgba(233,83,53,0.12)' : 'var(--surface-raised)',
                      border: `1px solid ${selected ? 'rgba(233,83,53,0.3)' : 'var(--border-default)'}`,
                      color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={(keywords.length === 0 && !inputText.trim()) || isLoading}
          className="accent-gradient h-[52px] w-full rounded-xl text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(233,83,53,0.35)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Starting Research...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Find Angles
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </span>
          )}
        </button>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">AI Research Engine Connected</p>
        </div>
      </div>
    </div>
  );
}
