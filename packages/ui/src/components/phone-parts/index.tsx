import type { ChangeEvent, ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Banner, type BannerProps } from '#components/banner';
import type { CheckListItem } from '#components/check-list';
import { Field, FieldInput } from '#components/field';
import { GroupedList } from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import { ListRow, type ListRowProps } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** A list thumbnail of a parcel: kraft, a paper label, two lines, a code. */
export function KraftThumb() {
  return (
    <span aria-hidden="true" className="relative block size-10 shrink-0 rounded-[8px] bg-kraft">
      <span className="absolute top-[8.8px] left-[7.2px] h-5 w-[25.6px] rounded-[2px] bg-paper" />
      <span className="absolute top-3 left-[10.4px] h-[1.5px] w-4 bg-label-line" />
      <span className="absolute top-[16.8px] left-[10.4px] h-[1.5px] w-4 bg-label-line" />
      <span className="absolute top-[22px] left-[10.4px] h-1 w-[19.2px] bg-label-ink" />
    </span>
  );
}

/** The 24 px mark of a row: an ink disc once ticked, a ring until then. */
export function TickMark({
  checked = true,
  chevron = false,
}: {
  checked?: boolean;
  /** Puts the row's chevron in the ring: the row can still be opened. */
  chevron?: boolean;
}) {
  return checked ? (
    <span className="flex size-6 items-center justify-center rounded-full bg-ink text-on-ink">
      <Icon name="tick" size={14} />
    </span>
  ) : (
    <span className="relative block size-6 rounded-full border-[1.5px] border-border">
      {chevron && (
        <Icon name="chevron" size={16} className="absolute top-[2.5px] left-[6.5px] text-faint" />
      )}
    </span>
  );
}

/** The 16 px disclosure chevron of a phone row. */
export function RowChevron({ strokeWidth }: { strokeWidth?: number }) {
  return <Icon name="chevron" size={16} strokeWidth={strokeWidth} className="block text-faint" />;
}

/** A 40 px round tile holding one icon; ink when it is the chosen one. */
export function RoundTile({
  icon,
  selected = false,
}: {
  icon: IconName;
  selected?: boolean;
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full',
        selected ? 'bg-ink text-on-ink' : 'bg-fill text-ink',
      )}
    >
      <Icon name={icon} size={20} />
    </span>
  );
}

/** Someone in a phone list: initials on a round 40 px tile. */
export function PersonAvatar({
  initials,
  inverted = false,
  raised = false,
}: {
  initials: string;
  inverted?: boolean;
  /** Penpot set some initials 0.5 px above the centre of their tile. */
  raised?: boolean;
}) {
  return (
    <Avatar
      initials={initials}
      tone={inverted ? 'ink' : 'fill'}
      className={cn('rounded-full text-14', !inverted && 'bg-fill-2', raised && 'pb-px')}
    />
  );
}

export type PhoneRowProps = {
  leading: ReactNode;
  title: ReactNode;
  titleTone?: ListRowProps['titleTone'];
  lines: ReactNode[];
  /** Defaults to the usual pitch: 64 px, or 76 with two lines. */
  height?: number;
  /** A count or a state, just before the chevron. */
  before?: ReactNode;
  /** A 24 px mark in the place of the chevron. */
  mark?: ReactNode;
  chevron?: boolean;
  separator?: boolean;
};

