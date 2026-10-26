import { useState, type ReactNode } from 'react';

import { cn } from '#lib/tv';

export type HistoryEntry = {
  id: string;
  /** What happened, as the desk says it: "Notifié", "Modifié : poids". */
  title: ReactNode;
  /** When, and by which iPhone or agent when it is known. */
  detail?: ReactNode;
  /** `red` for a change the server refused, `orange` for one not sent yet. */
  tone?: 'ink' | 'orange' | 'red';
};

export type EventHistoryProps = {
  title?: ReactNode;
  /** Newest first. */
  entries: HistoryEntry[];
  /** Entries shown before "Tout afficher". */
  limit?: number;
  moreLabel?: (count: number) => string;
  className?: string;
};

const dotTone = {
  ink: 'bg-ink',
  orange: 'bg-orange',
  red: 'bg-red',
} as const;

const titleTone = {
  ink: 'text-ink',
  orange: 'text-orange-strong',
  red: 'text-red',
} as const;

/**
 * What happened to a parcel, newest first: a dot per event on a thin rail,
 * the event in words, then when. The last few show; the rest are a tap away,
 * so a parcel received last week does not push its details off the screen.
 */
export function EventHistory({
  title = 'Historique',
  entries,
  limit = 4,
  moreLabel = (count) => `Tout afficher (${count})`,
  className,
}: EventHistoryProps) {
  const [open, setOpen] = useState(false);
  const shown = open ? entries : entries.slice(0, limit);
  const hidden = entries.length - shown.length;
  return (
    <section className={cn('flex flex-col', className)}>
      {title && <h2 className="text-20 font-bold text-ink">{title}</h2>}
      <ol className={cn('flex flex-col', title && 'mt-3')}>
        {shown.map((entry, i) => {
          const tone = entry.tone ?? 'ink';
          const last = i === shown.length - 1;
          return (
            <li key={entry.id} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="relative flex w-2.5 shrink-0 justify-center"
              >
                <span
                  className={cn(
                    'mt-[7px] size-2.5 rounded-full',
                    dotTone[tone],
                  )}
                />
                {!last && (
                  <span className="absolute top-[21px] bottom-0.5 w-0.5 rounded-full bg-separator" />
                )}
              </span>
              <span className={cn('flex min-w-0 flex-col', !last && 'pb-4')}>
                <span className={cn('text-15 font-medium', titleTone[tone])}>
                  {entry.title}
                </span>
                {entry.detail && (
                  <span className="mt-0.5 text-13 text-muted">
                    {entry.detail}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 cursor-pointer self-start text-15 font-semibold text-blue outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          {moreLabel(entries.length)}
        </button>
      )}
    </section>
  );
}
