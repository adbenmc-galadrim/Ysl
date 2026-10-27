import { extractFields } from '@repo/contract/extract';
import type { ParcelEditField } from '@repo/contract/parcel-event';
import { statusPatch } from '@repo/contract/parcel-status';
import { normalizeTracking } from '@repo/contract/tracking';
import { newId } from '@repo/shared/id';
import { normalizeName } from '@repo/shared/text';
import { senderReadOf } from '#/features/batch/extraction';
import { senderLessons } from '#/features/batch/senders';
import { recipientLessons } from '#/features/recipient/learning';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalContact,
  LocalParcel,
} from '#/features/db/schema';
import { isEmail, normalizeEmail } from '#/features/directory/people';
import { parcelEvent } from '#/features/parcels/events';
import { liveParcel } from '#/features/parcels/status';

/** Who the parcel is for, as the form leaves it. */
export type RecipientChoice =
  | { kind: 'person'; id: string }
  | { kind: 'contact'; id: string }
  /** "Personne hors annuaire": a name typed by hand, an e-mail if known. */
  | { kind: 'typed'; name: string; email: string }
  /** Nobody chosen: the name read on the label, if any, is all there is. */
  | { kind: 'none' };

/** The record's form, as typed. */
export type ParcelEdit = {
  recipient: RecipientChoice;
  tracking: string;
  carrier: string;
  sender: string;
  pieceTotal: number;
  pieceN: number;
  notes: string;
  notificationEmail: string;
  carrierService: string;
  reference: string;
  /** In kilograms, a comma or a point: "2,4". */
  weightKg: string;
  location: string;
};

export type EditErrorKey =
  'recipientRequired' | 'emailInvalid' | 'weightInvalid' | 'piecesInvalid';

export type EditErrors = {
  recipient?: Extract<EditErrorKey, 'recipientRequired' | 'emailInvalid'>;
  email?: Extract<EditErrorKey, 'emailInvalid'>;
  weight?: Extract<EditErrorKey, 'weightInvalid'>;
  pieces?: Extract<EditErrorKey, 'piecesInvalid'>;
};

export type EditResult =
  | { kind: 'saved'; fields: ParcelEditField[] }
  | { kind: 'unchanged' }
  | { kind: 'invalid'; errors: EditErrors };

export type EditOptions = { agentId: string; now?: Date };

const text = (value: string) => value.trim() || null;

/** "2,4" or "2.4" → 2.4; empty → nothing; anything else is a mistake. */
export function parseWeight(value: string): number | null | undefined {
  const typed = value.trim().replace(',', '.');
  if (!typed) return null;
  if (!/^\d+(\.\d+)?$/.test(typed)) return undefined;
  return Number(typed);
}

/** "2.4" → "2,4", as the desk writes it. */
export function formatWeight(kg: number | null): string {
  return kg === null ? '' : String(kg).replace('.', ',');
}

/** The form filled with the parcel as it stands. */
export function editOf(parcel: LocalParcel): ParcelEdit {
  const total = parcel.pieceTotal ?? 1;
  return {
    recipient: parcel.personId
      ? { kind: 'person', id: parcel.personId }
      : parcel.contactId
        ? { kind: 'contact', id: parcel.contactId }
        : { kind: 'none' },
    tracking: parcel.tracking ?? '',
    carrier: parcel.carrier ?? '',
    sender: parcel.senderName ?? '',
    pieceTotal: total,
    pieceN: parcel.pieceN ?? total,
    notes: parcel.notes ?? '',
    notificationEmail: parcel.notificationEmail ?? '',
    carrierService: parcel.carrierService ?? '',
    reference: parcel.reference ?? '',
    weightKg: formatWeight(parcel.weightKg),
    location: parcel.location ?? '',
  };
}

/**
 * Received once the mailroom can notify it — a carrier and a number, unless
 * the parcel has none, and someone to tell — as `promotedStatus` decides at
 * the end of a batch.
 */
export function isComplete(
  parcel: Pick<
    LocalParcel,
    'type' | 'carrier' | 'tracking' | 'personId' | 'contactId' | 'readName'
  >,
): boolean {
  const traced =
    parcel.type === 'sans_suivi' || Boolean(parcel.carrier && parcel.tracking);
  return (
    traced && Boolean(parcel.personId || parcel.contactId || parcel.readName)
  );
}

/**
 * A parcel left « À compléter » may hold a number or a name the reader was
 * not sure of (F26): only the agent setting the carrier, the number or the
 * recipient vouches for them; a note or a weight changes nothing to that.
 */
const confirmsIdentity = (fields: readonly ParcelEditField[]) =>
  fields.some(
    (field) =>
      field === 'recipient' || field === 'tracking' || field === 'carrier',
  );

