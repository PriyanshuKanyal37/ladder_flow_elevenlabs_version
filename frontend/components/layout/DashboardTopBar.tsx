'use client';

import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

/** Maps route prefixes to page titles + icons (matching sidebar NAV_ITEMS) */
const ROUTE_MAP: Array<{ prefix: string; title: string; icon: string }> = [
  { prefix: '/dashboard', title: 'Dashboard', icon: 'dashboard' },
  { prefix: '/sessions', title: 'Sessions', icon: 'schedule' },
  { prefix: '/brain', title: 'Digital Brain', icon: 'psychology' },
  { prefix: '/settings', title: 'Settings', icon: 'settings' },
  { prefix: '/discover', title: 'Discover', icon: 'explore' },
  { prefix: '/interview', title: 'Interview', icon: 'mic' },
  { prefix: '/review', title: 'Review', icon: 'rate_review' },
];

interface DashboardTopBarProps {
  /** Override the auto-detected page title */
  title?: string;
  rightSlot?: React.ReactNode;
}

export function DashboardTopBar({ title, rightSlot }: DashboardTopBarProps) {
  const pathname = usePathname();

  /* Resolve current page from route */
  const current = ROUTE_MAP.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/')
  ) ?? ROUTE_MAP[0];

  const pageTitle = title ?? current.title;
  const pageIcon = current.icon;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 pl-11 md:mb-5 md:pl-0">
      {/* Page title block — clean, bold, matching sidebar */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] text-white shadow-[0_6px_16px_var(--accent-glow)]">
          <span className="material-symbols-outlined text-[18px]">{pageIcon}</span>
        </div>
        <h1 className="truncate text-lg font-bold tracking-tight text-primary sm:text-xl">
          {pageTitle}
        </h1>
      </div>

      {/* Right controls */}
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
        <ThemeToggle />
      </div>
    </div>
  );
}

