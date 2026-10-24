import type { ParcelLabelProps } from '#components/parcel-label';
import { ScanScreen, type ScanPieces } from '#screens/reception/scan-screen';

export type PlusieursPiecesScreenProps = {
  /** Parcels in the batch so far. */
  count: number;
  /** The label the camera is pointed at: one of the pieces. */
  label: ParcelLabelProps;
  /** The parcel the pieces belong to. */
  parcel: { recipient: string; meta: string };
  /** Pieces announced on the label ("1 of 3"), the ones read, the one just read (the last read by default). */
  pieces: Omit<ScanPieces, 'index'> & { index?: number };
  onSavePartial?: () => void;
};

/**
 * A parcel delivered as several boxes carries one tracking number on each.
 * Reading the same number again is then not a duplicate but the next piece,
 * so the pieces gather under one parcel and the dots show which are still
 * on the trolley. A piece that never came can be left out on purpose. The
 * app mounts `ScanScreen` with a `piece` reading; this is that state alone.
 */
export function PlusieursPiecesScreen({
  count,
  label,
  parcel,
  pieces,
  onSavePartial,
}: PlusieursPiecesScreenProps) {
  const index = pieces.index ?? Math.max(0, ...pieces.read);
  return (
    <ScanScreen
      count={count}
      label={label}
      reading={{
        kind: 'piece',
        last: { name: parcel.recipient, meta: parcel.meta },
        pieces: { ...pieces, index },
      }}
      onSavePartial={onSavePartial}
    />
  );
}
