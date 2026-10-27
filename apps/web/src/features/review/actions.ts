import { plausibleWeight } from '@repo/contract/extract';
import { updateDraft } from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { formatWeight, parseWeight } from '#/features/parcels/edit';
import { type DraftAnnex, serviceText } from '#/features/scan/annex';
import type { AnnexField } from '#/features/review/model';

const PIECES = /^(\d{1,2})\s*(?:\/|sur|of)\s*(\d{1,2})$/i;

/** The value of an annex field as the box shows it: « 2,4 », « 1/3 ». */
export function annexText(
  field: AnnexField,
  annex: DraftAnnex | null | undefined,
): string {
  switch (field) {
    case 'weightKg':
      return formatWeight(annex?.weightKg?.value ?? null);
    case 'pieces':
      return annex?.pieces ? `${annex.pieces.index}/${annex.pieces.total}` : '';
    case 'service':
      return serviceText(annex) ?? '';
    case 'reference':
      return annex?.reference?.value ?? '';
  }
}

/**
 * What the agent kept or typed in an annex field, now sure (§4.3 rank 9):
 * null when the box was emptied, undefined when the text does not hold
 * (a weight off the plausible range, « 4/3 »).
 */
export function parseAnnex<F extends AnnexField>(
  field: F,
  text: string,
  annex: DraftAnnex | null | undefined,
): DraftAnnex[F] | undefined {
  const value = text.trim();
  if (value === '') return null;
  const kept = value === annexText(field, annex);
  switch (field) {
    case 'weightKg': {
      const kg = parseWeight(value);
      return (
        kg && plausibleWeight(kg) ? { value: kg, level: 'sure' } : undefined
      ) as DraftAnnex[F] | undefined;
    }
    case 'pieces': {
      const match = PIECES.exec(value);
      const index = Number(match?.[1]);
      const total = Number(match?.[2]);
      return (
        match && index >= 1 && index <= total
          ? { index, total, level: 'sure' }
          : undefined
      ) as DraftAnnex[F] | undefined;
    }
    case 'service':
      return (
        kept && annex?.service
          ? { ...annex.service, level: 'sure' }
          : { code: null, label: value, level: 'sure' }
      ) as DraftAnnex[F];
    default:
      return { value, level: 'sure' } as DraftAnnex[F];
  }
}

const EMPTY_ANNEX: DraftAnnex = {
  pieces: null,
  weightKg: null,
  service: null,
  reference: null,
};

/**
 * « Garder » or a correction on an annex field: the value goes on the
 * draft as sure. A box of several parcels takes the corrected total.
 * False when the text does not hold or the draft is gone.
 */
export async function settleAnnex(
  db: CourrierDatabase,
  draftId: string,
  field: AnnexField,
  text: string,
): Promise<boolean> {
  const draft = await db.draftParcel.get(draftId);
  if (!draft) return false;
  const parsed = parseAnnex(field, text, draft.annex);
  if (parsed === undefined) return false;
  const read = draft.pieces?.read.length ?? 0;
  const settled =
    field === 'pieces' && parsed
      ? {
          ...(parsed as NonNullable<DraftAnnex['pieces']>),
          total: Math.max(
            (parsed as NonNullable<DraftAnnex['pieces']>).total,
            read,
          ),
        }
      : parsed;
  const annex = { ...(draft.annex ?? EMPTY_ANNEX), [field]: settled };
  const pieces =
    field === 'pieces' && settled && draft.pieces
      ? {
          ...draft.pieces,
          total: (settled as NonNullable<DraftAnnex['pieces']>).total,
        }
      : draft.pieces;
  return updateDraft(db, draftId, { annex, pieces });
}

/** « Passer »: the parcel is saved « À compléter », as it stands (P2.3). */
export function skipDraft(
  db: CourrierDatabase,
  draftId: string,
): Promise<boolean> {
  return updateDraft(db, draftId, { reviewSkipped: true });
}
