'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateAgentConfig } from '@/lib/api/agent';
import type { ResearchResult } from '@/lib/types/trending';
import { useUser } from '@/lib/context/UserContext';

function estimateSession(topicCount: number, keywordCount: number, arcLength: number): string {
  // ~3 min per talking point, 2 min per extra keyword (breadth), up to 15 min for dense arc
  const fromTopics = topicCount * 3;
  const fromKeywords = Math.max(0, keywordCount - 1) * 2;
  const fromArc = Math.min(15, Math.floor(arcLength / 400));
  const total = Math.min(60, Math.max(15, 15 + fromTopics + fromKeywords + fromArc));
  const lo = Math.round(total / 5) * 5;
  const hi = Math.min(60, lo + 10);
  return `${lo}–${hi} minutes`;
}

const STEPS = [
  { id: 1, label: 'Keywords' },
  { id: 2, label: 'Research' },
  { id: 3, label: 'Angles' },
  { id: 4, label: 'Outline' },
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const { user } = useUser();
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [userName, setUserName] = useState('Guest');
  const [sessionArc, setSessionArc] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [keywordCount, setKeywordCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startLockRef = useRef(false);

  useEffect(() => {
    if (user?.full_name) setUserName(user.full_name);
  }, [user]);

  useEffect(() => {
    const stored = sessionStorage.getItem('research-context');
    if (!stored) { router.push('/discover/trending'); return; }
    try {
      const ctx = JSON.parse(stored) as ResearchResult;
      setResearchResult(ctx);
      setSessionArc(ctx.deep_context);
      setTopics(ctx.discussion_points.length ? ctx.discussion_points : ctx.key_insights);
      const kw = sessionStorage.getItem('trending-keywords') || '';
      setKeywordCount(kw.split(',').map((k) => k.trim()).filter(Boolean).length || 1);
      setIsLoading(false);
    } catch {
      setError('Invalid research context.');
      setIsLoading(false);
    }
  }, [router]);

  const updateTopic = (i: number, v: string) => setTopics((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  const addTopic = () => setTopics((prev) => [...prev, 'New talking point']);
  const removeTopic = (i: number) => setTopics((prev) => prev.filter((_, idx) => idx !== i));

  const handleStart = async () => {
    if (!researchResult) return;
    if (startLockRef.current) return;
    startLockRef.current = true;
    setIsGenerating(true);
    setError(null);
    try {
      const config = await generateAgentConfig({
        topic: researchResult.title,
        userName,
        topic_title: researchResult.title,
        global_context: sessionArc,
        why_this_matters: researchResult.key_insights.join('\n'),
        key_questions: topics,
      });
      if (!config.interviewId) throw new Error('Invalid session response from server.');
      if (config.provider === 'elevenlabs') {
        if (!config.agentId && !config.signedUrl) throw new Error('Invalid ElevenLabs session response');
      } else if (!config.token || !config.livekitUrl) {
        throw new Error('Invalid LiveKit session response');
      }
      sessionStorage.setItem('agent-config', JSON.stringify(config));
      sessionStorage.setItem('research-context', JSON.stringify({ ...researchResult, deep_context: sessionArc, discussion_points: topics }));
      router.push('/interview');
    } catch {
      setError('Failed to initialize the interview agent. Please try again.');
    } finally {
      startLockRef.current = false;
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error && !researchResult) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <span className="material-symbols-outlined text-[40px] text-[var(--danger)]">error</span>
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{error}</p>
          <button onClick={() => router.push('/discover/trending')} className="accent-gradient mt-5 rounded-xl px-6 py-2.5 text-[13px] font-bold text-white">
            Back to Discovery
          </button>
        </div>
      </div>
    );
  }

  if (!researchResult) return null;

  return (
    <div className="screen-frame min-h-screen px-4 py-6 md:px-8">

      {/* Step progress */}
      <nav className="mb-8 flex items-center justify-center">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const active = step.id === 4;
            const done = step.id < 4;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                    style={
                      active
                        ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 14px rgba(233,83,53,0.4)' }
                        : done
                        ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)' }
                        : { background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
                    }
                  >
                    {done ? <span className="material-symbols-outlined text-[13px]">check</span> : step.id}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: active ? 'var(--accent)' : done ? '#10b981' : 'var(--text-secondary)' }}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-2.5 mb-4 h-px w-10 md:w-14" style={{ background: done ? 'rgba(16,185,129,0.4)' : 'var(--border-default)' }} />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-tight text-primary sm:text-[28px]">Your Session Plan</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Review and edit if needed — then begin your interview.</p>
        </div>

        {/* Topic badge */}
        <div className="mb-5 flex">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold"
            style={{ background: 'rgba(233,83,53,0.12)', color: 'var(--accent)', border: '1px solid rgba(233,83,53,0.25)' }}
          >
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>label</span>
            {researchResult.title}
          </span>
        </div>

        {/* Session arc */}
        <div className="mb-4 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Session Arc</p>
          <textarea
            value={sessionArc}
            onChange={(e) => setSessionArc(e.target.value)}
            rows={4}
            className="w-full rounded-xl p-3.5 text-[13px] leading-relaxed text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--accent)]"
            style={{ background: 'var(--background)', border: '1px solid rgba(255,255,255,0.08)', resize: 'none' }}
          />
        </div>

        {/* Talking points */}
        <div className="mb-4 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">We&apos;ll Explore</p>
          <div className="space-y-2">
            {topics.map((topic, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ background: 'var(--background)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" style={{ boxShadow: '0 0 6px rgba(233,83,53,0.5)' }} />
                <input
                  value={topic}
                  onChange={(e) => updateTopic(i, e.target.value)}
                  className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
                />
                <button type="button" onClick={() => removeTopic(i)} className="shrink-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--danger)]">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addTopic}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)] hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add talking point
          </button>
        </div>

        {/* Guest name */}
        <div className="mb-6 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Your Name</p>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-all focus:ring-1 focus:ring-[var(--accent)]"
            style={{ background: 'var(--background)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>

        {/* Duration pill */}
        <div className="mb-5 flex items-center justify-center gap-2 rounded-xl py-3" style={{ background: 'var(--surface-raised)' }}>
          <span className="material-symbols-outlined text-[16px] text-[var(--text-secondary)]">timer</span>
          <span className="text-[12px] font-medium text-[var(--text-secondary)]">Estimated session: {estimateSession(topics.length, keywordCount, sessionArc.length)}</span>
        </div>

        {error && (
          <div className="mb-4 rounded-xl p-3 text-center text-[12px] text-[var(--danger)]" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleStart}
            disabled={isGenerating || !userName.trim()}
            className="accent-gradient h-[52px] w-full rounded-xl text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(233,83,53,0.35)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Preparing Studio...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                Start Interview
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/discover/trending')}
            className="h-[44px] rounded-xl text-[13px] font-semibold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
            style={{ border: '1px solid var(--border-default)' }}
          >
            Try a Different Angle
          </button>
        </div>
      </div>
    </div>
  );
}
