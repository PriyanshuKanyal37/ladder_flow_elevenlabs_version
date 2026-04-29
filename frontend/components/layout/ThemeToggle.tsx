'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from '@/lib/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <button
      onClick={toggleTheme}
      className="glass-button group inline-flex h-10 w-10 items-center justify-center rounded-xl"
      aria-label="Toggle theme"
      title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      type="button"
    >
      <span className="material-symbols-outlined text-xl transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
        {mounted ? (theme === 'dark' ? 'light_mode' : 'dark_mode') : 'contrast'}
      </span>
    </button>
  );
}
