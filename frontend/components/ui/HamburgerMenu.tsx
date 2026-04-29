'use client';

import { useEffect, useRef, useState } from 'react';

export interface HamburgerMenuItem {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

interface HamburgerMenuProps {
  items: HamburgerMenuItem[];
  ariaLabel?: string;
  align?: 'left' | 'right';
}

export function HamburgerMenu({ items, ariaLabel = 'Open actions', align = 'right' }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onClickAway);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClickAway);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-raised)]"
        style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-40 mt-1 min-w-[180px] overflow-hidden rounded-xl shadow-lg"
          style={{
            [align]: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            backdropFilter: 'blur(12px)',
          } as React.CSSProperties}
        >
          {items.map((item) => (
            <button
              key={item.key}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(false);
                if (!item.disabled) await item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: item.danger ? 'var(--danger)' : 'var(--text-primary)' }}
            >
              {item.icon && (
                <span className="material-symbols-outlined text-[16px]" aria-hidden>
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
