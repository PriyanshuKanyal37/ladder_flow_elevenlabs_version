'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function HeroCard() {
  return (
    <section className="glass-panel relative overflow-hidden p-8 md:p-10">
      <div className="absolute right-[-48px] top-[-56px] rotate-[15deg] opacity-10 pointer-events-none">
        <span
          className="material-symbols-outlined text-[260px] text-[var(--text-primary)]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          mic
        </span>
      </div>

      <div className="relative z-10 max-w-xl">
        <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
          Ready to record your
          <br />
          <span className="text-[var(--accent)]">next session?</span>
        </h2>
        <p className="max-w-lg text-base text-secondary md:text-lg">
          Turn 15 minutes of voice into a week of high-authority content with
          Ladder Flow&apos;s specialized AI workflow.
        </p>

        <Link href="/discover" className="mt-8 inline-flex">
          <Button size="lg" className="rounded-full px-8">
            <span className="material-symbols-outlined text-[18px]">mic</span>
            Start Session
          </Button>
        </Link>
      </div>
    </section>
  );
}


