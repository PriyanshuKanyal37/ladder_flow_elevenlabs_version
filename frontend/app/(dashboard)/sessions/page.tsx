'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { HamburgerMenu } from '@/components/ui/HamburgerMenu';
import { authHeaders } from '@/lib/auth';
import type { SessionStatus, SessionCategory } from '@/lib/types/session';

interface ApiInterview {
  id: string;
  topic: string | null;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  linkedin_post: string | null;
  twitter_thread: string | null;
  newsletter_post: string | null;
}

function deriveCategory(topic: string | null): SessionCategory {
  if (!topic) return 'general';
  const t = topic.toLowerCase();
  if (t.includes('ai') || t.includes('tech') || t.includes('code')) return 'technology';
  if (t.includes('market') || t.includes('brand') || t.includes('linkedin')) return 'marketing';
  if (t.includes('product') || t.includes('hack') || t.includes('focus')) return 'productivity';
  if (t.includes('business') || t.includes('startup') || t.includes('company')) return 'business';
  return 'general';
}

function formatDur(seconds: number) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveUiStatus(raw: string): SessionStatus {
  const s = (raw || '').toUpperCase();
  if (s === 'COMPLETED') return 'completed';
  if (s === 'DRAFT') return 'draft';
  if (s === 'INTERVIEWING' || s === 'STARTED' || s === 'RESEARCHING') return 'in_progress';
  return 'draft';
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  completed:   { label: 'Completed',   bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  draft:       { label: 'Draft',       bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
};

const CATEGORY_ICONS: Record<string, string> = {
  technology:  'memory',
  marketing:   'campaign',
  business:    'trending_up',
  productivity: 'work_history',
  general:     'lightbulb',
};

const STATUS_FILTERS: { label: string; value: SessionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Draft', value: 'draft' },
];

function publishedCount(item: ApiInterview) {
  return [item.linkedin_post, item.twitter_thread, item.newsletter_post].filter(Boolean).length;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ApiInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [resuming, setResuming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/interviews', { headers: authHeaders() });
      const data = res.ok ? await res.json() : [];
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const title = (s.topic || '').toLowerCase();
      if (search && !title.includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && deriveUiStatus(s.status) !== statusFilter) return false;
      return true;
    });
  }, [sessions, search, statusFilter]);

  const handleResume = useCallback(
    async (s: ApiInterview) => {
      setResuming(s.id);
      try {
        const res = await fetch('/api/agent/config/resume', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ interview_id: s.id }),
        });
        if (!res.ok) {
          setToast('Could not resume session');
          setResuming(null);
          return;
        }
        const config = await res.json();
        if (!config.interviewId) {
          setToast('Invalid resume response');
          setResuming(null);
          return;
        }
        sessionStorage.setItem('agent-config', JSON.stringify({ ...config, resumed: true }));
        sessionStorage.setItem('research-context', JSON.stringify(config.researchContext || {
          title: config.topicTitle,
          deep_context: '',
          key_insights: [],
          discussion_points: [],
          contrarian_angles: [],
          sources: [],
        }));
        if (config.priorTranscript) {
          sessionStorage.setItem('resume-prior-transcript', config.priorTranscript);
        } else {
          sessionStorage.removeItem('resume-prior-transcript');
        }
        router.push('/interview');
      } catch {
        setToast('Resume failed');
        setResuming(null);
      }
    },
    [router]
  );

  const handleDelete = async (s: ApiInterview) => {
    if (!confirm(`Delete session "${s.topic || 'Untitled'}"? This removes the transcript and all its posts.`)) return;
    // Soft: we just archive all three platform posts — there's no DELETE /interviews yet.
    // For a hard delete, add a backend route. Here we visually hide and call per-platform archive.
    const platforms: ('linkedin' | 'twitter' | 'newsletter')[] = ['linkedin', 'twitter', 'newsletter'];
    await Promise.all(
      platforms.map((p) =>
        fetch(`/api/posts/${s.id}/${p}`, { method: 'DELETE', headers: authHeaders() }).catch(() => null)
      )
    );
    setSessions((cur) => cur.filter((r) => r.id !== s.id));
    setToast('Session posts archived');
  };

  return (
    <div className="screen-frame px-3 py-4 md:px-6 md:py-5">
      <DashboardTopBar />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-extrabold tracking-tight text-primary sm:text-[17px]">Sessions</h1>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {loading ? 'Loading...' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <Link
          href="/discover"
          className="accent-gradient inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(233,83,53,0.3)] transition-all hover:scale-[1.02]"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          New Session
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--text-secondary)]">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full rounded-xl py-2 pl-8 pr-3 text-[12px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all"
              style={
                statusFilter === f.value
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <div
          className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b px-4 py-2.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Session</p>
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] sm:block w-20 text-center">Duration</p>
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] sm:block w-20 text-center">Published</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] w-24 text-center">Status</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] w-10 text-center">Actions</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ background: 'var(--surface)' }}>
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ background: 'var(--surface)' }}>
            <span className="material-symbols-outlined text-[36px] text-[var(--text-secondary)] mb-2">search_off</span>
            <p className="text-[13px] font-semibold text-primary mb-1">
              {search || statusFilter !== 'all' ? 'No sessions match your filters' : 'No sessions yet'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {search || statusFilter !== 'all' ? (
                <button
                  type="button"
                  className="text-[var(--accent)] hover:underline"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </button>
              ) : (
                'Start your first interview session'
              )}
            </p>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)' }}>
            {filtered.map((session, idx) => {
              const category = deriveCategory(session.topic);
              const derivedStatus = deriveUiStatus(session.status);
              const statusMeta = STATUS_META[derivedStatus] || STATUS_META.draft;
              const published = publishedCount(session);
              const isDraft = derivedStatus === 'draft';
              const isResuming = resuming === session.id;

              const menuItems = [
                {
                  key: 'view',
                  label: 'View session',
                  icon: 'open_in_new',
                  onSelect: () => router.push(`/review/${session.id}`),
                },
                ...(isDraft
                  ? [
                      {
                        key: 'resume',
                        label: isResuming ? 'Resuming…' : 'Resume',
                        icon: 'play_arrow',
                        disabled: isResuming,
                        onSelect: () => handleResume(session),
                      },
                    ]
                  : []),
                {
                  key: 'delete',
                  label: 'Delete posts',
                  icon: 'delete',
                  danger: true,
                  onSelect: () => handleDelete(session),
                },
              ];

              return (
                <div
                  key={session.id}
                  className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 transition-all hover:bg-[var(--surface-raised)]"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-default)' }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(233,83,53,0.1)', border: '1px solid rgba(233,83,53,0.2)' }}
                    >
                      <span className="material-symbols-outlined text-[15px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {CATEGORY_ICONS[category] || 'lightbulb'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-primary">{session.topic || 'Untitled Session'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{formatDate(session.created_at)}</p>
                    </div>
                  </div>

                  <p className="hidden sm:block w-20 text-center text-[12px] text-[var(--text-secondary)]">
                    {formatDur(session.duration_seconds || 0)}
                  </p>

                  <div className="hidden sm:flex w-20 items-center justify-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-5 rounded-full transition-colors"
                        style={{ background: i < published ? '#10b981' : 'var(--border-default)' }}
                      />
                    ))}
                  </div>

                  <span
                    className="w-24 rounded-full px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: statusMeta.bg, color: statusMeta.color }}
                  >
                    {statusMeta.label}
                  </span>

                  <div className="w-10 flex items-center justify-center">
                    <HamburgerMenu items={menuItems} ariaLabel={`Actions for ${session.topic || 'session'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] font-semibold shadow-lg"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
