import type { ReactNode } from 'react';

import { Checkbox } from '#components/checkbox';
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
  notified: { tile: { icon: 'mail', tone: 'blue' }, line: 'muted' },
  late: { tile: { icon: 'clock', tone: 'orange' }, line: 'orange' },
  handedOver: { tile: { icon: 'check', tone: 'green' }, line: 'muted' },
  returned: { tile: { icon: 'undo', tone: 'grey' }, line: 'muted' },
};

/** A recipient's reply overrides the state look until it is dealt with. */
const REPLY_LOOK: Record<NonNullable<Parcel['reply']>['kind'], Look> = {
  notMine: { tile: { icon: 'alert', tone: 'red' }, line: 'red' },
  delegated: { tile: { icon: 'users', tone: 'blue' }, line: 'blue' },
};

export type ParcelRowProps = {
  parcel: Parcel;
  /** Replaces the tile, e.g. with a selection checkbox. */
  leading?: ReactNode;
  /**
   * Selection mode: a round checkbox is drawn before the tile. Left
   * undefined, the row is a plain row.
   */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** `'chevron'` (the default) or any node; see `ListRow`. */
  trailing?: ReactNode;
  /** A button beside the row's own, e.g. « Choisir »; see `ListRow`. */
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
  if (parcel.note) lines.push({ text: parcel.note, tone: look.line });
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
            <Checkbox
              checked={selected}
              onCheckedChange={onSelectedChange}
              label={`Sélectionner ${parcel.recipient}`}
            />
            {tile}
          </span>
        ) : (
          tile
        ))
      }
      title={parcel.recipient}
      titleTone={parcel.state === 'incomplete' ? 'red' : 'ink'}
      lines={lines}
      trailing={trailing}
      control={control}
      separator={separator}
      separatorInset={selecting ? 92 : undefined}
      onClick={onClick}
      className={className}
    />
  );
}
