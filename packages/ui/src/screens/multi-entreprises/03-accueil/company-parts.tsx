import type { ReactNode } from 'react';

import { IconButton } from '#components/icon-button';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

const LOGO_SIZE = {
  24: 'size-6 rounded-[5px] text-[10px]',
  40: 'size-10 rounded-[10px] text-16',
  'desk-40': 'size-10 rounded-[8px] text-16',
  56: 'size-14 rounded-[14px] text-22',
} as const;

/** A client's square: ink once it is active, grey while it is not. */
export function CompanyLogo({
  initials,
  muted = false,
  size,
  className,
}: {
  initials: string;
  muted?: boolean;
  size: keyof typeof LOGO_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center font-bold',
        LOGO_SIZE[size],
        muted ? 'bg-fill-2 text-ink' : 'bg-ink text-on-ink',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export type DeskStat = {
  label: string;
  value: string;
  tone?: 'orange' | 'red';
};

/** The bordered strip of key figures at the top of a desktop page. */
export function DeskStats({
  stats,
  className,
}: {
  stats: DeskStat[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'flex h-[76px] shrink-0 rounded-desk border border-separator py-[11px]',
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            'min-w-0 flex-1 pl-[15px]',
            i > 0 && 'border-l border-separator pl-4',
          )}
        >
          <dt className="text-12 font-medium text-muted">{stat.label}</dt>
          <dd
            className={cn(
              'mt-1.5 text-22 font-bold',
              stat.tone === 'orange' && 'text-orange',
              stat.tone === 'red' && 'text-red',
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A bordered block of a desktop page: its title, a hairline, its content. */
export function DeskPanel({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative flex shrink-0 flex-col rounded-desk border border-separator',
        className,
      )}
    >
      <header
        className={cn(
          'flex shrink-0 items-start justify-between border-b border-separator px-[15px] pt-3',
          subtitle ? 'h-[58px]' : 'h-11',
        )}
      >
        <div className="min-w-0">
          <h2 className="text-14 font-semibold">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-12 text-muted">{subtitle}</p>
          )}
        </div>
        {action && <span className="text-13 font-medium">{action}</span>}
      </header>
      {children}
    </section>
  );
}

/** A filter of the platform's pages: icon, grey name, bold value, chevron. */
export function DeskSelect({
  icon,
  label,
  value,
  className,
}: {
  icon: IconName;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 shrink-0 cursor-pointer items-center rounded-[6px] border border-border bg-surface pl-[9px] text-13 whitespace-nowrap outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
    >
      <Icon name={icon} size={14} className="text-muted" />
      <span className="-mt-0.5 ml-1.5 text-muted">{label}</span>
      <span className="-mt-0.5 ml-1.5 font-semibold">{value}</span>
      <Icon
        name="chevron"
        size={10}
        className="mr-[9px] ml-auto rotate-90 text-muted"
      />
    </button>
  );
}

/** A figure on its own white card, on the grey phone pages. */
export function PhoneStat({
  label,
  value,
  tone,
  size = 28,
}: DeskStat & { size?: 26 | 28 }) {
  return (
    <div
      className={cn(
        'h-20 rounded-[14px] bg-surface pl-4',
        size === 28 ? 'pt-[11px]' : 'pt-3.5',
      )}
    >
      <p
        className={cn(
          'font-bold',
          size === 28 ? 'text-28' : 'text-26',
          tone === 'orange' && 'text-orange',
          tone === 'red' && 'text-red',
        )}
      >
        {value}
      </p>
      <p className={'mt-1 text-13 text-muted'}>
        {label}
      </p>
    </div>
  );
}

/** The pushed-screen bar of the phone: back or close, a title, what is left. */
export function PhoneNav({
  title,
  icon = 'back',
  trailing,
}: {
  title?: ReactNode;
  icon?: IconName;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative flex h-11 shrink-0 items-center justify-between">
      <IconButton
        icon={icon}
        label={icon === 'x' ? 'Fermer' : 'Retour'}
        size="lg"
        iconSize={22}
        className="-ml-0.5"
      />
      {title && (
        <h1 className="absolute inset-x-[67px] text-center text-17 font-semibold">
          {title}
        </h1>
      )}
      {trailing}
    </div>
  );
}

/** A row of a phone list: a tile, a bold line and grey ones, at measured heights. */
export function PhoneListRow({
  height,
  leading,
  title,
  lines,
  trailing,
  chevron = true,
  separator = false,
}: {
  height: number;
  leading: ReactNode;
  title: ReactNode;
  lines: ReactNode[];
  trailing?: ReactNode;
  chevron?: boolean;
  separator?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ height }}>
      <span className="absolute top-1/2 left-0 flex -translate-y-1/2">
        {leading}
      </span>
      <div
        className={cn(
          'absolute right-0 left-[52px]',
          lines.length > 1 ? 'top-3' : 'top-[11px]',
        )}
      >
        <p className="text-17 font-semibold">{title}</p>
        {lines.map((line, i) => (
          <p key={i} className="mt-0.5 text-14 text-muted">
            {line}
          </p>
        ))}
      </div>
      {trailing && (
        <span className="absolute top-1/2 right-6 flex -translate-y-1/2">
          {trailing}
        </span>
      )}
      {chevron && (
        <Icon
          name="chevron"
          size={16}
          className="absolute top-1/2 right-0 -translate-y-1/2 text-faint"
        />
      )}
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

const PILL_TONE = {
  green: { root: 'bg-green-soft text-green', dot: 'bg-green' },
  blue: { root: 'bg-fill text-ink', dot: 'bg-blue' },
  orange: { root: 'bg-orange-soft text-orange-strong', dot: 'bg-orange' },
} as const;

/** A company's state on the phone: a dot and a word in a 24 px pill. */
export function CompanyPill({
  tone,
  label,
  className,
}: {
  tone: keyof typeof PILL_TONE;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-[9px] text-13 font-semibold whitespace-nowrap',
        PILL_TONE[tone].root,
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', PILL_TONE[tone].dot)} />
      <span className="-mt-px">{label}</span>
    </span>
  );
}

/** A row of a white group on the grey phone pages, on a 52 px pitch. */
export function PhoneGroupRow({
  leading,
  title,
  value,
  chevron = false,
  first = false,
}: {
  leading?: ReactNode;
  title: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex h-[52px] items-start pr-3.5 text-16',
        leading ? 'pl-3.5' : 'pl-4',
      )}
    >
      {!first && (
        <div
          className={cn(
            'absolute -top-px right-0 h-px bg-separator',
            leading ? 'left-[56px]' : 'left-4',
          )}
        />
      )}
      {leading && <span className="mt-3 mr-3.5 flex">{leading}</span>}
      <span
        className={cn('min-w-0 flex-1', first && !leading ? 'mt-4' : 'mt-[17px]')}
      >
        {title}
      </span>
      {value && (
        <span className={cn('text-muted', first && !leading ? 'mt-4' : 'mt-[17px]')}>
          {value}
        </span>
      )}
      {chevron && (
        <Icon name="chevron" size={16} className="mt-[18px] text-faint" />
      )}
    </div>
  );
}

/** The grey group of a phone page, with its small heading. */
export function PhoneGroupTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('relative -top-px pl-4 text-13 font-medium text-muted', className)}>
      {children}
    </h2>
  );
}