/**
 * The contact a hand-typed name stands for: the one this mailroom already
 * typed with that e-mail, or with that name and no e-mail yet, counted once
 * more; a new one otherwise. Typing the same temp twice keeps one card.
 */
async function typedContact(
  db: CourrierDatabase,
  name: string,
  email: string,
  { agentId, now }: Required<EditOptions>,
): Promise<LocalContact> {
  const key = normalizeEmail(email);
  const nameNorm = normalizeName(name);
  const live = (row: LocalContact) => row.deletedAt === null;
  const known =
    (key
      ? (await db.contact.where('email').equals(key).toArray()).find(live)
      : undefined) ??
    (await db.contact.where('nameNorm').equals(nameNorm).toArray()).find(
      (row) => live(row) && row.email === null,
    );
  if (known) {
    return {
      ...known,
      email: known.email ?? (key || null),
      updatedAt: now,
      usageCount: known.usageCount + 1,
      lastUsedAt: now,
    };
  }
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: name.trim(),
    nameNorm,
    email: key || null,
    createdBy: agentId,
    usageCount: 1,
    lastUsedAt: now,
  };
}

/**
 * A sender the agent typed on the sheet is a correction (§4.3 rank 9): it
 * teaches the dictionary like one made in the batch review (§4.8), with
 * the carrier account the label's codes carried and the `FROM` block the
 * OCR read, when this iPhone still holds the label's reading (`extraction`,
 * 30 days).
 */
async function correctedSender(
  db: CourrierDatabase,
  parcelId: string,
  name: string,
  now: Date,
): Promise<{ senderId: string | null; upserts: Upsert[] }> {
  const reading = await db.extraction.get(parcelId);
  const account = reading
    ? (extractFields({ symbols: reading.codes }).accounts[0] ?? null)
    : null;
  const lessons = senderLessons(db, now);
  const sender = await lessons.learn({
    name,
    id: null,
    account,
    read: senderReadOf(reading),
    byAgent: true,
  });
  return { senderId: sender?.id ?? null, upserts: lessons.upserts() };
}

/** The card's name today, which a printed name equal to it needs no alias for. */
async function cardName(
  db: CourrierDatabase,
  card: { kind: 'person' | 'contact'; id: string },
  typed: LocalContact | undefined,
): Promise<string> {
  if (card.kind === 'person') {
    const person = await db.directoryPerson.get(card.id);
    return person ? `${person.firstName} ${person.lastName}` : '';
  }
  return typed?.name ?? (await db.contact.get(card.id))?.name ?? '';
}

/**
 * The names the label printed for its recipient, as this iPhone read them:
 * the code's name kept on the parcel, and what the reading proposed.
 */
async function printedOn(
  db: CourrierDatabase,
  parcel: LocalParcel,
): Promise<string[]> {
  const reading = await db.extraction.get(parcel.id);
  const read = (reading?.fields.recipient?.sources ?? [])
    .filter((source) => source.kind !== 'agent' && source.kind !== 'learned')
    .map((source) => source.value);
  return [...new Set([parcel.readName, ...read])].filter(
    (name): name is string => Boolean(name),
  );
}

/** One piece unless the label said otherwise: a parcel that never said stays silent. */
function pieces(parcel: LocalParcel, edit: ParcelEdit) {
  if (edit.pieceTotal > 1) {
    return { pieceTotal: edit.pieceTotal, pieceN: edit.pieceN };
  }
  return {
    pieceTotal: parcel.pieceTotal === null ? null : 1,
    pieceN: parcel.pieceN === null ? null : 1,
  };
}

const COMPARED: Record<ParcelEditField, (keyof LocalParcel)[]> = {
  recipient: ['personId', 'contactId'],
  tracking: ['tracking'],
  carrier: ['carrier'],
  sender: ['senderName'],
  pieces: ['pieceTotal', 'pieceN'],
  notes: ['notes'],
  notificationEmail: ['notificationEmail'],
  carrierService: ['carrierService'],
  reference: ['reference'],
  weightKg: ['weightKg'],
  location: ['location'],
};

function changedFields(
  before: LocalParcel,
  after: LocalParcel,
): ParcelEditField[] {
  return (Object.keys(COMPARED) as ParcelEditField[]).filter((field) =>
    COMPARED[field].some((column) => before[column] !== after[column]),
  );
}

/**
 * A notified parcel keeps someone to answer for it (the server's
 * `parcel_recipient_check`), and so does a returned one that was notified:
 * undoing the return brings it back to `notifie`.
 */
function keepsRecipient(
  parcel: Pick<LocalParcel, 'status' | 'notifiedAt'>,
): boolean {
  return (
    parcel.status === 'notifie' ||
    parcel.status === 'remis' ||
    (parcel.status === 'retourne' && parcel.notifiedAt !== null)
  );
}

