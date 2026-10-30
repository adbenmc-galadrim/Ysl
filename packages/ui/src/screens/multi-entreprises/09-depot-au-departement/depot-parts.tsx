import type { ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import {
  GroupedList,
  SettingsIcon,
  type SettingsIconProps,
} from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import { ListRow } from '#components/list-row';
import { QrCode } from '#components/qr-code';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** The 40 px kraft thumbnail of a parcel, with its paper label. */
export function DepotThumb() {
  return (
    <span aria-hidden="true" className="relative block size-10 shrink-0 rounded-[8px] bg-kraft">
      <span className="absolute top-[8.8px] left-[7.2px] h-5 w-[25.6px] rounded-[2px] bg-paper" />
      <span className="absolute top-3 left-[10.4px] h-[1.5px] w-4 bg-label-line" />
      <span className="absolute top-[16.8px] left-[10.4px] h-[1.5px] w-4 bg-label-line" />
      <span className="absolute top-[22px] left-[10.4px] h-1 w-[19.2px] bg-label-ink" />
    </span>
  );
}

/** The 40 px round tile of the row that says nobody knows which parcel it is. */
export function DepotInfoTile() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill">
      <Icon name="info" size={20} />
    </span>
  );
}

/** The 24 px mark of a row: a ticked disc, or a ring holding the chevron. */
export function DepotMark({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="flex size-6 items-center justify-center rounded-full bg-ink text-on-ink">
      <Icon name="tick" size={14} />
    </span>
  ) : (
    <span className="relative block size-6 rounded-full border-[1.5px] border-border">
      <Icon name="chevron" size={16} className="absolute top-[2.5px] left-[6.5px] text-faint" />
    </span>
  );
}

export type DepotRowProps = {
  title: ReactNode;
  detail: ReactNode;
  leading?: ReactNode;
  /** The ticked or open mark; left out, the row has none. */
  checked?: boolean;
  /** The pitch of the list: 60 when it is scanned, 64 otherwise. */
  height?: 60 | 64;
  separator?: boolean;
};

/** One parcel of a deposit on the phone. */
export function DepotRow({
  title,
  detail,
  leading = <DepotThumb />,
  checked,
  height = 64,
  separator = false,
}: DepotRowProps) {
  const tall = height === 64;
  return (
    <div className={cn('relative pt-[11px]', tall ? 'h-16' : 'h-[60px]')}>
      <ListRow
        leading={<span className={tall ? '-mt-1.5' : '-mt-2'}>{leading}</span>}
        title={title}
        lines={[{ text: <span className="relative -top-px">{detail}</span> }]}
        trailing={
          checked === undefined ? null : (
            <span className={tall ? '-mt-0.5' : '-mt-1'}>
              <DepotMark checked={checked} />
            </span>
          )
        }
      />
      {separator && <div className="absolute right-0 bottom-0 left-[52px] h-px bg-separator" />}
    </div>
  );
}

export type DepotGroupItem = {
  icon?: IconName;
  iconColor?: SettingsIconProps['color'];
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  trailing?: ReactNode;
  /** Where Penpot set the text in this row, in px from its top. */
  textTop?: number;
};

/** The chevron of a grouped row, on the mockup's 14 px margin. */
export function DepotChevron() {
  return <Icon name="chevron" size={16} strokeWidth={2.2} className="text-faint" />;
}

