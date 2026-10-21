import type { ComponentProps, ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { CheckCircle } from '#components/checkbox';
import { cn } from '#lib/tv';

export type PersonOptionProps = Omit<ComponentProps<'button'>, 'children'> & {
  initials: string;
  name: ReactNode;
  /** Where to find them: "Presse, 3e étage". */
  detail?: ReactNode;
  selected?: boolean;
};

/**
 * One candidate for an uncertain recipient. The scanner proposes the closest
 * names; the agent confirms one against the label above. Selected, the card
 * turns white with a black edge and its initials go black, like every choice
 * in the app.
 */
export function PersonOption({
  initials,
  name,
  detail,
  selected = false,
  className,
  type = 'button',
  ...props
}: PersonOptionProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={selected}
      className={cn(
        'flex h-16 w-full cursor-pointer items-center gap-3 rounded-card pr-3 pl-3.5 text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        selected ? 'bg-white ring-2 ring-black ring-inset' : 'bg-fill',
        className,
      )}
      {...props}
    >
      <Avatar initials={initials} tone={selected ? 'ink' : 'white'} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-17 font-semibold text-ink">{name}</span>
        {detail && (
          <span className="mt-0.5 truncate text-14 text-muted">{detail}</span>
        )}
      </span>
      <CheckCircle checked={selected} />
    </button>
  );
}

export function PersonOptionGroup({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Accessible name of the radio group: the question it answers. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex flex-col gap-2.5', className)}
    >
      {children}
    </div>
  );
}
