'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
}

const tourSteps: TourStep[] = [
  {
    title: 'Command Center',
    subtitle: 'Dashboard Intelligence',
    description:
      'Track every session, memory signal, and publishing output from one glass workspace.',
    icon: 'dashboard',
    color: 'from-[#E95335] to-[#C94020]',
  },
  {
    title: 'Voice Interview Flow',
    subtitle: 'Research to Recording',
    description:
      'Start with keywords, get curated angles, then run a focused interview with your AI host.',
    icon: 'mic',
    color: 'from-[#F97316] to-[#EF826C]',
  },
  {
    title: 'Digital Brain',
    subtitle: 'Compounding Memory',
    description:
      'Each completed interview adds frameworks, proof points, and stories into your personal knowledge base.',
    icon: 'psychology',
    color: 'from-[#0D9488] to-[#06B6D4]',
  },
  {
    title: 'Output Engine',
    subtitle: 'Publish Faster',
    description:
      'Generate LinkedIn posts, threads, and newsletters instantly, then edit and export in one place.',
    icon: 'edit_note',
    color: 'from-[#F59E0B] to-[#EF4444]',
  },
];

interface ProductTourProps {
  onComplete: () => void;
}

export function ProductTour({ onComplete }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tourSteps[currentStep];
  const isLast = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <button
        onClick={onComplete}
        className="absolute right-6 top-6 rounded-full border border-subtle px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-secondary hover:text-primary"
      >
        Skip Tour
      </button>

      <div className="glass-panel w-full max-w-2xl p-10 text-center">
        <div className="mx-auto mb-8 w-full max-w-[320px] rounded-3xl border border-subtle p-8">
          <div
            className={cn(
              'mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)]',
              step.color
            )}
          >
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {step.icon}
            </span>
          </div>

          <p className="label-kicker mb-2">{step.subtitle}</p>
          <h2 className="mb-3 text-3xl font-bold text-primary">{step.title}</h2>
          <p className="text-sm leading-relaxed text-secondary">{step.description}</p>
        </div>

        <div className="mb-7 flex items-center justify-center gap-2">
          {tourSteps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={cn(
                'rounded-full transition-all',
                i === currentStep
                  ? 'h-2 w-8 bg-[var(--accent)]'
                  : 'h-2 w-2 bg-[var(--border-default)] hover:bg-[var(--text-dim)]'
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          {currentStep > 0 && (
            <Button variant="ghost" size="md" onClick={() => setCurrentStep(currentStep - 1)}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </Button>
          )}
          <Button
            size="md"
            onClick={() => {
              if (isLast) {
                onComplete();
              } else {
                setCurrentStep(currentStep + 1);
              }
            }}
          >
            {isLast ? 'Enter Dashboard' : 'Next'}
            {!isLast && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}

