import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type NumberedStepsProps = {
  steps: ReactNode[];
  className?: string;
};

/**
 * A short procedure outside the app — in iOS Réglages — so each step is one
 * line with a big number to keep one's place after switching apps and back.
 */
export function NumberedSteps({ steps, className }: NumberedStepsProps) {
  return (
    <ol className={cn('flex flex-col gap-5', className)}>
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3.5 text-16">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-tile-sm bg-fill text-14 font-bold"
          >
            {i + 1}
          </span>
          {/* Top-aligned rather than centred: a centred 19 px line lands on a
              half pixel, and a two-line step should start at the number. */}
          <span className="mt-1.5 min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}
