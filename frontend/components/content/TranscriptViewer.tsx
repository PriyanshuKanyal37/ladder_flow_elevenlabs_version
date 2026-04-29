'use client';

import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';

interface TranscriptSegment {
  speaker: string;
  content: string;
  startTime: number;
  endTime: number;
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  activeSegment?: number;
  onSegmentClick?: (time: number) => void;
}

export function TranscriptViewer({ segments, activeSegment, onSegmentClick }: TranscriptViewerProps) {
  return (
    <div className="custom-scrollbar h-full space-y-3 overflow-y-auto p-3 sm:p-4">
      {segments.map((segment, index) => (
        <div
          key={index}
          onClick={() => onSegmentClick?.(segment.startTime)}
          className={cn(
            'cursor-pointer rounded-lg border border-subtle bg-[var(--surface-raised)] p-3 transition-all',
            activeSegment === index
              ? 'border-l-4 border-l-[var(--accent)]'
              : 'hover:border-[var(--border-default)]'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-xs font-semibold',
              segment.speaker === 'AI Host'
                ? 'text-[var(--accent)]'
                : 'text-secondary'
            )}>
              {segment.speaker}
            </span>
            <span className="mono-text text-xs text-secondary">
              {formatDuration(segment.startTime)}
            </span>
          </div>
          <p className="mono-text text-[12px] leading-relaxed text-primary sm:text-[13px]">
            {segment.content}
          </p>
        </div>
      ))}
    </div>
  );
}

