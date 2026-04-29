'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHeaders } from '@/lib/auth';
import type { ContentPackCounts, ContentPackResponse } from '@/lib/types/content';

interface PendingReview {
  id: string;
  interviewId: string | null;
  messages: { role: string; content: string }[];
  duration: number;
  topic: string;
  priorTranscript?: string;
}

type FlowStatus = 'idle' | 'saving' | 'analyzing' | 'ready' | 'generating' | 'error';

const EMPTY_COUNTS: ContentPackCounts = { linkedin: 0, x: 0, newsletter: 0 };
const HARD_COUNT_LIMITS: ContentPackCounts = { linkedin: 10, x: 5, newsletter: 3 };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function buildTranscript(pending: PendingReview) {
  const currentTranscript = pending.messages
    .filter((message) => message.content?.trim())
    .map((message) => `${message.role === 'assistant' ? 'AI Host' : 'You'}: ${message.content.trim()}`)
    .join('\n\n');

  return [pending.priorTranscript, currentTranscript]
    .filter((part) => part && part.trim())
    .join('\n\n')
    .trim();
}

function clampCounts(counts: ContentPackCounts, maxCounts: ContentPackCounts): ContentPackCounts {
  return {
    linkedin: Math.min(Math.max(0, counts.linkedin), maxCounts.linkedin),
    x: Math.min(Math.max(0, counts.x), maxCounts.x),
    newsletter: Math.min(Math.max(0, counts.newsletter), maxCounts.newsletter),
  };
}

function totalCounts(counts: ContentPackCounts) {
  return counts.linkedin + counts.x + counts.newsletter;
}

