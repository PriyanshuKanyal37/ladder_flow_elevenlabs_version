'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { HamburgerMenu } from '@/components/ui/HamburgerMenu';
import { authHeaders } from '@/lib/auth';

type Platform = 'linkedin' | 'x' | 'twitter' | 'newsletter';
type PostStatus = 'draft' | 'generated' | 'published' | 'archived';

interface ApiPost {
  output_id?: string | null;
  interview_id: string;
  platform: Platform;
  content_type?: string | null;
  title?: string | null;
  content: string;
  status: PostStatus;
  topic: string | null;
  created_at: string;
  updated_at: string;
}

const PLATFORM_META: Record<Platform, { label: string; icon: string; accent: string }> = {
  linkedin:   { label: 'LinkedIn',   icon: 'work',       accent: '#0a66c2' },
  x:          { label: 'X',           icon: 'alternate_email', accent: '#e5e7eb' },
  twitter:    { label: 'Twitter',    icon: 'campaign',   accent: '#1da1f2' },
  newsletter: { label: 'Newsletter', icon: 'mail',       accent: 'var(--accent)' },
};

const STATUS_META: Record<PostStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Draft',     bg: 'var(--surface-raised)',   color: 'var(--text-secondary)' },
  generated: { label: 'Generated', bg: 'rgba(245,158,11,0.12)',   color: '#f59e0b' },
  published: { label: 'Published', bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  archived:  { label: 'Archived',  bg: 'var(--surface-raised)',   color: 'var(--text-secondary)' },
};

const STATUS_FILTERS: { label: string; value: PostStatus | 'all' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Generated', value: 'generated' },
  { label: 'Draft',     value: 'draft' },
  { label: 'Published', value: 'published' },
];