/** A list row at a measured height, its tile and what ends it centred on it. */
export function PhoneRow({
  leading,
  title,
  titleTone,
  lines,
  height,
  before,
  mark,
  chevron = true,
  separator = false,
}: PhoneRowProps) {
  const tall = lines.length > 1;
  const pitch = height ?? (tall ? 76 : 64);
  const top = tall ? 12 : 11;
  const centred = (size: number, offset: number) => ({
    marginTop: (pitch - size) / 2 - top - offset,
  });
  return (
    <div className="relative shrink-0" style={{ height: pitch, paddingTop: top }}>
      <ListRow
        leading={
          <span className="flex" style={centred(40, 7)}>
            {leading}
          </span>
        }
        title={title}
        titleTone={titleTone}
        lines={lines.map((text) => ({
          text: <span className="relative -top-px">{text}</span>,
          nowrap: true,
        }))}
        trailing={
          mark ? (
            <span className="flex" style={centred(24, 11)}>
              {mark}
            </span>
          ) : before || chevron ? (
            <span className="flex items-center gap-2" style={centred(16, 11)}>
              {before && <span className="flex h-4 items-center">{before}</span>}
              {chevron && <RowChevron />}
            </span>
          ) : null
        }
      />
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

/** A 20 px section title and its count, one word space apart. */
export function PhoneSection({
  title,
  count,
  className,
}: {
  title: string;
  count: number;
  className?: string;
}) {
  return (
    <SectionHeader
      title={
        <>
          {title}
          <span className="ml-1.5 font-medium text-muted">{count}</span>
        </>
      }
      className={className}
    />
  );
}

export type PhoneBannerProps = Pick<BannerProps, 'tone' | 'icon'> & {
  title: ReactNode;
  description: ReactNode;
  /** 67 with one line of description, 83 or 98 with two. */
  height: 67 | 83 | 98;
  /** Grey by default on a grey banner; ink where the mockup draws it so. */
  descriptionClassName?: string;
  iconClassName?: string;
  className?: string;
};

const BANNER_HEIGHT = { 67: 'h-[67px]', 83: 'h-[83px]', 98: 'h-[98px]' } as const;

/** The 14 px radius banner of the phone screens, its icon hung from the top. */
export function PhoneBanner({
  tone = 'grey',
  icon,
  title,
  description,
  height,
  descriptionClassName,
  iconClassName,
  className,
}: PhoneBannerProps) {
  return (
    <Banner
      tone={tone}
      icon={icon}
      title={title}
      description={description}
      className={cn(
        'shrink-0 items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4',
        BANNER_HEIGHT[height],
        className,
      )}
      classNames={{
        icon: cn('mt-4', iconClassName),
        title: 'mt-[15px] text-15',
        description: cn('mt-0.5 text-13 leading-4', descriptionClassName),
      }}
    />
  );
}

/** A 48 px field of the phone forms, its label in small grey above it. */
export function PhoneField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  chevron = false,
  error = false,
  className,
  labelClassName,
  boxClassName,
}: {
  label: string;
  type?: 'text' | 'email' | 'password';
  value?: string;
  /** Makes it a controlled field; the mockups only draw a value. */
  onChange?: (value: string) => void;
  placeholder?: string;
  chevron?: boolean;
  error?: boolean;
  className?: string;
  labelClassName?: string;
  boxClassName?: string;
}) {
  return (
    <Field
      label={<span className={cn('relative -top-px', labelClassName)}>{label}</span>}
      className={className}
    >
      {(id) => (
        <FieldInput
          id={id}
          type={type}
          {...(onChange
            ? {
                value: value ?? '',
                onChange: (event: ChangeEvent<HTMLInputElement>) =>
                  onChange(event.target.value),
              }
            : { defaultValue: value })}
          placeholder={placeholder}
          className={cn(
            'relative h-12 gap-0 rounded-[12px] bg-surface pr-3.5 pl-3.5 font-normal',
            error &&
              'shadow-[0_0_0_0.75px_var(--color-red),inset_0_0_0_0.75px_var(--color-red)]',
            boxClassName,
          )}
          trailing={
            type === 'password' ? (
              <Icon name="eye" size={20} className="shrink-0 text-muted" />
            ) : chevron ? (
              <Icon name="chevron" size={20} className="shrink-0 rotate-90 text-muted" />
            ) : error ? (
              <Icon name="alert" size={20} className="absolute top-[13px] right-2 text-red" />
            ) : undefined
          }
        />
      )}
    </Field>
  );
}

/** Mutually exclusive words in a grey track; the measures come from the page. */
export function PhoneSegments<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  optionClassName,
}: {
  options: readonly (T | { value: T; label: string })[];
  value: T;
  onChange?: (value: T) => void;
  label: string;
  className?: string;
  optionClassName?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid auto-cols-fr grid-flow-col bg-fill-2 p-0.5', className)}
    >
      {options.map((option) => {
        const { value: id, label: word } =
          typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === value}
            onClick={() => onChange?.(id)}
            className={cn(
              'cursor-pointer font-semibold text-ink-2 aria-checked:bg-ink aria-checked:text-on-ink',
              optionClassName,
            )}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}

/** The pushed-screen bar of the phone: back or close, a title, what is left. */
export function PhoneNav({
  title,
  icon = 'back',
  trailing,
  onBack,
}: {
  title?: ReactNode;
  icon?: IconName;
  trailing?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="relative flex h-11 shrink-0 items-center justify-between">
      <IconButton
        icon={icon}
        label={icon === 'x' ? 'Fermer' : 'Retour'}
        size="lg"
        iconSize={22}
        className="-ml-0.5"
        onClick={onBack}
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

/** A figure on its own card; white by default, `className` recolours it. */
export function PhoneStat({
  label,
  value,
  tone,
  size = 28,
  className,
}: {
  label: string;
  value: string;
  tone?: 'orange' | 'red';
  size?: 26 | 28;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'h-20 rounded-[14px] bg-surface pl-4',
        size === 28 ? 'pt-[11px]' : 'pt-3.5',
        className,
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
      <p className="mt-1 text-13 text-muted">{label}</p>
    </div>
  );
}

/** The small grey heading over a card. */
export function PhoneGroupTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('relative -top-px px-4 text-13 font-medium text-muted', className)}>
      {children}
    </h2>
  );
}

/** A surface card of the phone settings. Its rows draw their own hairlines. */
export function PhoneGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <GroupedList className={cn('rounded-[14px]', className)}>
      {children}
    </GroupedList>
  );
}

/** A settings screen of the phone: the grey page and its centred title. */
export function PhoneSettings({
  title,
  trailing,
  tone = 'fill',
  bottom,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  tone?: 'fill' | 'white';
  bottom?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Screen tone={tone} bottom={bottom} bottomInset={0}>
      <NavBar title={title} trailing={trailing} />
      {children}
    </Screen>
  );
}

