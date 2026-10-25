import type { ParsedCode } from '@repo/contract/codes';
import { listDrafts } from '#/features/batch/store';
import type { DraftAnnex } from '#/features/scan/annex';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftPieces,
} from '#/features/db/schema';

/** The piece a label announces: its number, how many there are, and what the pieces share. */
export type PieceRead = { index: number; total: number; key: string };

/**
 * What the pieces of one shipment have in common (§4.6, "regroupement par
 * n° d'expédition"): the carrier and the shipment number when the code
 * carries one (UPS, GS1 401/402), else the tracking number itself, printed
 * on every box of some carriers.
 */
export function pieceKey(
  parsed: ParsedCode,
  trackingNorm: string | null,
): string | null {
  if (parsed.reference) return `${parsed.carrier ?? ''}:${parsed.reference}`;
  return trackingNorm;
}

/**
 * The piece a structured code announces, when the parcel comes in several
 * boxes: the "1/1" of every single parcel is not one, nor a label whose
 * pieces nothing could tie together.
 */
export function pieceOf(
  parsed: ParsedCode | null,
  trackingNorm: string | null,
): PieceRead | null {
  if (!parsed?.pieces || parsed.pieces.total <= 1) return null;
  const key = pieceKey(parsed, trackingNorm);
  if (key === null) return null;
  return { index: parsed.pieces.index, total: parsed.pieces.total, key };
}

/**
 * The piece the printed text announces (« 1 OF 3 ») when no code did: the
 * boxes then share nothing but the tracking number, which has to be read.
 */
export function pieceOfAnnex(
  annex: DraftAnnex | null | undefined,
  trackingNorm: string | null,
): PieceRead | null {
  const pieces = annex?.pieces;
  if (!pieces || pieces.total <= 1 || trackingNorm === null) return null;
  return { index: pieces.index, total: pieces.total, key: trackingNorm };
}

/** What a draft records of the first piece read: the parcel starts with it. */
export function firstPiece({ index, total, key }: PieceRead): DraftPieces {
  return { total, read: [index], key, photoIds: [] };
}

/**
 * The draft of the batch the piece belongs to: the oldest one with the same
 * key. Only an older draft counts, as for duplicates: two pieces landing
 * together must not each join the other.
 */
export async function findPieceGroup(
  db: CourrierDatabase,
  draft: Pick<DraftParcel, 'id' | 'batchId' | 'createdAt'>,
  key: string,
): Promise<DraftParcel | undefined> {
  const drafts = await listDrafts(db, draft.batchId);
  return drafts.find(
    (other) =>
      other.id !== draft.id &&
      other.createdAt < draft.createdAt &&
      other.pieces?.key === key,
  );
}

/**
 * The piece joins its parcel: its number among the ones read, its photo
 * among the parcel's, and its own draft goes, so the batch counts one parcel
 * ("pièces regroupées en un colis"). Returns the parcel's draft as it now
 * stands, or undefined when it was undone meanwhile: the piece then stays a
 * parcel of its own.
 */
export function attachPiece(
  db: CourrierDatabase,
  groupId: string,
  piece: DraftParcel,
  index: number,
): Promise<DraftParcel | undefined> {
  return db.transaction('rw', db.draftParcel, async () => {
    const group = await db.draftParcel.get(groupId);
    if (!group?.pieces) return undefined;
    const read = [...new Set([...group.pieces.read, index])].sort(
      (a, b) => a - b,
    );
    const photoIds = piece.photoId
      ? [...group.pieces.photoIds, piece.photoId]
      : group.pieces.photoIds;
    const pieces: DraftPieces = { ...group.pieces, read, photoIds };
    await db.draftParcel.update(groupId, { pieces });
    await db.draftParcel.delete(piece.id);
    return { ...group, pieces };
  });
}
