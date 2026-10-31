import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

/**
 * Text and fill share one hue per tone: an orange banner is about something
 * waiting, red about something late, blue about something to know, grey
 * about where a parcel stands.
 */
export const bannerVariants = tv({
  slots: {
    root: 'flex items-center rounded-card pr-3',
    icon: 'shrink-0',
    title: 'font-semibold',
    description: 'mt-1',
  },
  variants: {
    tone: {
      orange: { root: 'bg-orange-soft text-orange-strong' },
      red: { root: 'bg-red-soft text-red' },
      blue: { root: 'bg-blue-soft text-blue-strong' },
      /** Something done: a handover recorded, a check passed. */
      green: { root: 'bg-green-soft text-green' },
      grey: { root: 'bg-fill text-ink', description: 'text-muted' },
    },
    size: {
      /** 15 / 13: a notice inside a list or a sheet. */
      md: {
        root: 'gap-3 py-3.5 pl-3.5',
        title: 'text-15',
        description: 'text-13 leading-[18px]',
      },
      /** 16 / 14 with a 22 px icon: the state card of a record. */
      lg: {
        root: 'gap-[11px] pt-3 pb-3.5 pl-[13px]',
        title: 'text-16',
        description: 'text-14',
      },
    },
  },
  defaultVariants: { tone: 'grey', size: 'md' },
});

export type BannerProps = VariantProps<typeof bannerVariants> & {
  icon: IconName;
  /** Overrides the icon box, e.g. 18 on a desktop banner. */
  iconSize?: number;
  title: ReactNode;
  description?: ReactNode;
  /** Slot overrides, e.g. a tighter `root` where the design is fixed. */
  classNames?: Partial<Record<keyof typeof bannerVariants.slots, string>>;
  className?: string;
  /** Makes the whole card a button: the alert that opens the screen where one acts. */
  onClick?: () => void;
  /** A button at the right end of the card. Not with `onClick`: a button cannot hold a button. */
  action?: ReactNode;
};

/**
 * A tinted card with an icon, a bold line and an explanation: pending
 * changes while offline, a parcel waiting too long, a step to remember.
 * It informs; with `onClick` the whole card opens the screen where one
 * acts, so it only holds inline elements (a button cannot hold blocks).
 */
export function Banner({
  icon,
  iconSize,
  title,
  description,
  tone,
  size,
  classNames,
  className,
  onClick,
  action,
}: BannerProps) {
  const s = bannerVariants({ tone, size });
  const Root = onClick ? 'button' : 'div';
  return (
    <Root
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={s.root({
        class: [className, classNames?.root, onClick && 'w-full text-left'],
      })}
    >
      <Icon
        name={icon}
        size={iconSize ?? (size === 'lg' ? 22 : 20)}
        className={s.icon({ class: classNames?.icon })}
      />
      {/* Stretched so that, in a banner of fixed height, the text keeps to
          the top while the icon stays centred. */}
      <span className="flex min-w-0 flex-1 flex-col self-stretch">
        <span className={s.title({ class: ['block', classNames?.title] })}>
          {title}
        </span>
        {description && (
          <span
            className={s.description({
              class: ['block', classNames?.description],
            })}
          >
            {description}
          </span>
        )}
      </span>
      {action}
    </Root>
  );
}
