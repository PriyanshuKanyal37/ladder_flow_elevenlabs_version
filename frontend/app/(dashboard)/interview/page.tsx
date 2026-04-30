'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { ConversationProvider } from '@elevenlabs/react';
import { useElevenLabsAgent } from '@/hooks/useElevenLabsAgent';

import type { AgentConfigResponse, ElevenLabsSession } from '@/lib/types/agent';
import type { ResearchResult } from '@/lib/types/trending';
import type { TranscriptMessage } from '@/lib/types/transcript';
import { Waveform } from '@/components/interview/Waveform';
import { TranscriptPanel } from '@/components/interview/TranscriptPanel';
import { ControlDock } from '@/components/interview/ControlDock';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState } from '@/components/shared/LoadingState';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { authHeaders } from '@/lib/auth';

const AUTOSAVE_INTERVAL_MS = 10_000;
const CONNECT_TIMEOUT_MS = 90_000;
const STARTUP_IDLE_TIMEOUT_MS = 90_000;

function isExpectedClientDisconnect(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('client initiated disconnect');
}

function readSession(): {
  session: (AgentConfigResponse & { resumed?: boolean }) | null;
  context: ResearchResult | null;
  priorTranscript: string;
} {
  if (typeof window === 'undefined') return { session: null, context: null, priorTranscript: '' };
  try {
    const rawSession = sessionStorage.getItem('agent-config');
    const rawContext = sessionStorage.getItem('research-context');
    const priorTranscript = sessionStorage.getItem('resume-prior-transcript') || '';
    if (!rawSession || !rawContext) return { session: null, context: null, priorTranscript: '' };
    const session = JSON.parse(rawSession) as AgentConfigResponse & { resumed?: boolean };
    const context = JSON.parse(rawContext) as ResearchResult;
    const isElevenLabs = session.provider === 'elevenlabs';
    if (!session.interviewId || (isElevenLabs && !session.agentId && !session.signedUrl)) {
      return { session: null, context: null, priorTranscript: '' };
    }
    if (!isElevenLabs && (!('token' in session) || !session.token || !session.livekitUrl)) {
      return { session: null, context: null, priorTranscript: '' };
    }
    return { session, context, priorTranscript };
  } catch {
    return { session: null, context: null, priorTranscript: '' };
  }
}

function messagesToText(messages: TranscriptMessage[]): string {
  return messages
    .filter((m) => m.final !== false)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
}

function buildFullTranscript(prior: string, live: TranscriptMessage[]): string {
  const liveText = messagesToText(live);
  if (!prior) return liveText;
  if (!liveText) return prior;
  return `${prior}\n${liveText}`;
}

function clearVoiceSessionStorage() {
  sessionStorage.removeItem('agent-config');
  sessionStorage.removeItem('resume-prior-transcript');
}

function MobileTranscriptPanel({
  messages,
  isRecording,
}: {
  messages: TranscriptMessage[];
  isRecording: boolean;
}) {
  return (
    <section className="absolute bottom-28 left-4 right-4 z-10 flex max-h-[30vh] flex-col overflow-hidden rounded-2xl border border-subtle bg-[var(--surface-frost)] shadow-[0_18px_48px_-30px_var(--glass-shadow)] backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <h3 className="label-kicker">Live Transcript</h3>
        <span className="mono-text text-[11px] text-secondary">{messages.length} lines</span>
      </div>
      {messages.length > 0 ? (
        <TranscriptPanel messages={messages} isRecording={isRecording} currentText="" />
      ) : (
        <div className="px-4 py-5 text-center text-[12px] text-secondary">
          Waiting for transcript...
        </div>
      )}
    </section>
  );
}

