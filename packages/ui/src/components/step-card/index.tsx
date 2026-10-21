import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type StepCardProps = {
  /** The icon of the control to look for, drawn as on the device. */
  icon: IconName;
  /** The instruction, numbered by the caller: "1. Touchez Partager". */
  title: ReactNode;
  /** Where to find it: "en bas de Safari". */
  hint?: ReactNode;
  className?: string;
};

/**
 * One step of a set-up guide, as a grey card with the icon the user has to
 * find on screen. Cards rather than a list because the steps are read one at
 * a time, eyes going back and forth between the guide and Safari.
 */
export function StepCard({ icon, title, hint, className }: StepCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3.5 rounded-card bg-fill py-4 pr-3 pl-4',
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-white text-black">
        <Icon name={icon} size={22} />
      </span>
      {/* The text block is drawn 1 px above the tile's centre line. */}
      <span className="-mt-px flex min-w-0 flex-col gap-1">
        <span className="text-16 font-semibold">{title}</span>
        {hint && <span className="text-14 text-muted">{hint}</span>}
      </span>
    </div>
  );
}
