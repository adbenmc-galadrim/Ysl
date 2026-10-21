import type { ComponentProps, ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

/**
 * The dark cards laid over the camera picture. They are opaque, not
 * frosted: the agent reads them at arm's length while the picture moves, and
 * a blur would let the label show through the text.
 */
export function CameraPanel({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-card bg-night text-white', className)}
      {...props}
    />
  );
}

export type LastScanPanelProps = {
  /** Small grey caption: "Dernier ajouté". */
  caption?: ReactNode;
  /** Who the parcel is for. */
  title: ReactNode;
  /** Grey, after the name: carrier and last digits. */
  meta?: ReactNode;
  /** The button behind the divider, e.g. "Annuler" with the undo arrow. */
  action?: { icon: IconName; label: string; onClick?: () => void };
  /**
   * Anything else at the right end, in place of `action`: the piece dots of
   * a multi-piece parcel, which is not undone but completed.
   */
  trailing?: ReactNode;
  className?: string;
};

/**
 * The parcel the batch just took, with the way to take it back. A scan in a
 * burst gives no time to check, so the last one stays on screen until the
 * next one replaces it.
 */
export function LastScanPanel({
  caption = 'Dernier ajouté',
  title,
  meta,
  action,
  trailing,
  className,
}: LastScanPanelProps) {
  return (
    <CameraPanel
      role="status"
      className={cn('flex h-16 shrink-0 items-center pl-4', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col self-start pt-2.5">
        <span className="text-12 text-night-muted">{caption}</span>
        <span className="mt-1 flex min-w-0 items-end gap-[13px]">
          <span className="truncate text-16 font-semibold">{title}</span>
          {meta && (
            <span className="shrink-0 text-14 text-night-muted">{meta}</span>
          )}
        </span>
      </div>
      {trailing && (
        // Penpot sets the dots 2 px above the card's middle.
        <span className="mb-1 flex shrink-0 pr-[15px] pl-3">{trailing}</span>
      )}
      {action && !trailing && (
        <>
          <span aria-hidden="true" className="h-10 w-px shrink-0 bg-night-3" />
          <button
            type="button"
            onClick={action.onClick}
            className="flex h-full shrink-0 cursor-pointer items-center gap-1.5 pr-2 pl-2.5 text-15 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ios-blue"
          >
            <Icon name={action.icon} size={18} />
            {action.label}
          </button>
        </>
      )}
    </CameraPanel>
  );
}

/**
 * Per tone, the spacing Penpot draws: the yellow banner hangs under the top
 * bar with room for the frame's corner below it; the dark card sits on the
 * shutter row.
 */
export const cameraNoticeVariants = tv({
  slots: {
    root: 'shrink-0 rounded-card px-4',
    header: 'flex items-start',
    icon: 'shrink-0',
    title: 'text-16 font-semibold',
    message: '',
    actions: 'grid grid-cols-2 gap-2.5',
  },
  variants: {
    tone: {
      /** Dark card, white text: a choice to make, nothing wrong. */
      neutral: {
        root: 'bg-night pt-4 pb-3.5 text-white',
        message: 'text-15',
        actions: 'mt-3.5 *:h-9',
      },
      /** Yellow on olive: a duplicate, a second look. */
      warning: {
        root: 'bg-ios-yellow-deep pt-3 pb-[25px]',
        header: 'gap-2.5',
        icon: '-ml-0.5 mt-1 text-ios-yellow',
        title: 'text-ios-yellow',
        message: 'mt-[5px] text-14 text-ios-yellow-soft',
        actions: 'mt-3 *:h-9',
      },
      /** Dark card, red icon: nothing could be read. */
      danger: {
        root: 'bg-night pt-4 pb-3 text-white',
        header: 'gap-[11px]',
        icon: '-ml-px text-ios-red',
        message: 'mt-1 text-14 text-night-muted',
        actions: 'mt-2 *:h-[34px]',
      },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type CameraNoticeProps = VariantProps<typeof cameraNoticeVariants> & {
  icon?: IconName;
  title?: ReactNode;
  /** The explanation, or the whole message when there is no title. */
  children?: ReactNode;
  /** Up to two `CameraNoticeButton`s, side by side. */
  actions?: ReactNode;
  className?: string;
};

/**
 * What the scanner has to say about the last reading — a duplicate, an
 * unreadable label — and what can be done about it. It replaces the reading
 * panel rather than stacking on it, so the camera stays visible.
 */
export function CameraNotice({
  tone,
  icon,
  title,
  children,
  actions,
  className,
}: CameraNoticeProps) {
  const s = cameraNoticeVariants({ tone });
  return (
    <div role="alert" className={s.root({ class: className })}>
      <div className={s.header()}>
        {icon && <Icon name={icon} size={20} className={s.icon()} />}
        <div className="flex min-w-0 flex-1 flex-col">
          {title && <p className={s.title()}>{title}</p>}
          {children && <p className={s.message()}>{children}</p>}
        </div>
      </div>
      {actions && <div className={s.actions()}>{actions}</div>}
    </div>
  );
}

/**
 * A grey button inside a `CameraNotice`; the notice sets its height. The
 * label rides 1.5 px above the middle, as Penpot draws it.
 */
export function CameraNoticeButton({
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'min-w-0 cursor-pointer truncate rounded-chip bg-night-2 px-2 pb-[3px] text-14 font-semibold text-white outline-none',
        'focus-visible:ring-2 focus-visible:ring-ios-blue active:brightness-125',
        className,
      )}
      {...props}
    />
  );
}
