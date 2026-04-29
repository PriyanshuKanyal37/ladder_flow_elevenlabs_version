'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type WaveformMode = 'idle' | 'listening' | 'speaking' | 'thinking';

interface WaveformProps {
  isActive?: boolean;
  mode?: WaveformMode;
  barCount?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MODE_META: Record<WaveformMode, {
  core: string;
  core2: string;
  core3: string;
  edge: string;
  glow: string;
  shadow: string;
  label: string;
  tempo: string;
}> = {
  idle: {
    core: 'rgba(148,163,184,0.34)',
    core2: 'rgba(71,85,105,0.3)',
    core3: 'rgba(255,255,255,0.12)',
    edge: 'rgba(255,255,255,0.18)',
    glow: 'rgba(255,255,255,0.08)',
    shadow: 'rgba(0,0,0,0.48)',
    label: 'Idle',
    tempo: '5200ms',
  },
  listening: {
    core: 'rgba(45,212,191,0.72)',
    core2: 'rgba(14,165,233,0.44)',
    core3: 'rgba(20,184,166,0.32)',
    edge: 'rgba(34,211,238,0.62)',
    glow: 'rgba(20,184,166,0.34)',
    shadow: 'rgba(20,184,166,0.36)',
    label: 'You are speaking',
    tempo: '2600ms',
  },
  speaking: {
    core: 'rgba(240,114,82,0.74)',
    core2: 'rgba(245,158,11,0.38)',
    core3: 'rgba(236,72,153,0.28)',
    edge: 'rgba(240,114,82,0.66)',
    glow: 'rgba(240,114,82,0.36)',
    shadow: 'rgba(240,114,82,0.34)',
    label: 'AI is speaking',
    tempo: '3400ms',
  },
  thinking: {
    core: 'rgba(245,158,11,0.58)',
    core2: 'rgba(240,114,82,0.32)',
    core3: 'rgba(250,204,21,0.25)',
    edge: 'rgba(245,158,11,0.52)',
    glow: 'rgba(245,158,11,0.24)',
    shadow: 'rgba(245,158,11,0.24)',
    label: 'AI is thinking',
    tempo: '4200ms',
  },
};

const blobStyles = [
  { width: '54%', height: '46%', left: '14%', top: '22%', animationName: 'lf-orb-blob-a', animationDelay: '0ms' },
  { width: '50%', height: '58%', left: '39%', top: '17%', animationName: 'lf-orb-blob-b', animationDelay: '180ms' },
  { width: '46%', height: '42%', left: '25%', top: '49%', animationName: 'lf-orb-blob-c', animationDelay: '360ms' },
  { width: '34%', height: '34%', left: '55%', top: '50%', animationName: 'lf-orb-blob-d', animationDelay: '540ms' },
];

export function Waveform({ isActive = false, mode, size = 'lg', className }: WaveformProps) {
  const resolvedMode: WaveformMode = mode ?? (isActive ? 'listening' : 'idle');
  const meta = MODE_META[resolvedMode];
  const isMoving = resolvedMode !== 'idle';
  const orbSize = size === 'sm' ? 112 : size === 'md' ? 176 : 284;
  const orbStyle = {
    '--orb-core': meta.core,
    '--orb-core-2': meta.core2,
    '--orb-core-3': meta.core3,
    '--orb-edge': meta.edge,
    '--orb-glow': meta.glow,
    '--orb-shadow': meta.shadow,
    '--orb-tempo': meta.tempo,
  } as CSSProperties;

  return (
    <div className={cn('relative flex flex-col items-center justify-center', className)} aria-label={meta.label}>
      <div
        className="relative isolate rounded-full"
        style={{
          ...orbStyle,
          width: orbSize,
          height: orbSize,
          animationName: isMoving ? (resolvedMode === 'speaking' ? 'lf-orb-speak' : 'lf-orb-listen') : 'lf-orb-idle',
          animationDuration: isMoving ? meta.tempo : '6000ms',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }}
      >
        <div
          className="absolute -inset-[28%] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--orb-glow) 0%, transparent 68%)',
            animationName: isMoving ? 'lf-orb-halo' : 'none',
            animationDuration: meta.tempo,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
        />

        <div
          className="absolute inset-0 overflow-hidden rounded-full border"
          style={{
            borderColor: 'var(--orb-edge)',
            background: [
              'radial-gradient(circle at 58% 43%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.24) 9%, transparent 22%)',
              'radial-gradient(circle at 36% 30%, var(--orb-core-2) 0%, transparent 34%)',
              'radial-gradient(circle at 68% 70%, var(--orb-core-3) 0%, transparent 38%)',
              'radial-gradient(circle at 50% 55%, rgba(4,12,18,0.2) 0%, rgba(2,6,12,0.72) 78%)',
              'linear-gradient(145deg, var(--orb-core), rgba(3,7,18,0.88))',
            ].join(', '),
            boxShadow: [
              'inset 20px 22px 42px rgba(255,255,255,0.08)',
              'inset -28px -30px 58px rgba(0,0,0,0.52)',
              '0 0 0 1px rgba(255,255,255,0.08)',
              '0 28px 80px -32px var(--orb-shadow)',
            ].join(', '),
          }}
        >
          <span
            className="absolute inset-[7%] rounded-full border"
            style={{
              borderColor: 'var(--orb-edge)',
              opacity: 0.72,
              boxShadow: 'inset 0 0 18px var(--orb-glow), 0 0 18px var(--orb-glow)',
            }}
          />
          <span
            className="absolute left-[16%] top-[11%] h-[34%] w-[64%] rounded-[999px] blur-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18), transparent 70%)',
              transform: 'rotate(-21deg)',
            }}
          />

          {blobStyles.map((blob, index) => (
            <span
              key={blob.animationName}
              className="absolute rounded-full blur-[1px] mix-blend-screen"
              style={{
                width: blob.width,
                height: blob.height,
                left: blob.left,
                top: blob.top,
                background: index % 2 === 0 ? 'var(--orb-core)' : 'var(--orb-core-2)',
                opacity: resolvedMode === 'idle' ? 0.28 : 0.58,
                animationName: isMoving ? blob.animationName : 'none',
                animationDuration: meta.tempo,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: blob.animationDelay,
              }}
            />
          ))}

          <span
            className="absolute left-1/2 top-1/2 h-[12%] w-[12%] rounded-full blur-[1px]"
            style={{
              background: 'rgba(255,255,255,0.7)',
              boxShadow: '0 0 34px 12px var(--orb-glow)',
              transform: 'translate(-50%, -50%)',
              animationName: isMoving ? 'lf-orb-core-pulse' : 'none',
              animationDuration: meta.tempo,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}
