import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

/**
 * The inset grouped list of the iOS Settings app: white cards on the grey
 * page, a small grey header over each card and an optional footnote under
 * it. The settings, sync, data and team screens are all made of it.
 */

export function GroupedHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('px-4 text-13 font-medium text-muted', className)}>
      {children}
    </h2>
  );
}

/** The grey explanation under a card. Penpot sets it at 1.4, not 1.2. */
export function GroupedFootnote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('px-4 text-13 leading-[1.4] text-muted', className)}>
      {children}
    </p>
  );
}

/** The white card itself. Rows draw their own separators. */
export function GroupedList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('overflow-hidden rounded-control bg-white text-ink', className)}
    >
      {children}
    </div>
  );
}

export type GroupedSectionProps = {
  header?: ReactNode;
  /** A sentence, or a link such as "+ Inviter un agent". */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Header, card, footnote. Sections stack 20 px apart; a footnote keeps 6 px
 * under it, which is what puts the next header 26 px below it in the mockups.
 */
export function GroupedSection({
  header,
  footer,
  children,
  className,
}: GroupedSectionProps) {
  return (
    <section className={cn('flex flex-col', className)}>
      {header && <GroupedHeader className="mb-1.5">{header}</GroupedHeader>}
      <GroupedList>{children}</GroupedList>
      {footer &&
        (typeof footer === 'string' ? (
          <GroupedFootnote className="mt-3 mb-1.5">{footer}</GroupedFootnote>
        ) : (
          <div className="mt-3 mb-1.5 flex px-4">{footer}</div>
        ))}
    </section>
  );
}

/**
 * The 28 px coloured square of a settings row, white glyph inside. The hues
 * are the iOS Settings ones on purpose: an agent who knows the iPhone finds
 * "Synchronisation" by its green cloud before reading it.
 */
export const settingsIconVariants = tv({
  base: 'inline-flex size-7 shrink-0 items-center justify-center rounded-icon text-white',
  variants: {
    color: {
      ink: 'bg-ink',
      grey: 'bg-muted',
      blue: 'bg-blue',
      sky: 'bg-ios-blue',
      green: 'bg-ios-green',
      indigo: 'bg-ios-indigo',
      violet: 'bg-ios-indigo-light',
      purple: 'bg-ios-purple',
      orange: 'bg-ios-orange-light',
      red: 'bg-ios-red-light',
    },
  },
  defaultVariants: { color: 'grey' },
});

export type SettingsIconProps = VariantProps<typeof settingsIconVariants> & {
  icon: IconName;
  className?: string;
};

export function SettingsIcon({ icon, color, className }: SettingsIconProps) {
  return (
    <span className={settingsIconVariants({ color, class: className })}>
      <Icon name={icon} size={16} strokeWidth={2.2} />
    </span>
  );
}

export type GroupedRowProps = {
  /** A `SettingsIcon`, an `Avatar`… Omitted, the text starts at 16 px. */
  leading?: ReactNode;
  title: ReactNode;
  /** Second grey line; turns the title semibold, as for a person. */
  subtitle?: ReactNode;
  /** Grey text aligned right: the current value of the setting. */
  value?: ReactNode;
  /** The string `'chevron'` for a row that opens a screen, or a `Switch`. */
  accessory?: ReactNode;
  /** `lg` is the account row: 44 px avatar, 17 px name. */
  size?: 'md' | 'lg';
  onClick?: () => void;
  className?: string;
};

/**
 * One row of a grouped card. Every row but the first draws a hairline on top
 * of its text column, so the line starts under the text and runs to the
 * card's edge, exactly as in Settings.
 */
export function GroupedRow({
  leading,
  title,
  subtitle,
  value,
  accessory,
  size = 'md',
  onClick,
  className,
}: GroupedRowProps) {
  const chevron = accessory === 'chevron';
  const Root = onClick ? 'button' : 'div';
  // Penpot centres the text box 1.5 px high in a 52 px row; the 3 px margin
  // under single-line text reproduces it.
  const lift = subtitle ? (size === 'lg' ? 'mb-0.5' : '') : 'mb-[3px]';
  return (
    <Root
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group/row flex w-full items-center text-left outline-none focus-visible:bg-fill',
        onClick && 'cursor-pointer active:bg-fill',
        subtitle ? (size === 'lg' ? 'h-[72px]' : 'h-16') : 'h-[52px]',
        leading ? 'pl-3.5' : 'pl-4',
        className,
      )}
    >
      {leading && (
        <span className={cn('flex shrink-0', size === 'lg' ? 'mr-3' : 'mr-3.5')}>
          {leading}
        </span>
      )}
      <span
        className={cn(
          'relative flex h-full min-w-0 flex-1 items-center gap-[5px]',
          // The hairline is decoration over the row edge, so it is drawn
          // rather than laid out: a border would push the text down 1 px.
          'group-not-first/row:before:absolute group-not-first/row:before:inset-x-0 group-not-first/row:before:top-0 group-not-first/row:before:h-px group-not-first/row:before:bg-separator',
          chevron ? 'pr-3' : leading ? 'pr-3.5' : 'pr-4',
        )}
      >
        <span className={cn('flex min-w-0 flex-1 flex-col', lift)}>
          <span
            className={cn(
              'truncate',
              subtitle
                ? cn('font-semibold', size === 'lg' ? 'text-17' : 'text-16')
                : 'text-16',
            )}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className={cn(
                'mt-[3px] truncate text-muted',
                size === 'lg' ? 'text-14' : 'text-13',
              )}
            >
              {subtitle}
            </span>
          )}
        </span>
        {value !== undefined && (
          <span className={cn('shrink-0 text-16 text-muted', lift)}>
            {value}
          </span>
        )}
        {chevron ? (
          <Icon
            name="chevron"
            size={16}
            strokeWidth={2.2}
            className="shrink-0 text-faint"
          />
        ) : (
          accessory && <span className="ml-auto flex shrink-0">{accessory}</span>
        )}
      </span>
    </Root>
  );
}
