'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { cn, formatDurationLong, formatRelativeTime } from '@/lib/utils';
import { IconWrapper } from '@/components/shared/IconWrapper';
import type { Session, SessionCategory } from '@/lib/types/session';

interface SessionRowProps {
  session: Session;
}

const categoryConfig: Record<SessionCategory, { icon: string; color: 'indigo' | 'teal' | 'green' | 'orange' | 'pink' }> = {
  productivity: { icon: 'work_history', color: 'indigo' },
  technology: { icon: 'memory', color: 'teal' },
  business: { icon: 'trending_up', color: 'green' },
  marketing: { icon: 'campaign', color: 'orange' },
  general: { icon: 'lightbulb', color: 'pink' },
};

const statusStyle: Record<Session['status'], string> = {
  completed: 'bg-[color:rgba(16,185,129,0.16)] text-[var(--success)]',
  in_progress: 'bg-[color:rgba(245,158,11,0.16)] text-[var(--warning)]',
  draft: 'bg-[var(--surface-raised)] text-secondary',
};

export function SessionRow({ session }: SessionRowProps) {
  const config = categoryConfig[session.category];
  const relativeTime = useMemo(
    () => formatRelativeTime(session.createdAt),
    [session.createdAt]
  );

  return (
    <div className="group grid grid-cols-1 items-center gap-4 rounded-xl border border-transparent px-4 py-3 transition-all hover:border-subtle hover:bg-[var(--surface-raised)] md:grid-cols-[1fr_auto_auto_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <IconWrapper icon={config.icon} color={config.color} filled />
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-primary">{session.title}</h4>
          <p className="text-xs text-secondary">
            {relativeTime} · {formatDurationLong(session.duration)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {session.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>

      <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]', statusStyle[session.status])}>
        {session.status.replace('_', ' ')}
      </span>

      <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Link
          href={`/review/${session.id}`}
          className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          View
        </Link>
      </div>
    </div>
  );
}

