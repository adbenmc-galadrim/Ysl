import type { RecipientKind } from '@repo/contract/recipient';
import type { LocalPickupCode } from '#/features/db/schema';

/** How the person was identified: the `handover.method` the handover will record. */
export type HandoverVia = 'qr' | 'pin' | 'manuel';

/** What `/remise/colis` is opened with: who, how, when, and the code checked. */
export type RemiseColisSearch = {
  kind: RecipientKind;
  id: string;
  via: HandoverVia;
  /** When the QR or the code was checked, in ms. */
  at: number;
  /** The `pickup_code` checked, for the handover to mark used (YSL-73). */
  code?: string;
};

const VIAS: readonly HandoverVia[] = ['qr', 'pin', 'manuel'];

/** Reads the search of `/remise/colis`; anything unexpected falls back to a pick by name. */
export function parseRemiseColisSearch(
  search: Record<string, unknown>,
): RemiseColisSearch {
  const via = VIAS.find((v) => v === search.via) ?? 'manuel';
  const at = Number(search.at);
  return {
    kind: search.kind === 'contact' ? 'contact' : 'person',
    id: typeof search.id === 'string' ? search.id : '',
    via,
    at: Number.isFinite(at) && at > 0 ? at : Date.now(),
    ...(via !== 'manuel' && typeof search.code === 'string'
      ? { code: search.code }
      : {}),
  };
}

/** Where a checked QR or code leads: its recipient's parcels. */
export function searchForCode(
  code: LocalPickupCode,
  via: 'qr' | 'pin',
  at: number,
): RemiseColisSearch {
  return code.personId
    ? { kind: 'person', id: code.personId, via, at, code: code.id }
    : { kind: 'contact', id: code.contactId ?? '', via, at, code: code.id };
}
