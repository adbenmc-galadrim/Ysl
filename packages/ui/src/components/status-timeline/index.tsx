import { cn } from '#lib/tv';

export type TimelineStep = {
  label: string;
  /** `done` is behind, `current` is where the parcel stands, `todo` ahead. */
  state: 'done' | 'current' | 'todo';
};

export type StatusTimelineProps = {
  steps: TimelineStep[];
  className?: string;
};

/**
 * Reçu → Notifié → Remis, spread across the width. Three fixed steps rather
 * than a log: the question at the desk is "where is it at", not "what
 * happened when" — the history is in the details below.
 */
export function StatusTimeline({ steps, className }: StatusTimelineProps) {
  return (
    <ol className={cn('relative flex justify-between', className)}>
      {/* The rail runs from the first dot's centre to the last one's; the
          dots are white-filled so they sit on it. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-6 top-[11px] h-0.5 bg-separator"
      />
      {steps.map((step) => (
        <li
          key={step.label}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="relative flex w-12 flex-col items-center"
        >
          <span className="flex h-6 items-center justify-center">
            {step.state === 'current' ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-white ring-2 ring-black ring-inset">
                <span className="size-3 rounded-full bg-black" />
              </span>
            ) : (
              <span
                className={cn(
                  'size-3 rounded-full',
                  step.state === 'done'
                    ? 'bg-black'
                    : 'bg-white ring-2 ring-faint ring-inset',
                )}
              />
            )}
          </span>
          <span
            className={cn(
              'mt-1.5 text-13 whitespace-nowrap',
              step.state === 'todo'
                ? 'font-medium text-muted'
                : 'font-semibold text-ink',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