function InterviewPageInner() {
  const router = useRouter();

  const [sessionData] = useState(() => {
    const { session, context, priorTranscript } = readSession();
    return {
      session,
      researchContext: context,
      priorTranscript,
      isResume: Boolean(session?.resumed && priorTranscript),
      sessionMissing: !session || !context,
    };
  });

  const { session, researchContext, priorTranscript, isResume, sessionMissing } = sessionData;
  const elevenSession = session && session.provider === 'elevenlabs'
    ? (session as ElevenLabsSession & { resumed?: boolean })
    : null;

  // Clear the resume marker on mount so a reload doesn't loop
  useEffect(() => {
    if (isResume) sessionStorage.removeItem('resume-prior-transcript');
  }, [isResume]);

  const [duration, setDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoDisconnectReason, setAutoDisconnectReason] = useState<string | null>(null);
  const [voiceStartRequested, setVoiceStartRequested] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isEndingRef = useRef(false);
  const draftSavedRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const lastVoiceActivityRef = useRef<number>(0);

  const { state, messages, connect, disconnect, toggleMute, isMuted } =
    useElevenLabsAgent({
      onError: useCallback((err: string) => {
        if (err.toLowerCase().includes('client initiated disconnect')) {
          return;
        }
        console.error('[ElevenLabs]', err);
      }, []),
    });

  // Keep the latest live state in refs so unload/disconnect handlers can read it
  const messagesRef = useRef<TranscriptMessage[]>([]);
  const durationRef = useRef(0);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const hasConnectedRef = useRef(false);
  useEffect(() => {
    if (!elevenSession) return;
    if (!voiceStartRequested) return;
    if (isEndingRef.current) return;
    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    connect(elevenSession).catch((err) => {
      if (!isExpectedClientDisconnect(err)) {
        console.error('[Interview] connect failed:', err);
      }
      hasConnectedRef.current = false;
    });

    return () => {
      disconnect();
      hasConnectedRef.current = false;
    };
  }, [elevenSession, voiceStartRequested, connect, disconnect]);

  useEffect(() => {
    if (!elevenSession || state.isConnected || isEndingRef.current) return;
    if (!hasConnectedRef.current) return;

    const timeout = setTimeout(() => {
      setAutoDisconnectReason('Voice connection timed out before the session became active.');
      disconnect();
      clearVoiceSessionStorage();
      hasConnectedRef.current = false;
    }, CONNECT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [elevenSession, state.isConnected, disconnect]);

  useEffect(() => {
    if (!state.isConnected) {
      connectedAtRef.current = null;
      return;
    }
    connectedAtRef.current = Date.now();
    lastVoiceActivityRef.current = Date.now();
  }, [state.isConnected]);

  useEffect(() => {
    if (messages.length > 0 || state.isSpeaking) {
      lastVoiceActivityRef.current = Date.now();
    }
  }, [messages.length, state.isSpeaking]);

  useEffect(() => {
    if (!elevenSession || !state.isConnected || isEndingRef.current) return;

    const interval = setInterval(() => {
      const connectedAt = connectedAtRef.current;
      if (!connectedAt) return;
      const noTranscriptYet = messagesRef.current.length === 0;
      const idleTooLong = Date.now() - lastVoiceActivityRef.current > STARTUP_IDLE_TIMEOUT_MS;
      const startupWindowElapsed = Date.now() - connectedAt > STARTUP_IDLE_TIMEOUT_MS;

      if (noTranscriptYet && idleTooLong && startupWindowElapsed) {
        setAutoDisconnectReason('No voice activity was detected, so the session was stopped to protect credits.');
        disconnect();
        clearVoiceSessionStorage();
        hasConnectedRef.current = false;
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [elevenSession, state.isConnected, disconnect]);

  useEffect(() => {
    if (state.isConnected) {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isConnected]);

  // ─── Autosave heartbeat ──────────────────────────────────────────────
  useEffect(() => {
    if (!elevenSession?.interviewId) return;
    if (!state.isConnected) return;
    const interviewId = elevenSession.interviewId;

    const tick = async () => {
      try {
        await fetch(`/api/interviews/${interviewId}/autosave`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            raw_transcript: buildFullTranscript(priorTranscript, messagesRef.current),
            duration_seconds: durationRef.current,
          }),
        });
      } catch {
        // Autosave is best-effort — the final flush on unload/end is authoritative.
      }
    };

    const id = setInterval(tick, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [elevenSession?.interviewId, state.isConnected, priorTranscript]);

  // ─── beforeunload → finalize draft ────────────────────────────────────
  useEffect(() => {
    if (!elevenSession?.interviewId) return;
    const interviewId = elevenSession.interviewId;

    const onBeforeUnload = () => {
      if (draftSavedRef.current || isEndingRef.current) return;
      try {
        // `keepalive: true` lets the request outlive the page unload AND still
        // carry our Authorization header (sendBeacon can't set headers).
        fetch(`/api/interviews/${interviewId}/finalize-draft`, {
          method: 'POST',
          headers: authHeaders(),
          keepalive: true,
          body: JSON.stringify({
            raw_transcript: buildFullTranscript(priorTranscript, messagesRef.current),
            duration_seconds: durationRef.current,
          }),
        }).catch(() => null);
        draftSavedRef.current = true;
      } catch {
        // swallow — browser is tearing down anyway
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [elevenSession?.interviewId, priorTranscript]);

  const handleSaveAndExit = useCallback(async () => {
    if (!elevenSession?.interviewId) return;
    if (isEndingRef.current || draftSavedRef.current) return;
    setIsSaving(true);
    const interviewId = elevenSession.interviewId;
    try {
      await fetch(`/api/interviews/${interviewId}/finalize-draft`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          raw_transcript: buildFullTranscript(priorTranscript, messagesRef.current),
          duration_seconds: durationRef.current,
        }),
      });
      draftSavedRef.current = true;
    } catch {
      // still navigate away — data is already captured by the last autosave
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    disconnect();
    clearVoiceSessionStorage();
    setVoiceStartRequested(false);
    router.push('/sessions');
  }, [elevenSession, priorTranscript, disconnect, router]);

  const handleEnd = useCallback(() => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(
      'pending-review',
      JSON.stringify({
        id: reviewId,
        interviewId: elevenSession?.interviewId || null,
        messages: [...messagesRef.current],
        duration: durationRef.current,
        topic: researchContext?.title || elevenSession?.topicTitle || 'Discussion',
        priorTranscript,
      })
    );

    disconnect();
    clearVoiceSessionStorage();
    setVoiceStartRequested(false);
    router.push('/debrief');
  }, [disconnect, elevenSession, researchContext, priorTranscript, router]);

  const [isPreparing, setIsPreparing] = useState(true);
  const statusVariant = (): 'live' | 'paused' | 'processing' => {
    if (isMuted) return 'paused';
    if (state.isThinking) return 'processing';
    return 'live';
  };

  const statusLabel = (): string => {
    if (isMuted) return 'Muted';
    if (state.isSpeaking) return 'AI Speaking';
    if (state.isThinking) return 'AI Thinking';
    if (state.isListening) return 'Listening';
    if (!state.isConnected) return 'Connecting...';
    return 'Active';
  };

  useEffect(() => {
    if (!state.isConnected) return;
    const t = setTimeout(() => setIsPreparing(false), 13000);
    return () => clearTimeout(t);
  }, [state.isConnected]);

  useEffect(() => {
    if (state.isSpeaking || messages.length > 0) {
      const t = setTimeout(() => setIsPreparing(false), 0);
      return () => clearTimeout(t);
    }
  }, [state.isSpeaking, messages.length]);

  const formattedDuration = useMemo(() => {
    const m = Math.floor(duration / 60);
    const s = duration % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [duration]);

  const voiceMode = state.isSpeaking
    ? 'speaking'
    : state.isListening && !isMuted
      ? 'listening'
      : state.isThinking
        ? 'thinking'
        : 'idle';

  if (sessionMissing) {
    return (
      <div className="min-h-screen bg-app text-primary">
        <div className="mesh-background" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-subtle bg-[var(--surface-frost-strong)] p-8 text-center shadow-[0_24px_60px_-42px_var(--glass-shadow)] backdrop-blur-xl">
            <span className="material-symbols-outlined text-[40px] text-[var(--accent)]">
              forum
            </span>
            <h1 className="mt-3 text-2xl font-bold">Interview Session Not Ready</h1>
            <p className="mt-2 text-sm text-secondary">
              Start from interview setup to generate a valid live session, then come back here.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => router.push('/interview/new')}
                className="accent-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                Open Setup
              </button>
              <button
                onClick={() => router.push('/discover/trending')}
                className="rounded-xl border border-subtle px-5 py-2.5 text-sm font-semibold text-primary"
              >
                Go to Discovery
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!elevenSession || !researchContext) {
    return (
      <div className="min-h-screen bg-app">
        <LoadingState message="Setting up your interview..." />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-app text-primary">
      <div className="mesh-background" />

      <header className="fixed left-0 top-0 z-30 flex h-16 w-full items-center justify-between border-b border-subtle bg-[var(--surface-frost)] px-4 shadow-[0_12px_34px_-30px_var(--glass-shadow)] backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold tracking-tight text-primary">Ladder Flow</p>
          <span className="mono-text hidden text-[11px] uppercase tracking-[0.1em] text-secondary md:block">
            {researchContext.title}
          </span>
          {isResume && (
            <span
              className="mono-text rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]"
              style={{ background: 'rgba(99,102,241,0.14)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              Resumed
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge variant={statusVariant()} label={statusLabel()} />
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="glass-pill px-3 py-1.5 mono-text text-sm text-primary">{formattedDuration}</div>
        </div>
      </header>

      <div className="relative flex h-screen w-full pt-16">
        {!voiceStartRequested && !state.isConnected && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--surface-frost-strong)] px-4 text-center backdrop-blur-sm">
            <div className="max-w-md rounded-2xl border border-subtle bg-[var(--surface)] p-7 shadow-[0_24px_60px_-42px_var(--glass-shadow)]">
              <span className="material-symbols-outlined text-[36px] text-[var(--accent)]">mic</span>
              <h2 className="mt-3 text-xl font-bold text-primary">Ready to start voice?</h2>
              <p className="mt-2 text-sm text-secondary">
                Voice billing starts only after this click. Keep this tab open only while actively interviewing.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setAutoDisconnectReason(null);
                    setVoiceStartRequested(true);
                  }}
                  className="accent-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Start Voice Session
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearVoiceSessionStorage();
                    router.push('/interview/new');
                  }}
                  className="rounded-xl border border-subtle px-5 py-2.5 text-sm font-semibold text-primary"
                >
                  Back to Setup
                </button>
              </div>
            </div>
          </div>
        )}

        {isPreparing && state.isConnected && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--surface-frost-strong)] backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 animate-ping rounded-full bg-[color:rgba(233,83,53,0.2)]" />
                <div className="absolute inset-2 animate-ping rounded-full bg-[color:rgba(233,83,53,0.24)] [animation-delay:0.2s]" />
                <div className="accent-gradient relative flex h-20 w-20 items-center justify-center rounded-full text-white">
                  <span className="material-symbols-outlined text-[30px]">graphic_eq</span>
                </div>
              </div>
              <p className="text-lg font-semibold text-primary">
                {isResume ? 'Picking up where you left off...' : 'Preparing your session...'}
              </p>
              <p className="text-sm text-secondary">Your AI host is warming up. Hold tight.</p>
            </div>
          </div>
        )}

        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 md:px-10">
          {state.error && (
            <div className="mb-6 max-w-xl rounded-xl border border-[color:rgba(239,68,68,0.35)] bg-[color:rgba(239,68,68,0.12)] px-4 py-3 text-center text-sm text-[var(--danger)]">
              <p>Live connection issue: {state.error}</p>
              <button
                onClick={() => connect(elevenSession).catch(() => null)}
                className="mt-2 rounded-full border border-[color:rgba(254,202,202,0.35)] px-3 py-1 text-xs font-semibold"
              >
                Retry Connection
              </button>
            </div>
          )}
          {autoDisconnectReason && (
            <div className="mb-6 max-w-xl rounded-xl border border-[color:rgba(245,158,11,0.35)] bg-[color:rgba(245,158,11,0.12)] px-4 py-3 text-center text-sm text-[var(--warning)]">
              {autoDisconnectReason}
            </div>
          )}
          <div className="mb-8 flex items-center gap-2 rounded-full border border-[color:rgba(233,83,53,0.25)] bg-[color:rgba(233,83,53,0.1)] px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            <span className="mono-text text-[13px] text-[var(--accent)]">
              {state.isSpeaking ? 'Ladder Flow is speaking...' : 'Your turn. Ladder Flow is listening...'}
            </span>
          </div>

          <Waveform mode={voiceMode} size="lg" className="mb-8" />

          <p className="max-w-xl text-center text-sm text-secondary">
            Ladder Flow is synthesizing your latest point and tailoring the next question in real time.
          </p>
        </main>

        <MobileTranscriptPanel
          messages={messages}
          isRecording={state.isListening && !isMuted}
        />

        <aside className="hidden w-[34%] max-w-[430px] min-w-[340px] border-l border-subtle bg-[var(--surface-frost)] backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
            <h3 className="label-kicker">Live Transcript</h3>
            <span className="mono-text text-[11px] text-secondary">{messages.length} lines</span>
          </div>
          {isResume && priorTranscript && (
            <div
              className="border-b border-subtle px-5 py-3 text-[11px] text-secondary"
              style={{ background: 'rgba(99,102,241,0.05)' }}
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#a5b4fc' }}>
                Previous conversation
              </p>
              <pre className="max-h-[28vh] overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {priorTranscript}
              </pre>
            </div>
          )}
          <TranscriptPanel messages={messages} isRecording={state.isListening && !isMuted} currentText="" />
        </aside>
      </div>

      <ControlDock
        isListening={!isMuted}
        isPaused={isMuted}
        isEnding={isEnding}
        isSaving={isSaving}
        onPause={toggleMute}
        onMicToggle={toggleMute}
        onEnd={handleEnd}
        onSaveExit={handleSaveAndExit}
      />
    </div>
  );
}

export default function InterviewPage() {
  return (
    <ConversationProvider>
      <InterviewPageInner />
    </ConversationProvider>
  );
}
