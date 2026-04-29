import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ 
  message = 'Something went wrong', 
  description,
  onRetry,
  className 
}: ErrorStateProps) {
  return (
    <div className={cn('flex min-h-[420px] flex-col items-center justify-center', className)}>
      <div className="mb-4 text-[var(--danger)]">
        <span className="material-symbols-outlined text-5xl">error</span>
      </div>
      <p className="mb-2 text-lg font-semibold text-primary">
        {message}
      </p>
      {description && (
        <p className="mb-6 max-w-md text-center text-sm text-secondary">
          {description}
        </p>
      )}
      {onRetry && (
        <Button onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

