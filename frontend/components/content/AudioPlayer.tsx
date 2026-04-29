'use client';

import { useState } from 'react';
import { Waveform } from '@/components/interview/Waveform';
import { formatDuration } from '@/lib/utils';

interface AudioPlayerProps {
  duration: number;
  onTimestampClick?: (time: number) => void;
}

export function AudioPlayer({ duration, onTimestampClick }: AudioPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSkip = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    setCurrentTime(newTime);
    onTimestampClick?.(newTime);
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    setPlaybackSpeed(speeds[(currentIndex + 1) % speeds.length]);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="sticky bottom-0 border-t border-subtle bg-[var(--surface)] p-4">
      <div className="mb-3">
        <Waveform size="sm" isActive={isPlaying} barCount={32} />
      </div>

      <div className="relative mb-3 h-1 cursor-pointer rounded-full bg-[var(--border-default)]">
        <div className="absolute h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
        <div
          className="absolute -top-1 h-3 w-3 rounded-full bg-[var(--accent)] shadow"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => handleSkip(-10)} className="p-2 text-secondary transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-[24px]">replay_10</span>
          </button>

          <button
            onClick={handlePlayPause}
            className="accent-gradient flex size-12 items-center justify-center rounded-full text-white shadow-[0_8px_22px_var(--accent-glow)]"
          >
            <span className="material-symbols-outlined text-[28px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>

          <button onClick={() => handleSkip(10)} className="p-2 text-secondary transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-[24px]">forward_10</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggleSpeed} className="rounded bg-[var(--surface-raised)] px-2 py-1 text-xs font-semibold text-secondary hover:text-primary">
            {playbackSpeed}x
          </button>

          <span className="mono-text text-sm text-secondary">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

