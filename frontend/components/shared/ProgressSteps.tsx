import { cn } from '@/lib/utils';

interface StepItem {
  id: number;
  label: string;
}

interface ProgressStepsProps {
  currentStep: number;
  className?: string;
  steps?: StepItem[];
}

const DEFAULT_STEPS: StepItem[] = [
  { id: 1, label: 'Keywords' },
  { id: 2, label: 'Research' },
  { id: 3, label: 'Angles' },
  { id: 4, label: 'Outline' },
  { id: 5, label: 'Interview' },
];

export function ProgressSteps({ currentStep, className, steps = DEFAULT_STEPS }: ProgressStepsProps) {
  return (
    <nav className={cn('w-full overflow-x-auto pb-2', className)} aria-label="Progress steps">
      <div className="mx-auto flex min-w-max items-center justify-center px-2">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold transition-all',
                    isActive &&
                      'bg-[var(--accent)] text-white shadow-[0_0_14px_var(--accent-glow)]',
                    isCompleted &&
                      'bg-[color:rgba(16,185,129,0.16)] text-[var(--success)] border border-[color:rgba(16,185,129,0.36)]',
                    !isActive &&
                      !isCompleted &&
                      'bg-[var(--surface-raised)] text-secondary border border-subtle'
                  )}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.08em]',
                    isActive ? 'text-[var(--accent)]' : 'text-secondary'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="mx-3 h-px w-8 bg-[var(--border-default)] md:w-14" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

