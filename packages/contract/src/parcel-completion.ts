/**
 * What a parcel still lacks before the mailroom may notify it (F26): someone
 * to tell, and a way to trace it — a number and its carrier, unless the agent
 * chose « Sans suivi » (§4.4), which needs neither.
 */
export const PARCEL_GAPS = ['recipient', 'tracking', 'carrier'] as const;

export type ParcelGap = (typeof PARCEL_GAPS)[number];

export type CompletionInput = {
  type: 'colis' | 'recommande' | 'sans_suivi';
  carrier: string | null;
  tracking: string | null;
  /** A card settled: a person of the directory or a contact, not a name read alone. */
  recipient: boolean;
};

/** The gaps in the order the screens name them: the recipient, the number, its carrier. */
export function parcelGaps({
  type,
  carrier,
  tracking,
  recipient,
}: CompletionInput): ParcelGap[] {
  const gaps: ParcelGap[] = [];
  if (!recipient) gaps.push('recipient');
  if (type === 'sans_suivi') return gaps;
  if (!tracking?.trim()) gaps.push('tracking');
  else if (!carrier?.trim()) gaps.push('carrier');
  return gaps;
}

/** Complete: the parcel leaves « À compléter » for « Reçu ». */
export const isParcelComplete = (input: CompletionInput) =>
  parcelGaps(input).length === 0;

/** Crockford's base 32: no I, L, O nor U, so the id reads aloud without doubt. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const INTERNAL_PREFIX = 'INT';

const INTERNAL = /^INT[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * The number the app gives a parcel with none (« Sans suivi »: a courier, an
 * envelope handed in): `INT` and 8 characters drawn at random (40 bits). No
 * dash, so `normalizeTracking` leaves it as it is.
 */
export function internalTracking(
  random: (count: number) => ArrayLike<number> = (count) =>
    crypto.getRandomValues(new Uint8Array(count)),
): string {
  const bytes = Array.from(random(5));
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let id = '';
  for (let i = 0; i < 8; i += 1) {
    id = CROCKFORD[Number(bits & 31n)]! + id;
    bits >>= 5n;
  }
  return `${INTERNAL_PREFIX}${id}`;
}

export const isInternalTracking = (value: string | null | undefined) =>
  value != null && INTERNAL.test(value);
