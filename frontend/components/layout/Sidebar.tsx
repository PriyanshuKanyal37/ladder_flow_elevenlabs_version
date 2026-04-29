'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/context/UserContext';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/sessions', label: 'Sessions', icon: 'schedule' },
  { href: '/posts', label: 'Posts', icon: 'description' },
  { href: '/brain', label: 'Digital Brain', icon: 'psychology' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function Sidebar({ isOpen, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const mobileBreakpoint = 768;

  const displayName =
    user?.full_name || user?.email?.split('@')[0] || 'LadderFlow User';
  const initials = useMemo(() => {
    return displayName
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }, [displayName]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < mobileBreakpoint;
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  function handleNavItemClick() {
    if (typeof window !== 'undefined' && window.innerWidth < mobileBreakpoint) {
      onClose();
    }
  }

  return (
    <>
      {/* Mobile hamburger — only visible on mobile when sidebar is closed */}
      <button
        onClick={onToggle}
        className={cn(
          'glass-button fixed left-3 top-4 z-[70] flex h-9 w-9 items-center justify-center rounded-xl md:hidden',
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
        aria-label="Open navigation"
        aria-expanded={isOpen}
        aria-controls="mobile-sidebar"
        type="button"
      >
        <span className="relative block h-[14px] w-5">
          <span className="absolute left-0 top-0 h-[2px] w-5 rounded-full bg-current" />
          <span className="absolute left-0 top-[6px] h-[2px] w-5 rounded-full bg-current" />
          <span className="absolute left-0 top-[12px] h-[2px] w-5 rounded-full bg-current" />
        </span>
      </button>

      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/45 transition-opacity md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        id="mobile-sidebar"
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r py-4 backdrop-blur-2xl transition-all duration-300',
          'border-[rgba(120,85,50,0.1)] bg-[var(--sidebar-bg)]',
          'dark:border-[rgba(255,255,255,0.06)]',
          isOpen
            ? 'w-[240px] translate-x-0 px-3'
            : 'w-[56px] -translate-x-full px-1.5 md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className={cn('mb-5 flex items-center', isOpen ? 'justify-between px-1.5' : 'justify-center')}>
          {isOpen ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-2.5" onClick={handleNavItemClick}>
                <div className="accent-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-[0_6px_18px_var(--accent-glow)]">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    mic
                  </span>
                </div>
                <div>
                  <h1 className="text-[14px] font-bold tracking-tight text-primary leading-tight">Ladder Flow</h1>
                  <p className="label-kicker text-[9px]">Premium Engine</p>
                </div>
              </Link>
              <button
                onClick={onClose}
                type="button"
                aria-label="Collapse navigation"
                className="glass-button flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
            </>
          ) : (
            <button
              onClick={onToggle}
              type="button"
              aria-label="Expand navigation"
              className="glass-button flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <span className="material-symbols-outlined text-[18px]">menu</span>
            </button>
          )}
        </div>

        {/* Collapsed-state logo (below menu toggle) */}
        {!isOpen && (
          <div className="mb-3 flex justify-center">
            <Link href="/dashboard" aria-label="Ladder Flow home">
              <div className="accent-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-[0_6px_18px_var(--accent-glow)]">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  mic
                </span>
              </div>
            </Link>
          </div>
        )}


        <nav className={cn('flex-1 space-y-0.5 overflow-y-auto custom-scrollbar', isOpen ? 'px-0.5' : 'px-0')}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavItemClick}
                title={!isOpen ? item.label : undefined}
                className={cn(
                  'group flex items-center rounded-lg text-[13px] font-medium transition-all',
                  isOpen ? 'gap-2.5 px-3 py-2' : 'h-8 w-8 mx-auto justify-center',
                  isActive
                    ? isOpen
                      ? 'border-l-[2px] border-[var(--accent)] bg-[rgba(231,120,92,0.12)] text-[var(--text-primary)] dark:bg-[var(--surface-raised)] dark:text-primary'
                      : 'bg-[rgba(231,120,92,0.14)] text-[var(--accent)] dark:bg-[var(--surface-raised)]'
                    : 'text-[var(--text-secondary)] hover:bg-black/[0.05] hover:text-[var(--text-primary)] dark:hover:bg-[var(--surface-raised)] dark:hover:text-primary'
                )}
              >
                <span
                  className={cn(
                    'material-symbols-outlined text-[18px]',
                    isActive && 'text-[var(--accent)]'
                  )}
                >
                  {item.icon}
                </span>
                {isOpen && item.label}
              </Link>
            );
          })}
        </nav>

        <div className={cn('mt-auto pt-4', isOpen && 'border-t border-subtle')}>
          {isOpen ? (
            <div className="glass-panel flex items-center gap-2.5 px-2.5 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full accent-gradient text-[10px] font-bold text-white">
                {initials || 'LF'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-primary leading-tight">{displayName}</p>
                <p className="truncate text-[10px] text-secondary leading-tight">{user?.email || 'Connected'}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title={displayName}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full accent-gradient text-[10px] font-bold text-white">
                {initials || 'LF'}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