/** The round 44 px action at the right of the bar. */
export function PhoneBarButton({ icon, label }: { icon: IconName; label: string }) {
  return (
    <IconButton
      icon={icon}
      label={label}
      size="lg"
      iconSize={22}
      className="-mr-0.5"
    />
  );
}

export const PHONE_ICON_TONE = {
  ink: 'bg-ink text-on-ink',
  grey: 'bg-muted text-white',
  orange: 'bg-ios-orange-light text-white',
  red: 'bg-ios-red-light text-white',
  green: 'bg-green text-white',
  alert: 'bg-red text-white',
} as const;

export type PhoneSettingRowProps = {
  icon?: { name: IconName; tone: keyof typeof PHONE_ICON_TONE };
  /** A ready-made 28 px tile, in the place of `icon`. */
  leading?: ReactNode;
  title: ReactNode;
  /** Grey on the right, or a pill. */
  value?: ReactNode;
  chevron?: boolean;
  separator?: boolean;
  /** Penpot set a few of these labels 1 px higher than their neighbours. */
  raised?: boolean;
};

/** A 52 px row of a phone settings card, on the mockups' grid. */
export function PhoneSettingRow({
  icon,
  leading,
  title,
  value,
  chevron = true,
  separator = false,
  raised = false,
}: PhoneSettingRowProps) {
  const inset = Boolean(icon || leading);
  return (
    <div
      className={cn(
        'relative flex h-[52px] items-start pr-3.5',
        raised ? 'pt-4' : 'pt-[17px]',
        inset ? 'pl-14' : 'pl-4',
      )}
    >
      {icon && (
        <span
          className={cn(
            'absolute top-3 left-3.5 flex size-7 items-center justify-center rounded-[7px]',
            PHONE_ICON_TONE[icon.tone],
          )}
        >
          <Icon name={icon.name} size={16} strokeWidth={2.2} />
        </span>
      )}
      {leading && <span className="absolute top-3 left-3.5 flex">{leading}</span>}
      <span className="min-w-0 flex-1 truncate text-16">{title}</span>
      {typeof value === 'string' ? (
        <span className="shrink-0 text-16 text-muted">{value}</span>
      ) : (
        value
      )}
      {chevron && (
        <Icon
          name="chevron"
          size={16}
          strokeWidth={2.2}
          className="absolute top-[18px] right-3.5 text-faint"
        />
      )}
      {chevron && <span className="w-[22px] shrink-0" />}
      {separator && (
        <span
          className={cn(
            'absolute right-0 bottom-0 h-px bg-separator',
            inset ? 'left-14' : 'left-4',
          )}
        />
      )}
    </div>
  );
}

/** The big green disc that closes a handover. */
export function DoneDisc({ className = 'mt-[92px]' }: { className?: string }) {
  return (
    <span className={cn('flex size-[88px] shrink-0 items-center justify-center self-center rounded-full bg-green-solid text-white', className)}>
      <Icon name="tick" size={44} />
    </span>
  );
}

/** The bordered card of what the handover secured. */
export function ProofCard({
  items,
}: {
  items: CheckListItem[];
}) {
  return (
    <ul className="mt-[30px] flex shrink-0 flex-col gap-6 rounded-[16px] border border-separator pt-[17px] pr-[19px] pb-[30px] pl-[15px]">
      {items.map((item, i) => (
        <li key={i} className="flex h-[18px] items-center text-15">
          <Icon name={item.icon} size={18} className={cn('shrink-0', item.onClick ? 'text-blue' : 'text-ink-2')} />
          {item.onClick ? (
            <button type="button" onClick={item.onClick} className="-my-3 ml-3 min-w-0 flex-1 cursor-pointer py-3 text-left text-blue">
              {item.label}
            </button>
          ) : (
            <span className={cn('ml-3 min-w-0 flex-1', item.soon && 'text-muted')}>{item.label}</span>
          )}
          {item.soon && <span className="text-13 text-muted">{item.soon}</span>}
          {item.done && (
            <Icon name="tick" size={18} aria-label="Fait" className="relative top-px shrink-0 text-green" />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Four corners of two rounded bars, around the square the camera looks at. */
export function ScanCorners({
  x,
  y,
  size,
  color,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const bar = cn('absolute rounded-[2px]', color);
  return (
    <span aria-hidden="true" className="absolute" style={{ left: x, top: y, width: size, height: size }}>
      {[
        ['top-0 left-0', 'top-0 left-0'],
        ['top-0 right-0', 'top-0 right-0'],
        ['bottom-0 left-0', 'bottom-0 left-0'],
        ['bottom-0 right-0', 'bottom-0 right-0'],
      ].map(([h, v]) => (
        <span key={h}>
          <span className={cn(bar, 'h-1 w-8', h)} />
          <span className={cn(bar, 'h-8 w-1', v)} />
        </span>
      ))}
    </span>
  );
}
