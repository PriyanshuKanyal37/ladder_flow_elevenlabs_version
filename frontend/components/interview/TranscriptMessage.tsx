'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { TranscriptMessage as TranscriptMessageType } from '@/lib/types/transcript';

interface TranscriptMessageProps {
  message: TranscriptMessageType;
  isCurrentQuestion?: boolean;
  isRecording?: boolean;
  isFaded?: boolean;
}

export const TranscriptMessage = memo(function TranscriptMessage({ 
  message, 
  isCurrentQuestion,
  isRecording,
  isFaded 
}: TranscriptMessageProps) {
  const isAI = message.role === 'assistant';

  if (isAI) {
    return (
      <div
        className={cn(
          'rounded-xl border border-subtle bg-[var(--surface-raised)] p-4',
          isFaded && 'opacity-40',
          isCurrentQuestion && 'border-l-4 border-l-[var(--accent)]'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[var(--accent)] text-[18px]">
            smart_toy
          </span>
          <p className="text-sm font-semibold text-[var(--accent)]">
            AI Interviewer
            {isCurrentQuestion && (
              <span className="font-normal text-secondary"> - Current Question</span>
            )}
          </p>
        </div>
        <p className="mono-text text-[13px] leading-relaxed text-primary">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-subtle bg-[var(--surface)] p-4',
        isFaded && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-secondary text-[18px]">
          person
        </span>
        <span className="text-sm font-medium text-secondary">You</span>
        {isRecording && <StatusBadge variant="recording" />}
      </div>
      <p className="mono-text text-[13px] leading-relaxed text-primary">
        {message.content}
        {isRecording && (
          <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-[var(--accent)]" />
        )}
      </p>
    </div>
  );
});

TranscriptMessage.displayName = 'TranscriptMessage';