function DepotGroupRow({ item, first }: { item: DepotGroupItem; first: boolean }) {
  const top = item.textTop ?? (item.subtitle ? 12 : first ? 16 : 17);
  return (
    <div className={cn('relative flex items-start pr-3.5', item.subtitle ? 'h-16' : 'h-[52px]', item.icon ? 'pl-3.5' : 'pl-4')}>
      {item.icon && (
        <SettingsIcon
          icon={item.icon}
          color={item.iconColor}
          className={cn('mr-3.5', item.subtitle ? 'mt-[18px]' : 'mt-3', item.iconClassName)}
        />
      )}
      <span className="min-w-0 flex-1" style={{ paddingTop: top }}>
        <span className="block text-16">{item.title}</span>
        {item.subtitle && (
          <span className="mt-[3px] block text-13 text-muted">{item.subtitle}</span>
        )}
      </span>
      {item.value !== undefined && (
        <span className="text-16 text-muted" style={{ paddingTop: top }}>
          {item.value}
        </span>
      )}
      {(item.chevron || item.trailing) && (
        <span className={cn('flex h-full items-center', item.value !== undefined && 'ml-1.5')}>
          {item.trailing ?? <DepotChevron />}
        </span>
      )}
      {!first && (
        <span
          className={cn(
            'absolute right-0 -top-px h-px bg-separator',
            item.icon ? 'left-[56px]' : 'left-4',
          )}
        />
      )}
    </div>
  );
}

/** A card of settings-like rows, grey unless told otherwise. */
export function DepotGroup({
  items,
  tone = 'fill',
  className,
}: {
  items: DepotGroupItem[];
  tone?: 'fill' | 'surface';
  className?: string;
}) {
  return (
    <GroupedList className={cn(tone === 'fill' && 'bg-fill', className)}>
      {items.map((item, i) => (
        <DepotGroupRow key={i} item={item} first={i === 0} />
      ))}
    </GroupedList>
  );
}

/** The thumb zone of the flow: one or two 52 px actions, 36 px off the bottom. */
export function DepotBottom({ children }: { children: ReactNode }) {
  return (
    <BottomBar surface="plain" className="flex-col pt-6 pb-9">
      {children}
    </BottomBar>
  );
}

/** The red notice of a deposit that does not add up, on the phone. */
export function DepotBanner({
  title,
  description,
  height = 67,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  height?: 67 | 98;
  className?: string;
}) {
  return (
    <Banner
      tone="red"
      icon="warning"
      title={title}
      description={description}
      className={cn(
        'shrink-0 items-start gap-2.5 rounded-control py-0 pr-4 pl-4',
        height === 67 ? 'h-[67px]' : 'h-[98px]',
        className,
      )}
      classNames={{
        icon: 'mt-4',
        title: 'mt-[15px] text-15',
        description: cn('mt-0.5 text-13', height === 67 ? 'leading-4' : 'leading-[15.6px]'),
      }}
    />
  );
}

/** The big count and its two round buttons, on the phone and in the dialog. */
export function DepotCounter({
  value,
  alert = false,
  className,
}: {
  value: number;
  alert?: boolean;
  className?: string;
}) {
  const round = 'relative size-12 shrink-0 cursor-pointer rounded-full bg-fill';
  const bar = 'absolute rounded-[1px] bg-ink';
  return (
    <div className={cn('flex h-24 w-[260px] items-center self-center', className)}>
      <button type="button" aria-label="Moins" className={round}>
        <span className={cn(bar, 'top-[23px] left-[15px] h-[2.5px] w-[18px]')} />
      </button>
      <output
        className={cn(
          'w-[164px] text-center text-[80px] leading-[96px] font-bold tracking-[-2px]',
          alert ? 'text-red' : 'text-ink',
        )}
      >
        {value}
      </output>
      <button type="button" aria-label="Plus" className={round}>
        <span className={cn(bar, 'top-[23px] left-[15px] h-[2.5px] w-[18px]')} />
        <span className={cn(bar, 'top-[15px] left-[22.75px] h-[18px] w-[2.5px]')} />
      </button>
    </div>
  );
}

export type DepotStep = { title: string; detail: string; alert?: boolean };

