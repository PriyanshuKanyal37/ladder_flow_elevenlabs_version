interface ProgressPillProps {
  current: number;
  total: number;
}

export function ProgressPill({ current, total }: ProgressPillProps) {
  return (
    <div className="glass-pill flex items-center gap-2 px-4 py-1.5">
      <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
        Question
      </span>
      <span className="text-sm font-bold text-primary">
        {current}{' '}
        <span className="text-secondary font-normal">of</span>{' '}
        {total}
      </span>
    </div>
  );
}