const PLATFORM_FILTERS: { label: string; value: Platform | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'LinkedIn',   value: 'linkedin' },
  { label: 'X',          value: 'x' },
  { label: 'Newsletter', value: 'newsletter' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, n = 180) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export default function PostsLibraryPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [status, setStatus] = useState<PostStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts', { headers: authHeaders() });
      const data = res.ok ? await res.json() : [];
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
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
    return posts.filter((p) => {
      if (platform !== 'all' && p.platform !== platform) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (search) {
        const hay = `${p.topic || ''} ${p.content}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [posts, platform, status, search]);

  const rowKey = (p: ApiPost) => p.output_id || `${p.interview_id}:${p.platform}`;

  const handleCopy = async (p: ApiPost) => {
    try {
      await navigator.clipboard.writeText(p.content);
      setToast('Copied to clipboard');
    } catch {
      setToast('Copy failed');
    }
  };

  const handleStatus = async (p: ApiPost, next: PostStatus) => {
    const res = await fetch(p.output_id ? `/api/content-outputs/${p.output_id}` : `/api/posts/${p.interview_id}/${p.platform}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(p.output_id ? { status: next } : { status: next }),
    });
    if (res.ok) {
      setPosts((cur) => cur.map((row) => (rowKey(row) === rowKey(p) ? { ...row, status: next } : row)));
      setToast(`Marked as ${STATUS_META[next].label.toLowerCase()}`);
    } else {
      setToast('Update failed');
    }
  };

  const handleDelete = async (p: ApiPost) => {
    if (!confirm(`Delete this ${PLATFORM_META[p.platform].label} post? The parent session will remain.`)) return;
    const res = await fetch(p.output_id ? `/api/content-outputs/${p.output_id}` : `/api/posts/${p.interview_id}/${p.platform}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok || res.status === 204) {
      setPosts((cur) => cur.filter((row) => rowKey(row) !== rowKey(p)));
      setToast('Post deleted');
    } else {
      setToast('Delete failed');
    }
  };

  const handleRegenerate = async (p: ApiPost) => {
    setToast('Regenerating…');
    if (p.output_id) {
      const res = await fetch(`/api/content-outputs/${p.output_id}/regenerate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ instruction: null }),
      });
      if (!res.ok) {
        setToast('Regeneration failed');
        return;
      }
      const updated = await res.json();
      setPosts((cur) => cur.map((row) => (rowKey(row) === rowKey(p) ? { ...row, ...updated } : row)));
      setToast('Regenerated');
      return;
    }

    // Pull the session transcript to feed the content generator
    const interviewRes = await fetch(`/api/interviews/${p.interview_id}`, { headers: authHeaders() });
    if (!interviewRes.ok) {
      setToast('Could not load session');
      return;
    }
    const interview = await interviewRes.json();
    if (!interview.raw_transcript) {
      setToast('No transcript available to regenerate from');
      return;
    }
    const endpointMap: Record<Platform, string> = {
      linkedin: '/api/content/linkedin',
      x: '/api/content/twitter',
      twitter: '/api/content/twitter',
      newsletter: '/api/content/newsletter',
    };
    const res = await fetch(endpointMap[p.platform], {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        topic: p.topic || 'General Discussion',
        userName: 'Guest',
        transcript: interview.raw_transcript,
      }),
    });
    if (!res.ok) {
      setToast('Regeneration failed');
      return;
    }
    const payload = await res.json();
    // Content endpoints return { linkedin } / { twitter } / { newsletter } — normalise
    const next = payload[p.platform] || payload.linkedin || payload.twitter || payload.newsletter;
    if (!next) {
      setToast('Regeneration returned no content');
      return;
    }
    await fetch(`/api/posts/${p.interview_id}/${p.platform}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ content: next, status: 'generated' }),
    });
    setPosts((cur) => cur.map((row) => (rowKey(row) === rowKey(p) ? { ...row, content: next, status: 'generated' } : row)));
    setToast('Regenerated');
  };

  return (
    <div className="screen-frame px-3 py-4 md:px-6 md:py-5">
      <DashboardTopBar />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-extrabold tracking-tight text-primary sm:text-[17px]">Posts</h1>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {loading ? 'Loading…' : `${filtered.length} of ${posts.length} post${posts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/discover" className="accent-gradient inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(233,83,53,0.3)] transition-all hover:scale-[1.02]">
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
            placeholder="Search posts…"
            className="w-full rounded-xl py-2 pl-8 pr-3 text-[12px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          />
        </div>
        <div className="flex items-center gap-1">
          {PLATFORM_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setPlatform(f.value)}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all"
              style={
                platform === f.value
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all"
              style={
                status === f.value
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
        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ background: 'var(--surface)' }}>
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ background: 'var(--surface)' }}>
            <span className="material-symbols-outlined text-[36px] text-[var(--text-secondary)] mb-2">description</span>
            <p className="text-[13px] font-semibold text-primary mb-1">
              {search || platform !== 'all' || status !== 'all' ? 'No posts match your filters' : 'No posts yet'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {search || platform !== 'all' || status !== 'all' ? (
                <button
                  type="button"
                  className="text-[var(--accent)] hover:underline"
                  onClick={() => {
                    setSearch('');
                    setPlatform('all');
                    setStatus('all');
                  }}
                >
                  Clear filters
                </button>
              ) : (
                'Finish an interview to generate your first post'
              )}
            </p>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)' }}>
            {filtered.map((p, idx) => {
              const key = rowKey(p);
              const pm = PLATFORM_META[p.platform];
              const sm = STATUS_META[p.status];
              const isOpen = expanded === key;
              const menuItems = [
                { key: 'copy', label: 'Copy to clipboard', icon: 'content_copy', onSelect: () => handleCopy(p) },
                {
                  key: 'view',
                  label: 'Open session',
                  icon: 'open_in_new',
                  onSelect: () => router.push(`/review/${p.interview_id}`),
                },
                {
                  key: 'regen',
                  label: 'Regenerate',
                  icon: 'refresh',
                  onSelect: () => handleRegenerate(p),
                },
                p.status === 'published'
                  ? { key: 'draft', label: 'Move to draft', icon: 'inventory_2', onSelect: () => handleStatus(p, 'draft') }
                  : { key: 'publish', label: 'Mark as published', icon: 'verified', onSelect: () => handleStatus(p, 'published') },
                { key: 'delete', label: 'Delete', icon: 'delete', danger: true, onSelect: () => handleDelete(p) },
              ];

              return (
                <div
                  key={key}
                  className="group px-4 py-3 transition-all hover:bg-[var(--surface-raised)]"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-default)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(233,83,53,0.1)', border: '1px solid rgba(233,83,53,0.2)' }}
                    >
                      <span className="material-symbols-outlined text-[15px]" style={{ color: pm.accent, fontVariationSettings: "'FILL' 1" }}>
                        {pm.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-primary">{p.title || p.topic || 'Untitled Session'}</p>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: 'var(--surface-raised)', color: pm.accent, border: `1px solid ${pm.accent}20` }}>
                          {pm.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{formatDate(p.updated_at)}</p>
                      <p
                        className="mt-1 cursor-pointer text-[12px] leading-relaxed text-[var(--text-secondary)]"
                        onClick={() => setExpanded(isOpen ? null : key)}
                      >
                        {isOpen ? p.content : truncate(p.content)}
                        {p.content.length > 180 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(isOpen ? null : key);
                            }}
                            className="ml-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                          >
                            {isOpen ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </p>
                    </div>
                    <span className="w-24 rounded-full px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider" style={{ background: sm.bg, color: sm.color }}>
                      {sm.label}
                    </span>
                    <HamburgerMenu items={menuItems} ariaLabel={`Actions for ${pm.label} post`} />
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
