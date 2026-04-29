import { cn } from '@/lib/utils';

interface IconWrapperProps {
  icon: string;
  color?: 'indigo' | 'teal' | 'green' | 'orange' | 'pink' | 'purple' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  filled?: boolean;
  className?: string;
}

const colorStyles = {
  indigo: 'bg-[color:rgba(99,102,241,0.16)] text-indigo-300',
  teal: 'bg-[color:rgba(20,184,166,0.16)] text-teal-300',
  green: 'bg-[color:rgba(16,185,129,0.16)] text-emerald-300',
  orange: 'bg-[color:rgba(249,115,22,0.16)] text-orange-300',
  pink: 'bg-[color:rgba(219,39,119,0.16)] text-pink-300',
  purple: 'bg-[color:rgba(168,85,247,0.16)] text-violet-300',
  primary: 'bg-[color:rgba(233,83,53,0.16)] text-[var(--accent)]',
};

const sizeStyles = {
  sm: 'size-8 rounded-md',
  md: 'size-10 rounded-lg',
  lg: 'size-12 rounded-xl',
};

export function IconWrapper({ icon, color = 'primary', size = 'md', filled, className }: IconWrapperProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        colorStyles[color],
        sizeStyles[size],
        className
      )}
    >
      <span className={cn('material-symbols-outlined', filled && 'filled')}>
        {icon}
      </span>
    </div>
  );
}

