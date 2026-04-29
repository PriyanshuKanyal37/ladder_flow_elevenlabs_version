import { cn } from '@/lib/utils';

interface AmbientGlowProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AmbientGlow({ className, size = 'lg' }: AmbientGlowProps) {
  const sizes = {
    sm: 'w-64 h-64',
    md: 'w-[500px] h-[500px]',
    lg: 'w-[820px] h-[820px]',
  };

  return (
    <div
      className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'bg-[var(--orb-primary)]',
        'rounded-full blur-[100px] -z-10 pointer-events-none',
        sizes[size],
        className
      )}
    />
  );
}