function countLabel(platform: keyof ContentPackCounts, count: number) {
  if (platform === 'linkedin') return `${count} LinkedIn post${count === 1 ? '' : 's'}`;
  if (platform === 'x') return `${count} X thread${count === 1 ? '' : 's'}`;
  return `${count} newsletter${count === 1 ? '' : 's'}`;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110 active:scale-95"
            aria-label={`${star} star`}
          >
            <span
              className="material-symbols-outlined text-[28px] transition-colors"
              style={{
                color: filled ? '#f59e0b' : 'var(--border-default)',
                fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              star
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CountControl({
  label,
  icon,
  value,
  max,
  supported,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  max: number;
  supported: number;
  onChange: (value: number) => void;
}) {
  const aboveRecommendation = value > supported;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-primary">{label}</p>
          <p className="text-[10px]" style={{ color: aboveRecommendation ? '#f59e0b' : 'var(--text-secondary)' }}>
            Recommended support: {supported}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Decrease ${label}`}
        >
          <span className="material-symbols-outlined text-[16px]">remove</span>
        </button>
        <span className="flex h-8 w-9 items-center justify-center rounded-lg text-[13px] font-extrabold text-primary" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Increase ${label}`}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>
    </div>
  );
}

export default function DebriefPage() {
  const router = useRouter();
  const initializedRef = useRef(false);

  const [pending] = useState<PendingReview | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem('pending-review');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PendingReview;
    } catch {
      return null;
    }
  });

  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [error, setError] = useState('');
  const [pack, setPack] = useState<ContentPackResponse | null>(null);
  const [selectedCounts, setSelectedCounts] = useState<ContentPackCounts>(EMPTY_COUNTS);

  const transcript = useMemo(() => (pending ? buildTranscript(pending) : ''), [pending]);
  const summary = pack?.summary;
  const supportedCounts = summary?.allowed_max_counts || EMPTY_COUNTS;
  const recommendedCounts = summary?.recommended_counts || EMPTY_COUNTS;
  const isQualityOverride =
    selectedCounts.linkedin > supportedCounts.linkedin ||
    selectedCounts.x > supportedCounts.x ||
    selectedCounts.newsletter > supportedCounts.newsletter;
  const hasGenerateSelection = !!pending?.interviewId && totalCounts(selectedCounts) > 0;

  useEffect(() => {
    if (!pending) router.replace('/dashboard');
  }, [pending, router]);

  useEffect(() => {
    if (!pending || initializedRef.current) return;
    initializedRef.current = true;

    const preparePack = async () => {
      if (!pending.interviewId) {
        setError('Missing interview ID. Please start the interview again.');
        setStatus('error');
        return;
      }
      if (!transcript) {
        setError('No transcript was captured for this session.');
        setStatus('error');
        return;
      }

      try {
        setStatus('saving');
        const patchRes = await fetch(`/api/interviews/${pending.interviewId}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({
            raw_transcript: transcript,
            duration_seconds: pending.duration,
            status: 'DRAFT',
          }),
        });
        if (!patchRes.ok) throw new Error(`Failed to save transcript: ${patchRes.status}`);

        fetch('/api/agent/extract', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            interview_id: pending.interviewId,
            transcript,
            topic: pending.topic,
          }),
        }).catch((extractError) => console.error('Memory extraction failed (non-blocking):', extractError));

        setStatus('analyzing');
        const analyzeRes = await fetch('/api/content-pack/analyze', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ interview_id: pending.interviewId, force: false }),
        });
        if (!analyzeRes.ok) {
          const text = await analyzeRes.text();
          throw new Error(`Content analysis failed: ${analyzeRes.status} ${text}`);
        }

        const analysis = (await analyzeRes.json()) as ContentPackResponse;
        setPack(analysis);
        setSelectedCounts(clampCounts(analysis.summary.recommended_counts, HARD_COUNT_LIMITS));
        setStatus('ready');
      } catch (prepareError) {
        console.error(prepareError);
        setError(prepareError instanceof Error ? prepareError.message : 'Failed to prepare content pack.');
        setStatus('error');
      }
    };

    preparePack();
  }, [pending, transcript]);

  const handleCountChange = (platform: keyof ContentPackCounts, value: number) => {
    setSelectedCounts((current) => clampCounts({ ...current, [platform]: value }, HARD_COUNT_LIMITS));
  };

  const handleGenerate = async () => {
    if (!pending?.interviewId || status !== 'ready' || !hasGenerateSelection) return;
    if (rating > 0) sessionStorage.setItem('session-rating', String(rating));

    try {
      setStatus('generating');
      setError('');
      const res = await fetch('/api/content-pack/generate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          interview_id: pending.interviewId,
          force: false,
          requested_counts: selectedCounts,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Content generation failed: ${res.status} ${text}`);
      }

      sessionStorage.removeItem('pending-review');
      router.push(`/review/${pending.interviewId}`);
    } catch (generateError) {
      console.error(generateError);
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate content pack.');
      setStatus('error');
    }
  };

  if (!pending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div
            className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: 'rgba(233,83,53,0.12)', border: '1px solid rgba(233,83,53,0.2)' }}
          >
            <span className="material-symbols-outlined text-[22px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-primary">Session Complete</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Review the recommended pack size before generation starts.
          </p>
        </div>

        <div
          className="mb-4 flex flex-wrap items-center justify-center gap-5 rounded-2xl px-6 py-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-[20px] font-extrabold text-primary">{formatDuration(pending.duration)}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Duration</p>
          </div>
          <div className="hidden h-8 w-px sm:block" style={{ background: 'var(--border-default)' }} />
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-[20px] font-extrabold text-primary">{pending.messages.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Exchanges</p>
          </div>
          <div className="hidden h-8 w-px sm:block" style={{ background: 'var(--border-default)' }} />
          <div className="flex max-w-[220px] flex-col items-center gap-0.5">
            <p className="w-full truncate text-center text-[13px] font-bold text-[var(--accent)]">{pending.topic}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Topic</p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Content Pack Analysis</p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                {status === 'saving' && 'Saving transcript...'}
                {status === 'analyzing' && 'Extracting real content signals...'}
                {status === 'generating' && 'Generating your selected content pack...'}
                {status === 'ready' && summary && `Found ${summary.usable_signal_count} usable signals and ${summary.strong_signal_count} strong ideas.`}
                {status === 'error' && 'Something needs attention before generation can continue.'}
                {status === 'idle' && 'Preparing analysis...'}
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
              style={{
                background: status === 'ready' ? 'rgba(16,185,129,0.12)' : status === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                color: status === 'ready' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b',
              }}
            >
              <span className={`h-1 w-1 rounded-full ${status === 'ready' ? 'bg-[#10b981]' : status === 'error' ? 'bg-[#ef4444]' : 'bg-[#f59e0b] animate-pulse'}`} />
              {status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : 'Working'}
            </span>
          </div>

          {summary ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-raised)' }}>
                  <p className="text-[20px] font-extrabold text-primary">{summary.usable_signal_count}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">Usable signals</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-raised)' }}>
                  <p className="text-[20px] font-extrabold text-primary">{summary.strong_signal_count}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">Strong ideas</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-raised)' }}>
                  <p className="text-[20px] font-extrabold capitalize text-primary">{summary.conversation_quality}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">Quality</p>
                </div>
              </div>

              <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(233,83,53,0.08)', border: '1px solid rgba(233,83,53,0.16)' }}>
                <p className="text-[12px] font-semibold text-primary">
                  Recommended: {countLabel('linkedin', recommendedCounts.linkedin)}, {countLabel('x', recommendedCounts.x)}, {countLabel('newsletter', recommendedCounts.newsletter)}.
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Adjust counts below. Recommendations show what the transcript strongly supports; you can still generate more and edit manually.
                </p>
              </div>

              <div className="space-y-2">
                <CountControl label="LinkedIn posts" icon="work" value={selectedCounts.linkedin} max={HARD_COUNT_LIMITS.linkedin} supported={supportedCounts.linkedin} onChange={(value) => handleCountChange('linkedin', value)} />
                <CountControl label="X threads" icon="alternate_email" value={selectedCounts.x} max={HARD_COUNT_LIMITS.x} supported={supportedCounts.x} onChange={(value) => handleCountChange('x', value)} />
                <CountControl label="Newsletters" icon="mail" value={selectedCounts.newsletter} max={HARD_COUNT_LIMITS.newsletter} supported={supportedCounts.newsletter} onChange={(value) => handleCountChange('newsletter', value)} />
              </div>

              {isQualityOverride && (
                <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-[11px] text-[#f59e0b]">
                    You selected more than the analysis recommends. Generation will continue, but review these drafts closely because they may need more editing.
                  </p>
                </div>
              )}

              {summary.warnings.length > 0 && (
                <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {summary.warnings.map((warning) => (
                    <p key={warning} className="text-[11px] text-[#f59e0b]">{warning}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-raised)]" />
              <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--surface-raised)]" />
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-xl px-3 py-2 text-[11px] text-[#ef4444]" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}
        </div>

        <div className="mb-4 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <p className="mb-1 text-[13px] font-bold text-primary">How much did this session sound like you?</p>
          <p className="mb-4 text-[11px] text-[var(--text-secondary)]">Optional - helps calibrate your Digital Brain.</p>
          <div className="flex flex-wrap items-center gap-4">
            <StarRating value={rating} onChange={setRating} />
            {rating > 0 && (
              <span className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>
                {['', 'Not quite me', 'Somewhat me', 'Mostly me', 'Very me', "That's exactly me"][rating]}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleGenerate}
            disabled={status !== 'ready' || !hasGenerateSelection}
            className="accent-gradient h-[52px] w-full rounded-xl text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(233,83,53,0.35)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {status === 'generating' ? 'Generating Pack...' : `Generate ${totalCounts(selectedCounts)} Assets`}
          </button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => router.push('/posts')}
              className="h-[44px] rounded-xl border border-subtle text-[13px] font-semibold text-primary transition-colors hover:bg-[var(--surface-raised)]"
            >
              Open Posts Library
            </button>
            <button
              onClick={() => router.push('/sessions')}
              className="h-[44px] rounded-xl border border-subtle text-[13px] font-semibold text-primary transition-colors hover:bg-[var(--surface-raised)]"
            >
              Back to Sessions
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-[var(--text-secondary)]">
          Generated content will open in the review workspace and stay saved after refresh.
        </p>
      </div>
    </div>
  );
}
