'use client';

import { useState, useEffect } from 'react';
import { useLoadingMessage } from '@/hooks/useLoadingMessage';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  messages?: string[];
  className?: string;
  showTimer?: boolean;
}

// Predefined heights to avoid hydration mismatch
const BAR_HEIGHTS = [32, 48, 24, 56, 40, 28, 52, 36];

export function LoadingState({ message, messages, className, showTimer = true }: LoadingStateProps) {
  const dynamicMessage = useLoadingMessage(messages);
  const displayMessage = message || dynamicMessage;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer to show elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={cn('flex min-h-[420px] flex-col items-center justify-center', className)}>
      {/* Waveform Animation */}
      <div className="mb-6 flex h-28 items-end gap-1.5">
        {BAR_HEIGHTS.map((height, i) => (
          <div
            key={i}
            className="waveform-bar animate-pulse bg-gradient-to-t from-[var(--accent-dim)] to-[var(--accent)]"
            style={{
              height: `${height * 1.4}px`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
      <p className="text-base font-medium text-primary animate-pulse">
        {displayMessage}
      </p>
      {showTimer && (
        <p className="mt-3 text-sm text-secondary mono-text">
          Elapsed: {formatTime(elapsedSeconds)}
        </p>
      )}
    </div>
  );
}