export function validateEdit(
  edit: ParcelEdit,
  parcel: Pick<LocalParcel, 'status' | 'notifiedAt'>,
): EditErrors {
  const errors: EditErrors = {};
  const email = normalizeEmail(edit.notificationEmail);
  if (email && !isEmail(email)) errors.email = 'emailInvalid';
  if (parseWeight(edit.weightKg) === undefined) errors.weight = 'weightInvalid';
  if (
    edit.pieceTotal < 1 ||
    edit.pieceN < 1 ||
    (edit.pieceTotal > 1 && edit.pieceN > edit.pieceTotal)
  ) {
    errors.pieces = 'piecesInvalid';
  }
  const named =
    edit.recipient.kind === 'person' ||
    edit.recipient.kind === 'contact' ||
    (edit.recipient.kind === 'typed' && edit.recipient.name.trim() !== '');
  if (keepsRecipient(parcel) && !named) errors.recipient = 'recipientRequired';
  else if (
    edit.recipient.kind === 'typed' &&
    edit.recipient.email.trim() &&
    !isEmail(normalizeEmail(edit.recipient.email))
  ) {
    errors.recipient = 'emailInvalid';
  }
  return errors;
}

/**
 * Saves the record's form, local first and queued for `sync.push` like any
 * change: the parcel, a contact typed by hand, what a correction of the
 * sender or the recipient teaches (§4.8), and the event of the history in
 * one write, so it all works offline. Completing a parcel moves it to
 * "À notifier"; taking away what made it complete moves it back. A notified
 * or handed-over parcel keeps someone to answer for it (the server's
 * `parcel_recipient_check`). Nothing is written when nothing changed.
 */
export async function saveParcelEdit(
  db: CourrierDatabase,
  parcelId: string,
  edit: ParcelEdit,
  { agentId, now = new Date() }: EditOptions,
): Promise<EditResult> {
  const parcel = await liveParcel(db, parcelId);
  const errors = validateEdit(edit, parcel);
  if (Object.keys(errors).length) return { kind: 'invalid', errors };

  const options = { agentId, now };
  const contact =
    edit.recipient.kind === 'typed' && edit.recipient.name.trim()
      ? await typedContact(
          db,
          edit.recipient.name,
          edit.recipient.email,
          options,
        )
      : undefined;
  const recipient = contact
    ? { personId: null, contactId: contact.id }
    : edit.recipient.kind === 'person'
      ? { personId: edit.recipient.id, contactId: null }
      : edit.recipient.kind === 'contact'
        ? { personId: null, contactId: edit.recipient.id }
        : { personId: null, contactId: null };
  const tracking = normalizeTracking(edit.tracking) || null;
  const senderName = text(edit.sender);
  const learned =
    senderName !== null && senderName !== parcel.senderName
      ? await correctedSender(db, parcelId, senderName, now)
      : null;
  const edited: LocalParcel = {
    ...parcel,
    ...recipient,
    tracking,
    trackingNorm: tracking,
    carrier: text(edit.carrier),
    senderName,
    senderId:
      senderName === parcel.senderName
        ? parcel.senderId
        : (learned?.senderId ?? null),
    ...pieces(parcel, edit),
    notes: text(edit.notes),
    notificationEmail: normalizeEmail(edit.notificationEmail) || null,
    carrierService: text(edit.carrierService),
    reference: text(edit.reference),
    weightKg: parseWeight(edit.weightKg) ?? null,
    location: text(edit.location),
  };
  const fields = changedFields(parcel, edited);
  if (fields.length === 0) return { kind: 'unchanged' };

  const card = edited.personId
    ? { kind: 'person' as const, id: edited.personId }
    : edited.contactId
      ? { kind: 'contact' as const, id: edited.contactId }
      : null;
  const recipients = recipientLessons(db, now);
  if (card && fields.includes('recipient')) {
    await recipients.learn(await printedOn(db, parcel), {
      ...card,
      name: await cardName(db, card, contact),
    });
  }

  const complete = isComplete(edited);
  const to =
    parcel.status === 'a_completer' && complete && confirmsIdentity(fields)
      ? 'recu'
      : parcel.status === 'recu' && !complete && isComplete(parcel)
        ? 'a_completer'
        : undefined;
  const row = to ? { ...edited, ...statusPatch(edited, to, options) } : edited;
  const upserts: Upsert[] = [
    ...(learned?.upserts ?? []),
    ...(contact ? [{ entity: 'contact' as const, row: contact }] : []),
    ...recipients.upserts(),
    { entity: 'parcel', row },
    parcelEvent(parcelId, { type: 'parcel.edited', fields }, options),
    ...(to
      ? [
          parcelEvent(
            parcelId,
            { type: 'parcel.status', from: parcel.status, to },
            options,
          ),
        ]
      : []),
  ];
  await commitLocal(db, { upserts }, { now });
  return { kind: 'saved', fields };
}
