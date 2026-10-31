import type { ReactNode } from 'react';

import { CheckCircle } from '#components/checkbox';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { ListRow, type ListRowLine } from '#components/list-row';
import type { Parcel, ParcelState } from '#fixtures/parcels';

type Look = {
  tile: Pick<IconTileProps, 'icon' | 'tone'>;
  line: ListRowLine['tone'];
};

/** One look per state: the tile and the colour of the state line. */
const LOOK: Record<ParcelState, Look> = {
  incomplete: { tile: { icon: 'alert', tone: 'red' }, line: 'red' },
  toNotify: { tile: { icon: 'package', tone: 'neutral' }, line: 'muted' },
  toDispatch: { tile: { icon: 'package', tone: 'neutral' }, line: 'muted' },
  onTour: { tile: { icon: 'truck', tone: 'neutral' }, line: 'muted' },
  deposited: { tile: { icon: 'building', tone: 'neutral' }, line: 'muted' },
  toSettle: { tile: { icon: 'alert', tone: 'red' }, line: 'red' },
  notified: { tile: { icon: 'mail', tone: 'blue' }, line: 'muted' },
  late: { tile: { icon: 'clock', tone: 'orange' }, line: 'orange' },
  handedOver: { tile: { icon: 'check', tone: 'green' }, line: 'muted' },
  returned: { tile: { icon: 'undo', tone: 'grey' }, line: 'muted' },
};

/** A recipient's reply overrides the state look until it is dealt with. */
const REPLY_LOOK: Record<NonNullable<Parcel['reply']>['kind'], Look> = {
  notMine: { tile: { icon: 'alert', tone: 'red' }, line: 'red' },
  delegated: { tile: { icon: 'users', tone: 'blue' }, line: 'blue' },
  absent: { tile: { icon: 'calendar', tone: 'orange' }, line: 'orange' },
};

export type ParcelRowProps = {
  parcel: Parcel;
  /** Replaces the tile, e.g. with a selection checkbox. */
  leading?: ReactNode;
  /**
   * Selection mode: a round checkbox is drawn before the tile and a tap
   * anywhere on the row ticks it. Left undefined, the row is a plain row.
   */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** A finger resting on the row, e.g. to enter selection mode. */
  onLongPress?: () => void;
  /** `'chevron'` (the default) or any node; see `ListRow`. */
  trailing?: ReactNode;
  /** A button beside the row's own, e.g. « Choisir »; see `ListRow`. Left out in selection mode. */
  control?: ReactNode;
  separator?: boolean;
  onClick?: () => void;
  className?: string;
};

export function ParcelRow({
  parcel,
  leading,
  selected,
  onSelectedChange,
  onLongPress,
  trailing,
  control,
  separator,
  onClick,
  className,
}: ParcelRowProps) {
  const look = parcel.reply
    ? REPLY_LOOK[parcel.reply.kind]
    : LOOK[parcel.state];
  const lines: ListRowLine[] = [
    {
      text:
        parcel.detail ??
        `${parcel.department}, ${parcel.carrier} ···${parcel.last4}`,
    },
  ];
  if (parcel.damage) lines.push({ text: parcel.damage, tone: 'orange' });
  if (parcel.note)
    lines.push({ text: parcel.note, tone: parcel.noteTone ?? look.line });
  if (parcel.reply)
    lines.push({ text: parcel.reply.text, tone: look.line, nowrap: true });
  else if (parcel.status) lines.push({ text: parcel.status, tone: look.line });

  const tile = <IconTile {...look.tile} />;
  const selecting = selected !== undefined;

  return (
    <ListRow
      leading={
        leading ??
        (selecting ? (
          <span className="flex items-center gap-4">
            <CheckCircle checked={selected} />
            {tile}
          </span>
        ) : (
          tile
        ))
      }
      title={parcel.recipient}
      titleTone={parcel.state === 'incomplete' && !parcel.reply ? 'red' : 'ink'}
      lines={lines}
      trailing={trailing}
      control={selecting ? undefined : control}
      separator={separator}
      separatorInset={selecting ? 92 : undefined}
      checked={selected}
      onClick={selecting ? () => onSelectedChange?.(!selected) : onClick}
      onLongPress={selecting ? undefined : onLongPress}
      className={className}
    />
  );
}
