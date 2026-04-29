'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'ladderflow-theme';

let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.add('theme-transitioning');
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  localStorage.setItem(STORAGE_KEY, theme);

  if (transitionTimeout) clearTimeout(transitionTimeout);
  transitionTimeout = setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 420);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored || 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}

