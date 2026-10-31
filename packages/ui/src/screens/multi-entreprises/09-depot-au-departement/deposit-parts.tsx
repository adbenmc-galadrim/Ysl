import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import {
  GroupedList,
  SettingsIcon,
  type SettingsIconProps,
} from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import { RowChevron } from '#components/phone-parts';
import { QrCode } from '#components/qr-code';
import type { IconName } from '#icons';
import { cn } from '#lib/tv';

export type DepositGroupItem = {
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

function DepositGroupRow({ item, first }: { item: DepositGroupItem; first: boolean }) {
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
          {item.trailing ?? <RowChevron strokeWidth={2.2} />}
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
export function DepositGroup({
  items,
  tone = 'fill',
  className,
}: {
  items: DepositGroupItem[];
  tone?: 'fill' | 'surface';
  className?: string;
}) {
  return (
    <GroupedList className={cn(tone === 'fill' && 'bg-fill', className)}>
      {items.map((item, i) => (
        <DepositGroupRow key={i} item={item} first={i === 0} />
      ))}
    </GroupedList>
  );
}

/** The thumb zone of the flow: one or two 52 px actions, 36 px off the bottom. */
export function DepositBottom({ children }: { children: ReactNode }) {
  return (
    <BottomBar surface="plain" className="flex-col pt-6 pb-9">
      {children}
    </BottomBar>
  );
}

/** The big count and its two round buttons, on the phone and in the dialog. */
export function DepositCounter({
  value,
  alert = false,
  onChange,
  className,
}: {
  value: number;
  alert?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}) {
  const round = 'relative size-12 shrink-0 cursor-pointer rounded-full bg-fill';
  const bar = 'absolute rounded-[1px] bg-ink';
  return (
    <div className={cn('flex h-24 w-[260px] items-center self-center', className)}>
      <button
        type="button"
        aria-label="Moins"
        className={round}
        onClick={onChange && (() => onChange(Math.max(0, value - 1)))}
      >
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
      <button
        type="button"
        aria-label="Plus"
        className={round}
        onClick={onChange && (() => onChange(value + 1))}
      >
        <span className={cn(bar, 'top-[23px] left-[15px] h-[2.5px] w-[18px]')} />
        <span className={cn(bar, 'top-[15px] left-[22.75px] h-[18px] w-[2.5px]')} />
      </button>
    </div>
  );
}

export type DepositStep = { title: string; detail: string; alert?: boolean };

/** What happened to the parcel: dots on a rail, `phone` or `desk` sized. */
export function DepositTimeline({
  steps,
  size,
  className,
}: {
  steps: DepositStep[];
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
export function DepositQrScene({
  department,
  wrong = false,
  video,
  torch,
  onClose,
  onTorch,
  children,
}: {
  department?: string;
  /** The live camera, instead of the drawn poster of the mockups. */
  video?: ReactNode;
  torch?: boolean;
  onClose?: () => void;
  onTorch?: () => void;
  /** The poster read is not the expected one: the corners turn red. */
  wrong?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-tone="camera"
      className="relative h-dvh w-full overflow-hidden bg-scene-counter text-white"
    >
      {video ? (
        <div className="absolute inset-0">{video}</div>
      ) : (
        <div className="absolute inset-x-0 top-0 h-[520px] bg-scene" />
      )}
      <div className="absolute inset-x-0 top-0 h-[98px] bg-linear-to-b from-black from-50% to-transparent" />
      <div className="absolute top-14 left-[18px] flex h-11 w-[357px] items-center justify-between">
        <IconButton
          icon="x"
          label="Fermer"
          variant="night"
          size="lg"
          iconSize={22}
          className="bg-night-2"
          onClick={onClose}
        />
        <span className="relative left-[0.5px] text-17 font-semibold">Dépôt</span>
        {torch === false ? (
          <span className="size-11" />
        ) : (
          <IconButton
            icon="torch"
            label="Lampe"
            variant="night"
            size="lg"
            iconSize={22}
            className="bg-night-2"
            onClick={onTorch}
          />
        )}
      </div>
      {!video && (
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
      )}
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
