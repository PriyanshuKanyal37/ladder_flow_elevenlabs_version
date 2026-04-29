import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  variant: 'live' | 'recording' | 'ready' | 'generating' | 'error' | 'paused' | 'processing';
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const variants = {
    live: {
      container: 'flex items-center gap-2',
      content: (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
          </span>
          <span className="text-xs font-medium text-secondary">
            {label || 'Live Connection'}
          </span>
        </>
      ),
    },
    recording: {
      container:
        'px-2.5 py-1 rounded-full bg-[color:rgba(239,68,68,0.16)] text-[var(--danger)] text-[10px] font-bold uppercase tracking-wide',
      content: label || 'Recording',
    },
    ready: {
      container:
        'px-2.5 py-1 rounded-full bg-[color:rgba(16,185,129,0.16)] text-[var(--success)] text-xs font-semibold',
      content: label || 'Ready',
    },
    generating: {
      container:
        'flex items-center gap-1.5 rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-secondary',
      content: (
        <>
          <span className="block size-2 rounded-full bg-[var(--accent)] animate-pulse" />
          {label || 'Generating...'}
        </>
      ),
    },
    error: {
      container:
        'px-2.5 py-1 rounded-full bg-[color:rgba(239,68,68,0.16)] text-[var(--danger)] text-xs font-semibold',
      content: label || 'Error',
    },
    paused: {
      container: 'flex items-center gap-2',
      content: (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--warning)]" />
          </span>
          <span className="text-xs font-medium text-secondary">
            {label || 'Paused'}
          </span>
        </>
      ),
    },
    processing: {
      container: 'flex items-center gap-2',
      content: (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
          </span>
          <span className="text-xs font-medium text-secondary">
            {label || 'Processing'}
          </span>
        </>
      ),
    },
  };

  return (
    <span className={cn(variants[variant].container, className)}>
      {variants[variant].content}
    </span>
  );
}

