import { plausibleWeight } from '@repo/contract/extract';
import { normalizeTracking } from '@repo/contract/tracking';
import { updateDraft } from '#/features/batch/store';
import type { CourrierDatabase, DraftSender } from '#/features/db/schema';
import { formatWeight, parseWeight } from '#/features/parcels/edit';
import { newInternalTracking } from '#/features/parcels/internal-tracking';
import { type DraftAnnex, serviceText } from '#/features/scan/annex';
import { AGENT_CONFIDENCE } from '#/features/scan/confidence';
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

/**
 * « Garder » or a correction on the sender: the name is the agent's from
 * then on (§4.3 rank 9), with the account and the OCR text it came with,
 * which « Terminer » teaches the dictionary. A name kept keeps its row; an
 * emptied box leaves the parcel without a sender. False when the draft is
 * gone.
 */
export async function settleSender(
  db: CourrierDatabase,
  draftId: string,
  text: string,
): Promise<boolean> {
  const draft = await db.draftParcel.get(draftId);
  if (!draft) return false;
  const name = text.trim().replace(/\s+/g, ' ');
  if (name === '') return updateDraft(db, draftId, { sender: null });
  const current = draft.sender ?? null;
  const sender: DraftSender = {
    name,
    id: current && current.name === name ? current.id : null,
    level: 'sure',
    confidence: AGENT_CONFIDENCE,
    source: 'agent',
    account: current?.account ?? null,
    read: current?.read ?? null,
    alias: false,
  };
  return updateDraft(db, draftId, { sender });
}

/** « Passer »: the parcel is saved « À compléter », as it stands (P2.3). */
export function skipDraft(
  db: CourrierDatabase,
  draftId: string,
): Promise<boolean> {
  return updateDraft(db, draftId, { reviewSkipped: true });
}

/**
 * A number typed in the review, with the carrier its format names or the
 * agent chose (§4.4): the agent's own, sure, so F26 can notify.
 */
export function typeDraftTracking(
  db: CourrierDatabase,
  draftId: string,
  { tracking, carrier }: { tracking: string; carrier: string },
): Promise<boolean> {
  const value = normalizeTracking(tracking);
  return updateDraft(db, draftId, {
    tracking: value,
    trackingNorm: value,
    carrier,
    trackingConfirmed: true,
    type: 'colis',
  });
}

/** The carrier the agent chose for a number whose format names none. */
export function setDraftCarrier(
  db: CourrierDatabase,
  draftId: string,
  carrier: string,
): Promise<boolean> {
  return updateDraft(db, draftId, { carrier, trackingConfirmed: true });
}

/**
 * « Sans suivi »: a courier, an envelope handed in. The app numbers the
 * parcel itself (`INT…`), no carrier; only the recipient is left to settle.
 */
export async function untrackDraft(
  db: CourrierDatabase,
  draftId: string,
): Promise<boolean> {
  const id = await newInternalTracking(db);
  return updateDraft(db, draftId, {
    type: 'sans_suivi',
    tracking: id,
    trackingNorm: id,
    carrier: null,
    trackingConfirmed: true,
  });
}
