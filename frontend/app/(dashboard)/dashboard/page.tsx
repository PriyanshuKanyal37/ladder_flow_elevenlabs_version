'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import type { Session } from '@/lib/types/session';
import { authHeaders } from '@/lib/auth';

// ─── SVG Bar Chart ─────────────────────────────────────────────────────────────

interface ChartBar {
  label: string;
  sessions: number;
  published: number;
  faded?: boolean;
}

function VelocityChart({ data }: { data: ChartBar[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; bar: ChartBar } | null>(null);
  const [mounted, setMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Trigger bar animation after mount
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const W = 600;
  const H = 160;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 12;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 32;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...data.map((d) => Math.max(d.sessions, d.published)), 1);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const BAR_GROUP_W = chartW / data.length;
  const BAR_W = Math.min(10, BAR_GROUP_W * 0.28);
  const GAP = 4;

  function yPos(val: number) {
    return PAD_TOP + chartH - (val / maxVal) * chartH;
  }

  function barHeight(val: number) {
    return (val / maxVal) * chartH;
  }

  return (
    <div className="relative w-full select-none" style={{ minHeight: H }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height: H, overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {gridLines.map((pct) => {
          const y = PAD_TOP + chartH * (1 - pct);
          return (
            <g key={pct}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--border-subtle)"
                strokeWidth={1}
                strokeDasharray={pct === 0 ? '0' : '3 4'}
              />
              {pct > 0 && (
                <text
                  x={PAD_LEFT - 5}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={8}
                  fill="var(--text-dim)"
                  fontFamily="inherit"
                >
                  {Math.round(maxVal * pct)}
                </text>
              )}
            </g>
          );
        })}

        {/* Bars */}
        {data.map((bar, i) => {
          const groupX = PAD_LEFT + i * BAR_GROUP_W + BAR_GROUP_W / 2;
          const sessX = groupX - BAR_W - GAP / 2;
          const pubX = groupX + GAP / 2;
          const labelY = H - PAD_BOTTOM + 14;

          const sessH = mounted ? barHeight(bar.sessions) : 0;
          const pubH = mounted ? barHeight(bar.published) : 0;
          const sessY = yPos(bar.sessions);
          const pubY = yPos(bar.published);

          return (
            <g
              key={bar.label}
              onMouseEnter={(e) => {
                const svg = svgRef.current;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const scaleX = rect.width / W;
                setTooltip({
                  x: groupX * scaleX,
                  y: Math.min(sessY, pubY) * (rect.height / H) - 10,
                  bar,
                });
              }}
              style={{ cursor: 'default' }}
            >
              {/* Sessions bar */}
              <rect
                x={sessX}
                y={mounted ? sessY : PAD_TOP + chartH}
                width={BAR_W}
                height={mounted ? sessH : 0}
                rx={3}
                fill={bar.faded ? 'rgba(240,114,82,0.22)' : 'var(--accent)'}
                style={{
                  transition: 'y 0.55s cubic-bezier(0.34,1.56,0.64,1), height 0.55s cubic-bezier(0.34,1.56,0.64,1)',
                  transitionDelay: `${i * 0.04}s`,
                  filter: bar.faded ? 'none' : 'drop-shadow(0 2px 6px rgba(240,114,82,0.28))',
                }}
              />
              {/* Published bar */}
              <rect
                x={pubX}
                y={mounted ? pubY : PAD_TOP + chartH}
                width={BAR_W}
                height={mounted ? pubH : 0}
                rx={3}
                fill={bar.faded ? 'rgba(16,185,129,0.18)' : '#10B981'}
                style={{
                  transition: 'y 0.55s cubic-bezier(0.34,1.56,0.64,1), height 0.55s cubic-bezier(0.34,1.56,0.64,1)',
                  transitionDelay: `${i * 0.04 + 0.06}s`,
                  filter: bar.faded ? 'none' : 'drop-shadow(0 2px 6px rgba(16,185,129,0.22))',
                }}
              />
              {/* Day label */}
              <text
                x={groupX}
                y={labelY}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill={bar.faded ? 'var(--text-dim)' : 'var(--text-secondary)'}
                fontFamily="inherit"
                style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-[8px] px-2.5 py-2 text-[10px] shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            minWidth: 90,
          }}
        >
          <p className="mb-1 font-bold" style={{ color: 'var(--text-secondary)', fontSize: 9 }}>
            {tooltip.bar.label}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Sessions</span>
            <span className="ml-auto font-bold" style={{ color: 'var(--text-primary)' }}>{tooltip.bar.sessions}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span style={{ color: 'var(--text-secondary)' }}>Published</span>
            <span className="ml-auto font-bold" style={{ color: 'var(--text-primary)' }}>{tooltip.bar.published}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number) {
  if (!seconds) return '--m --s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function statusPill(status: Session['status']) {
  if (status === 'completed')
    return { label: 'Complete', cls: 'bg-[rgba(16,185,129,0.14)] text-[#10b981]', bar: 'w-full bg-[#10B981]' };
  if (status === 'in_progress')
    return { label: 'Live', cls: 'bg-[rgba(245,158,11,0.16)] text-[#f59e0b]', bar: 'w-[70%] bg-[#F59E0B]' };
  return { label: 'Draft', cls: 'bg-[rgba(99,102,241,0.12)] text-[#818cf8]', bar: 'w-[25%] bg-[#818cf8]' };
}

const ROW_ICONS = [
  { bg: 'bg-[rgba(231,120,92,0.12)]', color: 'text-[var(--accent)]', glyph: 'mic' },
  { bg: 'bg-[rgba(219,39,119,0.12)]', color: 'text-[#ec4899]', glyph: 'share' },
  { bg: 'bg-white/[0.06]', color: 'text-white/70', glyph: 'history' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PausedBanner({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  return (
    <div
      className="mb-3 flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-[16px] text-[#f59e0b]" style={{ fontVariationSettings: "'FILL' 1" }}>
          pause_circle
        </span>
        <p className="text-[12px] font-semibold">You have a paused session.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onDiscard} className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          Discard
        </button>
        <button
          onClick={onResume}
          className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:scale-[1.02]"
          style={{ background: '#f59e0b' }}
        >
          Resume
        </button>
      </div>
    </div>
  );
}

function EmptyNudge() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[14px] px-6 py-10 text-center"
      style={{ background: 'rgba(233,83,53,0.04)', border: '1px dashed rgba(233,83,53,0.2)' }}
    >
      <div className="accent-gradient mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-[0_8px_24px_rgba(233,83,53,0.25)]">
        <span className="material-symbols-outlined text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
          psychology
        </span>
      </div>
      <h3 className="text-[15px] font-bold">Your Brain is empty.</h3>
      <p className="mt-1 max-w-[260px] text-[12px] text-[var(--text-secondary)]">
        Start your first session to begin building your Digital Brain.
      </p>
      <Link
        href="/discover"
        className="accent-gradient mt-5 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all hover:scale-[1.02]"
      >
        <span className="material-symbols-outlined text-[14px]">mic</span>
        Start Session
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPaused, setHasPaused] = useState(false);
  const [brainStats, setBrainStats] = useState<{
    total: number;
    frameworks: number;
    stories: number;
    topFrameworks: string[];
    lastUpdated: string | null;
  } | null>(null);

  // Fetch brain memories for the Digital Brain widget
  useEffect(() => {
    async function fetchBrain() {
      try {
        const res = await fetch('/api/brain/memories', { headers: authHeaders() });
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = await res.json();
        const frameworks = items.filter((m) => m.type === 'framework');
        const stories = items.filter((m) => m.type === 'story');
        const topFrameworks = frameworks
          .slice(0, 3)
          .map((m: { content: string }) => m.content.length > 40 ? m.content.slice(0, 40) + '…' : m.content);
        const lastUpdated = items.length > 0 ? items[0].created_at : null;
        setBrainStats({
          total: items.length,
          frameworks: frameworks.length,
          stories: stories.length,
          topFrameworks,
          lastUpdated,
        });
      } catch {
        // silently fail — widget just won't show counts
      }
    }
    fetchBrain();
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/interviews', { headers: authHeaders() });
        if (!res.ok) throw new Error();
        // Backend returns snake_case + uppercase status — normalize here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = await res.json();
        const normalized: Session[] = raw.map((r) => ({
          id: r.id,
          title: r.topic ?? 'Untitled Session',
          status: (() => {
            const s = (r.status ?? '').toUpperCase();
            if (s === 'COMPLETED') return 'completed';
            if (s === 'STARTED' || s === 'RESEARCHING' || s === 'INTERVIEWING') return 'in_progress';
            return 'draft'; // DRAFT, FAILED, or anything else
          })() as Session['status'],
          category: (r.category ?? 'general') as Session['category'],
          tags: r.tags ?? [],
          duration: r.duration_seconds ?? 0,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        }));
        setSessions(normalized);
        setHasPaused(normalized.some((s) => s.status === 'in_progress'));
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const completedCount = useMemo(() => sessions.filter((s) => s.status === 'completed').length, [sessions]);
  // Posts generated = sessions that have at least one content piece (3 per completed session)
  const postsGenerated = completedCount * 3;
  const postsPublished = Math.floor(postsGenerated * 0.6);
  const weekSessions = sessions.filter((s) => {
    const d = new Date(s.createdAt);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  // Streak: count of distinct days in last 7 with at least one session
  const streakDays = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const d = new Date(s.createdAt);
      if (Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000) {
        set.add(d.toDateString());
      }
    });
    return set.size;
  }, [sessions]);

  const statCards = [
    { label: 'Sessions This Month', value: loading ? '--' : String(sessions.length), icon: 'mic', badge: 'Live Now', accent: 'var(--accent)', bg: 'rgba(233,83,53,0.08)' },
    { label: 'Weekly Streak', value: loading ? '--' : `${streakDays}d`, icon: 'local_fire_department', badge: 'Active', accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    { label: 'Posts Generated', value: loading ? '--' : String(postsGenerated), icon: 'description', badge: 'Total', accent: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    { label: 'Posts Published', value: loading ? '--' : String(postsPublished), icon: 'check_circle', badge: 'Self-reported', accent: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  ];

  const recentSessions = sessions.slice(0, 5);

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const chartData: ChartBar[] = useMemo(() => {
    // Show last 7 calendar days (rolling window) — always shows recent sessions
    const days: ChartBar[] = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - daysAgo);
      dayDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(dayDate);
      nextDay.setDate(dayDate.getDate() + 1);
      const dow = dayDate.getDay();

      const sessCount = sessions.filter((s) => {
        const d = new Date(s.createdAt);
        return d >= dayDate && d < nextDay;
      }).length;

      const pubCount = sessions.filter((s) => {
        const d = new Date(s.createdAt);
        return d >= dayDate && d < nextDay && s.status === 'completed';
      }).length;

      days.push({
        label: DAY_LABELS[dow],
        sessions: sessCount,
        published: pubCount,
        faded: dow === 0 || dow === 6,
      });
    }
    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  return (
    <div className="screen-frame relative px-3 pb-6 pt-3 sm:px-4 lg:px-5">
      <DashboardTopBar
        rightSlot={
          <button type="button" className="glass-button inline-flex h-8 w-8 items-center justify-center rounded-lg" aria-label="Notifications">
            <span className="material-symbols-outlined text-[16px]">notifications</span>
          </button>
        }
      />

      {hasPaused && (
        <PausedBanner
          onResume={() => {
            const p = sessions.find((s) => s.status === 'in_progress');
            if (p) window.location.href = `/interview/${p.id}`;
          }}
          onDiscard={() => setHasPaused(false)}
        />
      )}

      {/* Hero */}
      <section
        className="relative mb-3 w-full overflow-hidden rounded-[14px] p-4 sm:p-5 lg:p-6"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--hero-shadow)', border: 'var(--hero-ring)' }}
      >
        <span
          className="material-symbols-outlined pointer-events-none absolute -right-4 -top-14 !text-[220px] leading-none"
          style={{ transform: 'rotate(15deg)', color: 'var(--hero-decor-color)', opacity: 'var(--hero-decor-opacity)' }}
          aria-hidden
        >mic</span>
        <div className="relative flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-[32px] w-[30px] items-center justify-center rounded-[4px] backdrop-blur-sm" style={{ background: 'var(--hero-icon-bg)' }}>
              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--hero-heading)' }}>mic</span>
            </div>
            <span className="inline-flex h-[20px] items-center rounded-full px-2 text-[9px] font-extrabold uppercase tracking-[0.1em]" style={{ background: 'var(--hero-badge-bg)', border: '1px solid var(--hero-badge-border)', color: 'var(--hero-heading)' }}>
              Live Now
            </span>
          </div>
          <div className="max-w-[420px]">
            <h1 className="text-[16px] font-extrabold leading-[1.22] tracking-[-0.02em] sm:text-[19px] lg:text-[22px]" style={{ color: 'var(--hero-heading)' }}>
              Ready to record your<br />next session?
            </h1>
            <p className="mt-1 text-[11px] leading-[1.55] sm:text-[12px] lg:text-[13px]" style={{ color: 'var(--hero-body)' }}>
              Turn 5 minutes of voice into a week of high-authority content.
            </p>
          </div>
          <Link
            href="/discover"
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-all hover:scale-[1.01] active:scale-[0.99] sm:max-w-[260px]"
            style={{ background: 'var(--hero-btn-bg)', color: 'var(--hero-btn-text)', boxShadow: 'var(--hero-btn-shadow)' }}
          >
            <span className="material-symbols-outlined text-[16px]">mic</span>
            Start Session
          </Link>
        </div>
      </section>

      {/* 4 Stat cards */}
      <section className="mb-3 grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.label}
            className="relative overflow-hidden rounded-[14px] p-3 sm:p-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px]" style={{ background: card.bg }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: card.accent, fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
              </div>
              <span className="inline-flex h-[18px] items-center rounded-full px-1.5 text-[8px] font-bold uppercase tracking-[0.07em]" style={{ background: card.bg, color: card.accent }}>
                {card.badge}
              </span>
            </div>
            <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">{card.label}</p>
            <p className="mt-0.5 text-[26px] font-extrabold leading-none tracking-[-0.04em] text-[var(--text-primary)]">{card.value}</p>
            <span className="material-symbols-outlined pointer-events-none absolute -bottom-2 -right-2 !text-[52px] leading-none" style={{ color: card.accent, opacity: 0.06, fontVariationSettings: "'FILL' 1" }} aria-hidden>{card.icon}</span>
          </article>
        ))}
      </section>

      {/* Chart + Sessions | Brain health */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-[1fr_320px]">

        {/* Left col */}
        <div className="flex flex-col gap-2.5">

          {/* Chart */}
          <article className="glass-panel rounded-[14px] p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[12px] font-bold text-primary">Interview Velocity</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /><span className="text-[9px] font-bold uppercase tracking-[0.07em] text-[var(--text-secondary)]">Sessions</span></div>
                <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /><span className="text-[9px] font-bold uppercase tracking-[0.07em] text-[var(--text-secondary)]">Published</span></div>
              </div>
            </div>
            <VelocityChart data={chartData} />
          </article>

          {/* Recent sessions */}
          <article className="glass-panel rounded-[14px] p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[12px] font-bold text-primary">Recent Sessions</h2>
              <Link href="/sessions" className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--accent)] hover:underline">View All</Link>
            </div>
            {loading ? (
              <p className="py-4 text-center text-[11px] text-[var(--text-secondary)]">Loading…</p>
            ) : sessions.length === 0 ? (
              <EmptyNudge />
            ) : (
              <div className="space-y-1.5">
                {recentSessions.map((session, i) => {
                  const pill = statusPill(session.status);
                  const icon = ROW_ICONS[i % ROW_ICONS.length];
                  return (
                    <Link
                      key={session.id}
                      href={`/review/${session.id}`}
                      className="flex items-center gap-2 rounded-[10px] border border-black/[0.06] bg-black/[0.025] p-2 transition-all hover:-translate-y-px hover:border-[var(--accent)]/25 dark:border-white/[0.05] dark:bg-white/[0.03] sm:gap-2.5 sm:p-2.5"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${icon.bg}`}>
                        <span className={`material-symbols-outlined text-[14px] ${icon.color}`}>{icon.glyph}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-primary">{session.title || 'Untitled Session'}</p>
                        <p className="mt-0.5 font-mono text-[9px] text-[var(--text-secondary)]">{formatDuration(session.duration ?? 0)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${pill.cls}`}>{pill.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        {/* Right col: Brain health + Quick actions */}
        <div className="flex flex-col gap-2.5">

          {/* Brain health */}
          <article className="glass-panel rounded-[14px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[12px] font-bold text-primary">Digital Brain</h2>
              <Link href="/brain" className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--accent)] hover:underline">Open</Link>
            </div>

            {brainStats === null || brainStats.total === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="material-symbols-outlined text-[32px] text-[var(--text-secondary)]">psychology</span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {brainStats === null ? 'Loading brain data…' : 'No memories yet.'}
                  {brainStats?.total === 0 && <><br />Complete a session to start building.</>}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Memories', value: brainStats.total, icon: 'neurology', color: 'var(--accent)' },
                    { label: 'Frameworks', value: brainStats.frameworks, icon: 'account_tree', color: '#6366f1' },
                    { label: 'Stories', value: brainStats.stories, icon: 'auto_stories', color: '#10b981' },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1 rounded-[10px] py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: s.color, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                      <p className="text-[15px] font-extrabold leading-none text-[var(--text-primary)]">{s.value}</p>
                      <p className="text-[8px] uppercase tracking-wider text-[var(--text-secondary)]">{s.label}</p>
                    </div>
                  ))}
                </div>

                {brainStats.topFrameworks.length > 0 && (
                  <div className="mb-3 space-y-1">
                    <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Top Frameworks</p>
                    {brainStats.topFrameworks.map((f) => (
                      <div key={f} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(233,83,53,0.07)', border: '1px solid rgba(233,83,53,0.12)' }}>
                        <span className="material-symbols-outlined text-[11px] text-[var(--accent)]">schema</span>
                        <span className="truncate text-[11px] font-medium text-[var(--text-primary)]">{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-[var(--text-secondary)]">
                    {brainStats.lastUpdated ? `${brainStats.total} items stored` : 'Up to date'}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    <span className="h-1 w-1 rounded-full bg-[#10b981] animate-pulse" />
                    Live
                  </span>
                </div>
              </>
            )}
          </article>

        </div>
      </section>
    </div>
  );
}
