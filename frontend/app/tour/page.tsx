'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const SLIDES = [
  {
    step: 1,
    icon: 'dashboard',
    tag: 'Home & Stats',
    headline: 'Your command centre',
    description:
      'See your sessions, weekly streak, posts generated, and published count — all in one glance. Everything you need to stay consistent.',
    visual: 'stats',
  },
  {
    step: 2,
    icon: 'mic',
    tag: 'Create Podcast',
    headline: 'Record once.\nPublish everywhere.',
    description:
      'Talk for 5 minutes. Our AI extracts your expertise and turns it into LinkedIn posts, X threads, and newsletters — in your voice.',
    visual: 'session',
  },
  {
    step: 3,
    icon: 'psychology',
    tag: 'Digital Brain',
    headline: 'Your knowledge,\nremembered.',
    description:
      'Every session builds your Digital Brain — a private knowledge graph of your opinions, frameworks, proof points, and stories.',
    visual: 'brain',
  },
  {
    step: 4,
    icon: 'edit_note',
    tag: 'Content Strategy',
    headline: 'Strategy that\nshapes content.',
    description:
      'Define your goals, themes, and voice once. Every session aligns to your strategy automatically — no re-explaining every time.',
    visual: 'strategy',
  },
];

function StatsVisual() {
  const cards = [
    { label: 'Sessions', value: '12', icon: 'mic', color: 'var(--accent)' },
    { label: 'Streak', value: '7d', icon: 'local_fire_department', color: '#f59e0b' },
    { label: 'Posts', value: '84', icon: 'description', color: '#10b981' },
    { label: 'Published', value: '61', icon: 'check_circle', color: '#6366f1' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-4 flex flex-col gap-1"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color: c.color, fontVariationSettings: "'FILL' 1" }}>
            {c.icon}
          </span>
          <p className="text-[22px] font-bold leading-none mt-1">{c.value}</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function SessionVisual() {
  const bars = [30, 55, 80, 45, 95, 60, 40, 75, 50, 85, 35, 65, 70, 50, 90];
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[280px]">
      <div
        className="w-full rounded-2xl p-5 flex flex-col items-center gap-4"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">Recording</span>
        </div>
        <div className="flex items-end gap-1 h-14">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full"
              style={{
                height: `${h}%`,
                background: 'var(--accent)',
                boxShadow: '0 0 6px rgba(233,83,53,0.5)',
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">14:32 elapsed</p>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full">
        {['LinkedIn', 'X Thread', 'Newsletter'].map((p) => (
          <div
            key={p}
            className="rounded-lg py-2 text-center text-[10px] font-semibold"
            style={{ background: 'rgba(233,83,53,0.12)', color: 'var(--accent)', border: '1px solid rgba(233,83,53,0.2)' }}
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

function BrainVisual() {
  const nodes = [
    { x: 50, y: 50, size: 28, label: 'Framework', color: 'var(--accent)' },
    { x: 20, y: 20, size: 18, label: 'Opinion', color: '#6366f1' },
    { x: 80, y: 22, size: 16, label: 'Story', color: '#10b981' },
    { x: 15, y: 70, size: 14, label: 'Proof', color: '#f59e0b' },
    { x: 82, y: 72, size: 16, label: 'CTA', color: '#ec4899' },
    { x: 50, y: 88, size: 12, label: 'Signal', color: '#8b5cf6' },
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
  ];
  return (
    <div
      className="w-full max-w-[280px] rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="relative w-full" style={{ paddingBottom: '80%' }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={nodes[a].x} y1={nodes[a].y}
              x2={nodes[b].x} y2={nodes[b].y}
              stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"
            />
          ))}
          {nodes.map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={n.size / 4} fill={n.color} opacity="0.85" />
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {nodes.map((n) => (
          <span
            key={n.label}
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: `${n.color}22`, color: n.color, border: `1px solid ${n.color}44` }}
          >
            {n.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StrategyVisual() {
  const items = [
    { label: 'Primary Goal', value: 'Build authority', icon: 'flag' },
    { label: 'Posting Frequency', value: '3× per week', icon: 'calendar_today' },
    { label: 'Key Themes', tags: ['Pricing', 'GTM', 'Ops'] },
    { label: 'Platforms', tags: ['LinkedIn', 'X', 'Newsletter'] },
  ];
  return (
    <div className="flex flex-col gap-2.5 w-full max-w-[280px]">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">{item.label}</p>
          {'tags' in item ? (
            <div className="flex flex-wrap gap-1.5">
              {item.tags!.map((t) => (
                <span
                  key={t}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'rgba(233,83,53,0.15)', color: 'var(--accent)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {item.icon}
              </span>
              <p className="text-[13px] font-semibold">{item.value}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const VISUALS: Record<string, React.ReactNode> = {
  stats: <StatsVisual />,
  session: <SessionVisual />,
  brain: <BrainVisual />,
  strategy: <StrategyVisual />,
};

export default function TourPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];

  const next = () => {
    if (current < SLIDES.length - 1) setCurrent(current + 1);
    else router.push('/onboarding');
  };

  const skip = () => router.push('/onboarding');

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden">
      <div className="mesh-background" />

      {/* Header */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
            mic
          </span>
          <span className="text-[17px] font-bold tracking-tight">Ladder Flow</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={skip}
            className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Skip tour
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex min-h-screen flex-col items-center justify-center px-5 pt-20 pb-24">
        <div className="w-full max-w-[480px]">

          {/* Step dots */}
          <div className="mb-8 flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === current ? '24px' : '8px',
                  height: '8px',
                  background: i === current ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {/* Card */}
          <div
            key={current}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--form-glass-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--form-glass-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            }}
          >
            {/* Visual area */}
            <div
              className="flex items-center justify-center px-8 py-10"
              style={{ background: 'rgba(0,0,0,0.08)', borderBottom: '1px solid var(--form-glass-border)' }}
            >
              {VISUALS[slide.visual]}
            </div>

            {/* Text content */}
            <div className="p-7 lg:p-8">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[15px] text-[var(--accent)]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {slide.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
                  {slide.tag}
                </span>
              </div>

              <h2 className="text-[24px] font-bold leading-[1.2] tracking-tight whitespace-pre-line">
                {slide.headline}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {slide.description}
              </p>

              <div className="mt-6 flex items-center gap-3">
                {current > 0 && (
                  <button
                    onClick={() => setCurrent(current - 1)}
                    className="h-[48px] rounded-xl border px-5 text-[13px] font-semibold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--form-glass-border)' }}
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="accent-gradient h-[48px] flex-1 rounded-xl text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {current < SLIDES.length - 1 ? 'Next' : 'Get Started'}
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-[var(--text-secondary)]">
            {current + 1} of {SLIDES.length}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 z-40 flex w-full flex-wrap items-center justify-center gap-4 px-6 py-3 sm:gap-6">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          © 2025 Ladder Flow. Built for Executives.
        </span>
      </footer>
    </div>
  );
}
