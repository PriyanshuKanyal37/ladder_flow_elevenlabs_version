'use client';

import { cn } from '@/lib/utils';

interface ControlDockProps {
  isListening: boolean;
  isPaused?: boolean;
  isEnding?: boolean;
  isSaving?: boolean;
  onPause: () => void;
  onMicToggle: () => void;
  onEnd: () => void;
  onSaveExit?: () => void;
}

export function ControlDock({
  isListening,
  isPaused,
  isEnding = false,
  isSaving = false,
  onPause,
  onMicToggle,
  onEnd,
  onSaveExit,
}: ControlDockProps) {
  const busy = isEnding || isSaving;

  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 px-4">
      <div className="glass-panel flex items-center gap-4 rounded-full px-6 py-3">
        <button
          onClick={onPause}
          disabled={busy}
          className="group flex flex-col items-center gap-1 text-secondary transition-colors hover:text-primary disabled:opacity-40"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-subtle bg-[var(--surface-raised)] transition-colors group-hover:border-[var(--border-default)]">
            <span className="material-symbols-outlined text-[22px]">
              {isPaused ? 'play_circle' : 'pause'}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em]">
            {isPaused ? 'Resume' : 'Pause'}
          </span>
        </button>

        <button
          onClick={onMicToggle}
          disabled={busy}
          className={cn(
            'group relative flex flex-col items-center gap-1 transition-all disabled:opacity-40',
            isListening ? 'text-white' : 'text-secondary'
          )}
        >
          <div
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full border transition-all',
              isListening
                ? 'accent-gradient border-transparent shadow-[0_0_28px_var(--accent-glow)]'
                : 'bg-[var(--surface-raised)] border-subtle'
            )}
          >
            {isListening && (
              <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-[var(--accent)] opacity-20" />
            )}
            <span className="material-symbols-outlined relative text-[26px]">
              {isListening ? 'mic' : 'mic_off'}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
            {isListening ? 'Listening' : 'Muted'}
          </span>
        </button>

        {onSaveExit && (
          <button
            onClick={onSaveExit}
            disabled={busy}
            className="group flex flex-col items-center gap-1 text-secondary transition-colors hover:text-primary disabled:opacity-40"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-subtle bg-[var(--surface-raised)] transition-colors group-hover:border-[var(--border-default)]">
              {isSaving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-[22px]">bookmark</span>
              )}
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.08em]">
              {isSaving ? 'Saving' : 'Save & Exit'}
            </span>
          </button>
        )}

        <button
          onClick={onEnd}
          disabled={busy}
          className="group flex flex-col items-center gap-1 text-[var(--danger)] transition-colors disabled:opacity-40"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:rgba(239,68,68,0.5)] bg-[color:rgba(239,68,68,0.16)] transition-colors group-hover:bg-[var(--danger)] group-hover:text-white">
            {isEnding ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                call_end
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
            {isEnding ? 'Ending' : 'End'}
          </span>
        </button>
      </div>
    </div>
  );
}
