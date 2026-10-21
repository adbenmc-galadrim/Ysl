import type { ReactNode } from 'react';

import { Icon } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

const lineVariants = tv({
  base: 'text-14',
  variants: {
    tone: {
      muted: 'text-muted',
      red: 'font-medium text-red',
      orange: 'font-medium text-orange',
      green: 'font-medium text-green',
      blue: 'font-medium text-blue',
    },
  },
  defaultVariants: { tone: 'muted' },
});

export type ListRowLine = {
  text: ReactNode;
  /**
   * Keeps the line on one line, running under a trailing button that only
   * sits beside the lines above it ("Réattribuer" over a reply).
   */
  nowrap?: boolean;
} & VariantProps<typeof lineVariants>;

export type ListRowProps = {
  /** The 40 px tile, a checkbox, a thumbnail — whatever leads the row. */
  leading?: ReactNode;
  title: ReactNode;
  titleTone?: 'ink' | 'red' | 'orange';
  /** Up to three grey lines; the last one usually carries the state. */
  lines?: ListRowLine[];
  /**
   * Right side: `'chevron'` (the default) draws the disclosure chevron;
   * anything else — a small button, a check, a time — is drawn as given.
   */
  trailing?: ReactNode;
  /** Hairline under the row, inset to the text column. */
  separator?: boolean;
  /**
   * Where the hairline starts, in px from the row's left edge: 52 clears the
   * tile; a row led by a checkbox and a tile needs 92.
   */
  separatorInset?: number;
  /**
   * `top` hangs the tile and the chevron from the first lines (home list).
   * `center` is the review and picker rows: each row is at least 61 px, the
   * text keeps 11 px above and 7 px below, and the leading and trailing
   * pieces centre on the whole row, whatever its number of lines.
   */
  align?: 'top' | 'center';
  onClick?: () => void;
  className?: string;
};

/**
 * The parcel row. It is the screen most of the day is spent on, so it shows
 * who, where from, and what is waiting — and nothing else.
 */
export function ListRow({
  leading,
  title,
  titleTone = 'ink',
  lines = [],
  trailing = 'chevron',
  separator = false,
  separatorInset,
  align = 'top',
  onClick,
  className,
}: ListRowProps) {
  const Root = onClick ? 'button' : 'div';
  const centered = align === 'center';
  return (
    <div className={className}>
      <Root
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'flex w-full gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue',
          centered ? 'min-h-[61px] items-center' : 'items-start',
        )}
      >
        {leading && (
          <span className={cn('flex shrink-0', !centered && 'mt-[7px]')}>
            {leading}
          </span>
        )}
        <span
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            centered && 'self-start pt-[11px] pb-[7px]',
          )}
        >
          <span
            className={cn(
              'truncate text-17 font-semibold',
              titleTone === 'red' && 'text-red',
              titleTone === 'orange' && 'text-orange',
            )}
          >
            {title}
          </span>
          {lines.map((line, i) => (
            <span
              key={i}
              className={cn(
                lineVariants({ tone: line.tone }),
                i ? 'mt-0.5' : 'mt-[3px]',
                line.nowrap && 'whitespace-nowrap',
              )}
            >
              {line.text}
            </span>
          ))}
        </span>
        {trailing === 'chevron' ? (
          <Icon
            name="chevron"
            size={18}
            strokeWidth={2.2}
            className={cn(
              'mr-[3px] shrink-0 text-faint',
              !centered && 'mt-[18px]',
            )}
          />
        ) : (
          trailing && (
            <span
              className={cn('flex shrink-0', !centered && 'mt-[11px] -ml-1')}
            >
              {trailing}
            </span>
          )
        )}
      </Root>
      {separator && (
        <div
          className={cn(
            'ml-[52px] h-px bg-separator',
            !centered && 'mt-[7px] mb-[11px]',
          )}
          style={
            separatorInset === undefined
              ? undefined
              : { marginLeft: separatorInset }
          }
        />
      )}
    </div>
  );
}

/**
 * A grey value on the right of a row instead of the chevron — "Non envoyé",
 * "En file" — centred on the tile like the chevron is.
 */
export function ListRowValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'mt-1.5 ml-1 text-15 whitespace-nowrap text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
