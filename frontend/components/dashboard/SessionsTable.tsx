'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { SessionRow } from './SessionRow';
import type { Session, SessionStatus, SessionCategory } from '@/lib/types/session';

interface SessionsTableProps {
  sessions: Session[];
}

const statusFilters: { label: string; value: SessionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Drafts', value: 'draft' },
];

const categoryFilters: { label: string; value: SessionCategory | 'all' }[] = [
  { label: 'All Topics', value: 'all' },
  { label: 'Technology', value: 'technology' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Business', value: 'business' },
  { label: 'Productivity', value: 'productivity' },
  { label: 'General', value: 'general' },
];

export function SessionsTable({ sessions }: SessionsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<SessionCategory | 'all'>('all');

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesSearch =
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || session.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [sessions, searchQuery, statusFilter, categoryFilter]);

  return (
    <section className="glass-panel p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-bold text-primary">Session Library</h3>
          <p className="text-sm text-secondary">{sessions.length} sessions total</p>
        </div>

        <div className="w-full md:w-80">
          <Input
            placeholder="Search sessions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<span className="material-symbols-outlined text-[18px]">search</span>}
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
              statusFilter === filter.value
                ? 'accent-gradient text-white'
                : 'bg-[var(--surface-raised)] text-secondary hover:text-primary'
            )}
          >
            {filter.label}
          </button>
        ))}

        <div className="mx-1 hidden h-5 w-px bg-[var(--border-default)] md:block" />

        {categoryFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setCategoryFilter(filter.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
              categoryFilter === filter.value
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[color:rgba(233,83,53,0.12)]'
                : 'border-subtle text-secondary hover:text-primary'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredSessions.length > 0 ? (
          filteredSessions.map((session) => <SessionRow key={session.id} session={session} />)
        ) : (
          <div className="panel-raised flex flex-col items-center justify-center px-4 py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-secondary">search_off</span>
            <p className="text-sm text-secondary">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No sessions match your filters.'
                : 'No sessions found yet.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

