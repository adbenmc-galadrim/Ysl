import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type ContactRowProps = {
  name: ReactNode;
  initials: string;
  /** The department, or the e-mail when two people share a name. */
  detail?: ReactNode;
  /**
   * Right side: the string `'chevron'` (default) draws the chevron; any other
   * node, e.g. a check when picking someone, replaces it.
   */
  trailing?: ReactNode;
  /** Hairline under the row, inset to the text column. */
  separator?: boolean;
  onClick?: () => void;
  className?: string;
  /** Classes of the name column, where a mockup sets the lines differently. */
  textClassName?: string;
};

/**
 * A person of the directory: initials, name, department. The department is
 * what tells two "Martin" apart at the desk, so it is always shown.
 */
export function ContactRow({
  name,
  initials,
  detail,
  trailing = 'chevron',
  separator = false,
  onClick,
  className,
  textClassName,
}: ContactRowProps) {
  const Root = onClick ? 'button' : 'div';
  return (
    <div className={className}>
      <Root
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue',
          onClick && 'cursor-pointer',
        )}
      >
        <Avatar initials={initials} tone="fill" className="text-15" />
        <span
          className={cn('flex min-w-0 flex-1 flex-col pt-0.5', textClassName)}
        >
          <span className="truncate text-17 font-semibold">{name}</span>
          {detail && (
            <span className="mt-[3px] truncate text-14 text-muted">
              {detail}
            </span>
          )}
        </span>
        {trailing === 'chevron' ? (
          <Icon
            name="chevron"
            size={18}
            strokeWidth={2.2}
            className="mr-[3px] shrink-0 text-faint"
          />
        ) : (
          trailing && <span className="flex shrink-0">{trailing}</span>
        )}
      </Root>
      {separator && (
        <div className="mt-[11px] mb-2.5 ml-[52px] h-px bg-separator" />
      )}
    </div>
  );
}
