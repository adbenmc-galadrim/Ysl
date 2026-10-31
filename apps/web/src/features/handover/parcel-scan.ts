import { normalizeTracking } from '@repo/contract/tracking';
import type { LocalParcel } from '#/features/db/schema';

const numberOf = (parcel: LocalParcel) =>
  parcel.type === 'sans_suivi'
    ? null
    : parcel.trackingNorm || parcel.tracking || null;

/** A parcel with a number to read: one « Sans suivi » has no label to scan. */
export const hasLabel = (parcel: LocalParcel) => numberOf(parcel) !== null;

/** The parcel this code or typed number names: a 2D code may hold more than the number. */
export function parcelOfRead(
  read: string,
  parcels: readonly LocalParcel[],
): LocalParcel | undefined {
  const text = normalizeTracking(read);
  if (!text) return undefined;
  return (
    parcels.find((parcel) => numberOf(parcel) === text) ??
    parcels.find((parcel) => {
      const number = numberOf(parcel);
      return number !== null && text.includes(number);
    })
  );
}

/** Whether every parcel about to leave was scanned; nothing to scan counts. */
export function scanComplete(
  ticked: readonly LocalParcel[],
  scanned: ReadonlySet<string>,
): boolean {
  return ticked.filter(hasLabel).every((parcel) => scanned.has(parcel.id));
}
