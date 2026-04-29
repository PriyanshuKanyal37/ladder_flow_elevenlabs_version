'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const pathname = usePathname();

  const tabs = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/discover', label: 'Sessions' },
    { href: '/brain', label: 'Brain' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-[color:rgba(15,15,15,0.55)] px-4 py-4 backdrop-blur-xl md:px-8">
      <div className="screen-frame flex items-center justify-between gap-4">
        <nav className="glass-pill hidden items-center gap-1 p-1 md:flex">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== '/dashboard' && pathname.startsWith(tab.href));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors',
                  isActive
                    ? 'accent-gradient text-white shadow-[0_6px_18px_var(--accent-glow)]'
                    : 'text-secondary hover:text-primary'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <button className="glass-panel inline-flex h-10 w-10 items-center justify-center text-secondary transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
}