/** What happened to the parcel: dots on a rail, `phone` or `desk` sized. */
export function DepotTimeline({
  steps,
  size,
  className,
}: {
  steps: DepotStep[];
  size: 'phone' | 'desk';
  className?: string;
}) {
  const phone = size === 'phone';
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, i) => (
        <li
          key={step.title}
          className={cn('relative', phone ? 'h-[52px] pl-7' : 'h-11 pl-6')}
        >
          <span
            className={cn(
              'absolute rounded-full',
              phone ? 'top-1.5 left-1.5 size-2.5' : 'top-1.5 left-1 size-2',
              step.alert ? 'bg-red' : 'bg-ink',
            )}
          />
          {i < steps.length - 1 && (
            <span
              className={cn(
                'absolute w-0.5 bg-separator',
                phone ? 'top-4 left-2.5 h-[42px]' : 'top-3.5 left-[7px] h-9',
              )}
            />
          )}
          <p
            className={cn(
              'font-semibold',
              phone ? 'text-15' : 'relative -top-px text-13',
              step.alert ? 'text-red' : 'text-ink',
            )}
          >
            {step.title}
          </p>
          <p
            className={cn(
              'text-muted',
              phone ? 'mt-px text-13' : 'mt-0.5 text-12',
            )}
          >
            {step.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}

const QR_MATRIX = [
  '#######.###.#.#######',
  '#.....#.##....#.....#',
  '#.###.#.#.#...#.###.#',
  '#.###.#.##.#..#.###.#',
  '#.###.#...#...#.###.#',
  '#.....#.#.#...#.....#',
  '#######.###...#######',
  '........#..##........',
  '###...#.#.##.#..##...',
  '#.#.##.#..##..######.',
  '..##.#.######..##..#.',
  '.#...#.#.##.#..###...',
  '...#..#.....##..##.##',
  '..........#.##..##..#',
  '#######...##.##.....#',
  '#.....#..##..#.....##',
  '#.###.#...###.....#.#',
  '#.###.#.##....#####..',
  '#.###.#..#..##......#',
  '#.....#...##.#.#..#.#',
  '#######.#..#..#.#.#.#',
];

const CORNERS = [
  'top-[238px] left-[86px] h-1 w-8',
  'top-[238px] left-[86px] h-8 w-1',
  'top-[238px] left-[274px] h-1 w-8',
  'top-[238px] left-[302px] h-8 w-1',
  'top-[454px] left-[86px] h-1 w-8',
  'top-[426px] left-[86px] h-8 w-1',
  'top-[454px] left-[274px] h-1 w-8',
  'top-[426px] left-[302px] h-8 w-1',
];

/** The camera aimed at the poster of a department: its QR in the viewfinder. */
export function DepotQrScene({
  department,
  wrong = false,
  children,
}: {
  department: string;
  /** The poster read is not the expected one: the corners turn red. */
  wrong?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-tone="camera"
      className="relative h-dvh w-full overflow-hidden bg-scene-counter text-white"
    >
      <div className="absolute inset-x-0 top-0 h-[520px] bg-scene" />
      <div className="absolute inset-x-0 top-0 h-[98px] bg-linear-to-b from-black from-50% to-transparent" />
      <div className="absolute top-14 left-[18px] flex h-11 w-[357px] items-center justify-between">
        <IconButton
          icon="x"
          label="Fermer"
          variant="night"
          size="lg"
          iconSize={22}
          className="bg-night-2"
        />
        <span className="relative left-[0.5px] text-17 font-semibold">Dépôt</span>
        <IconButton
          icon="torch"
          label="Lampe"
          variant="night"
          size="lg"
          iconSize={22}
          className="bg-night-2"
        />
      </div>
      <div className="absolute top-[230px] left-[106px] h-[225px] w-[180px] rounded-[6px] bg-paper">
        <p className="mt-3.5 text-center text-22 font-bold text-label-ink">
          {department}
        </p>
        <QrCode
          matrix={QR_MATRIX}
          module={115.2 / 21}
          label={`QR de ${department}`}
          className="absolute top-[52px] left-[32.4px] rounded-none p-0"
        />
      </div>
      {CORNERS.map((corner) => (
        <span
          key={corner}
          aria-hidden="true"
          className={cn(
            'absolute rounded-[2px]',
            wrong ? 'bg-ios-red' : 'bg-white',
            corner,
          )}
        />
      ))}
      {children}
    </div>
  );
}
