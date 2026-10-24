import type { TranslateFn } from '@repo/shared/i18n';
import type { ScanReading } from '@repo/ui';
import type { DraftParcel, DraftPieces } from '#/features/db/schema';
import { lastOf } from '#/features/scan/last';

export type PieceReading = Extract<ScanReading, { kind: 'piece' }>;

/**
 * "Pièce 2 sur 3 lue": the parcel the piece joined, named as the band names
 * any parcel, and where its pieces stand. The band comes from the parcel
 * itself, not from the last draft of the batch: the pieces may land after
 * other parcels.
 */
export function pieceReading(
  group: DraftParcel,
  pieces: DraftPieces,
  index: number,
  t: TranslateFn,
): PieceReading {
  return {
    kind: 'piece',
    last: lastOf(group, t),
    pieces: { total: pieces.total, read: pieces.read, index },
  };
}
