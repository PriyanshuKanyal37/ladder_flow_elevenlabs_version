'use client';

import { cn } from '@/lib/utils';

type SignalType = 'opinion' | 'framework' | 'contrarian' | 'story' | 'proof' | 'takeaway';

interface SignalBadgeProps {
  type: SignalType;
  className?: string;
}

const signalConfig: Record<SignalType, { label: string; color: string; icon: string }> = {
  opinion: { label: 'Strong Opinion', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'record_voice_over' },
  framework: { label: 'Framework', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'account_tree' },
  contrarian: { label: 'Contrarian Take', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'swap_horiz' },
  story: { label: 'Real Story', color: 'bg-green-50 text-green-700 border-green-200', icon: 'auto_stories' },
  proof: { label: 'Proof Point', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'verified' },
  takeaway: { label: 'Takeaway', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'lightbulb' },
};

export function SignalBadge({ type, className }: SignalBadgeProps) {
  const config = signalConfig[type];

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border',
      config.color,
      className
    )}>
      <span className="material-symbols-outlined text-[14px]">{config.icon}</span>
      {config.label}
    </span>
  );
}

