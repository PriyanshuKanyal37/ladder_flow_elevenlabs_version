'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Waveform } from '@/components/interview/Waveform';
import { TranscriptPanel } from '@/components/interview/TranscriptPanel';
import { ControlDock } from '@/components/interview/ControlDock';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { formatDuration } from '@/lib/utils';

export default function VoiceAgentUiPage() {
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleEnd = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const statusVariant: 'live' | 'paused' = isMuted ? 'paused' : 'live';
  const statusLabel = isMuted ? 'Muted' : 'UI Preview';

  return (
    <div className="relative min-h-screen overflow-hidden bg-app text-primary">
      <div className="mesh-background" />

      <header className="fixed left-0 top-0 z-20 flex h-16 w-full items-center justify-between border-b border-subtle bg-[var(--surface-frost)] px-4 shadow-[0_12px_34px_-30px_var(--glass-shadow)] backdrop-blur-xl md:px-8">
        <p className="text-sm font-semibold">Ladder Flow Preview</p>
        <div className="flex items-center gap-3">
          <StatusBadge variant={statusVariant} label={statusLabel} />
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="mono-text text-sm text-secondary">{formatDuration(duration)}</span>
        </div>
      </header>

      <div className="flex min-h-screen pt-16">
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 md:px-10">
          <h2 className="mb-8 text-center text-2xl font-bold">Voice Agent UI Preview</h2>
          <Waveform mode={isMuted ? 'idle' : 'listening'} size="lg" className="mb-6" />
          <p className="text-sm text-secondary">UI-only mode. No live backend call is used here.</p>
        </main>

        <aside className="hidden w-[34%] max-w-[430px] min-w-[340px] border-l border-subtle bg-[var(--surface-frost)] backdrop-blur-xl lg:flex lg:flex-col">
          <div className="border-b border-subtle px-5 py-4">
            <h3 className="label-kicker">Live Transcript</h3>
          </div>
          <TranscriptPanel
            messages={[]}
            isRecording={!isMuted}
            currentText={isMuted ? '' : 'Previewing microphone state...'}
          />
        </aside>
      </div>

      <ControlDock
        isListening={!isMuted}
        isPaused={isMuted}
        onPause={handlePauseToggle}
        onMicToggle={handlePauseToggle}
        onEnd={handleEnd}
      />
    </div>
  );
}

