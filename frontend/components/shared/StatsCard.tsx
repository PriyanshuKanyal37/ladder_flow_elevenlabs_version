'use client';

import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
  className?: string;
}

export function StatsCard({ label, value, icon, trend, className }: StatsCardProps) {
  return (
    <div className={cn(
      'glass-panel p-4 flex items-center gap-4',
      className
    )}>
      <div className="size-10 rounded-lg bg-[color:rgba(233,83,53,0.16)] flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-primary">{value}</p>
        <p className="text-xs text-secondary truncate">{label}</p>
      </div>
      {trend && (
        <span className="ml-auto text-xs font-medium text-[var(--success)] bg-[color:rgba(16,185,129,0.16)] px-2 py-0.5 rounded-full whitespace-nowrap">
          {trend}
        </span>
      )}
    </div>
  );
}

