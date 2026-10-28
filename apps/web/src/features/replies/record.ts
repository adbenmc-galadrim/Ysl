import { aliasKey } from '@repo/contract/extract';
import {
  DELEGATE_NAME_MAX,
  dayKey,
  lastDayAway,
} from '@repo/contract/parcel-reply';
import { statusPatch } from '@repo/contract/parcel-status';
import type { RecipientKind } from '@repo/contract/recipient';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalParcel,
  LocalRecipientAlias,
} from '#/features/db/schema';
import { fullName } from '#/features/directory/people';
import { printedOn } from '#/features/parcels/edit';
import { parcelEvent } from '#/features/parcels/events';
import { liveParcel } from '#/features/parcels/status';

export type ReplyOptions = { agentId: string; now?: Date };

/** What a reply wrote: nothing when the parcels already said so. */
export type ReplyResult = 'recorded' | 'unchanged';

/** Only a parcel the recipient was told about can be answered for. */
const answerable = (parcel: LocalParcel | undefined): parcel is LocalParcel =>
  parcel !== undefined && !parcel.deletedAt && parcel.status === 'notifie';

type Card = { kind: RecipientKind; id: string; name: string };

async function cardOf(
  db: CourrierDatabase,
  parcel: LocalParcel,
): Promise<Card | null> {
  if (parcel.personId) {
    const person = await db.directoryPerson.get(parcel.personId);
    return {
      kind: 'person',
      id: parcel.personId,
      name: person ? fullName(person) : '',
    };
  }
  if (parcel.contactId) {
    const contact = await db.contact.get(parcel.contactId);
    return { kind: 'contact', id: parcel.contactId, name: contact?.name ?? '' };
  }
  return null;
}

/**
 * The lessons (§4.8) that took a name this label printed for the card the
 * recipient just disowned: wrong, they would set the next label alike.
 */
async function unlearned(
  db: CourrierDatabase,
  parcel: LocalParcel,
  card: Card,
  now: Date,
): Promise<LocalRecipientAlias[]> {
  const keys = [...new Set((await printedOn(db, parcel)).map(aliasKey))].filter(
    Boolean,
  );
  if (keys.length === 0) return [];
  const rows = await db.recipientAlias
    .where('nameNorm')
    .anyOf(keys)
    .filter(
      (row) =>
        row.deletedAt === null &&
        (card.kind === 'person'
          ? row.personId === card.id
          : row.contactId === card.id),
    )
    .toArray();
  return rows.map((row) => ({ ...row, deletedAt: now, updatedAt: now }));
}

/**
 * « Ce n'est pas pour moi »: the notice is taken back (`notifie → recu`),
 * the recipient taken off and the parcel back « À compléter »
 * (`recu → a_completer`), each step in the history, with the answer and
 * whom it disowned; what the label taught about that person is unlearned.
 * The name read stays, for « Choisir le destinataire ». Two parcel ops in
 * order: the server takes one step back at a time.
 */
export async function replyNotMine(
  db: CourrierDatabase,
  parcelId: string,
  { agentId, now = new Date() }: ReplyOptions,
): Promise<ReplyResult> {
  const parcel = await liveParcel(db, parcelId);
  if (!answerable(parcel)) return 'unchanged';
  const options = { agentId, now };
  const card = await cardOf(db, parcel);
  const received: LocalParcel = {
    ...parcel,
    ...statusPatch(parcel, 'recu', options),
  };
  const detached: LocalParcel = {
    ...received,
    personId: null,
    contactId: null,
    department: null,
    notificationEmail: null,
    reply: 'not_mine',
    repliedAt: now,
    expectedDelegate: null,
    remindersPausedUntil: null,
  };
  const reopened: LocalParcel = {
    ...detached,
    ...statusPatch(detached, 'a_completer', options),
  };
  const aliases = card ? await unlearned(db, parcel, card, now) : [];
  const upserts: Upsert[] = [
    ...aliases.map((row) => ({ entity: 'recipient_alias' as const, row })),
    { entity: 'parcel', row: received },
    parcelEvent(
      parcelId,
      { type: 'parcel.status', from: 'notifie', to: 'recu' },
      options,
    ),
    { entity: 'parcel', row: reopened },
    parcelEvent(
      parcelId,
      { type: 'parcel.status', from: 'recu', to: 'a_completer' },
      options,
    ),
    parcelEvent(
      parcelId,
      { type: 'parcel.reply', reply: 'not_mine', previous: card },
      options,
    ),
  ];
  await commitLocal(db, { upserts }, { now });
  return 'recorded';
}

/** The name as it will be offered at the handover: one space between words. */
export function delegateName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, DELEGATE_NAME_MAX);
}

/** One write for the parcels whose row changes, each with its event; none when nothing does. */
async function replyOn(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  change: (parcel: LocalParcel) => Partial<LocalParcel> | null,
  event: Parameters<typeof parcelEvent>[1],
  { agentId, now = new Date() }: ReplyOptions,
): Promise<ReplyResult> {
  const parcels = (await db.parcel.bulkGet([...parcelIds])).filter(answerable);
  const upserts = parcels.flatMap((parcel): Upsert[] => {
    const patch = change(parcel);
    if (!patch) return [];
    return [
      { entity: 'parcel', row: { ...parcel, ...patch } },
      parcelEvent(parcel.id, event, { agentId, now }),
    ];
  });
  if (upserts.length === 0) return 'unchanged';
  await commitLocal(db, { upserts }, { now });
  return 'recorded';
}

/**
 * « Un collègue passe le prendre »: the colleague's name on each parcel,
 * shown on the list, the record and the handover (YSL-77 will offer it).
 */
export async function replyColleague(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  delegate: string,
  options: ReplyOptions,
): Promise<ReplyResult> {
  const name = delegateName(delegate);
  if (!name) throw new Error('A colleague needs a name');
  const now = options.now ?? new Date();
  return replyOn(
    db,
    parcelIds,
    (parcel) =>
      parcel.reply === 'colleague' && parcel.expectedDelegate === name
        ? null
        : { reply: 'colleague', repliedAt: now, expectedDelegate: name },
    { type: 'parcel.reply', reply: 'colleague', delegate: name },
    { ...options, now },
  );
}

/**
 * « Absent jusqu'au … »: no reminder for these parcels before the working
 * day after `day` (`@repo/contract/reminders`). A day already gone is
 * refused.
 */
export async function replyAbsent(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  day: Date,
  options: ReplyOptions,
): Promise<ReplyResult> {
  const now = options.now ?? new Date();
  const until = lastDayAway(day);
  if (until < lastDayAway(now)) throw new Error('The day is already gone');
  return replyOn(
    db,
    parcelIds,
    (parcel) =>
      parcel.reply === 'absent' &&
      parcel.remindersPausedUntil?.getTime() === until.getTime()
        ? null
        : { reply: 'absent', repliedAt: now, remindersPausedUntil: until },
    { type: 'parcel.reply', reply: 'absent', until: dayKey(until) },
    { ...options, now },
  );
}

/**
 * The parcels an answer about `parcelId` speaks for: those of the same
 * recipient the e-mails told about, the recipient answering for all of
 * them (« Un collègue viendra le chercher – Nora Haddad »).
 */
export async function answeredWith(
  db: CourrierDatabase,
  parcelId: string,
): Promise<LocalParcel[]> {
  const parcel = await db.parcel.get(parcelId);
  if (!answerable(parcel)) return [];
  const field = parcel.personId ? 'personId' : 'contactId';
  const id = parcel.personId ?? parcel.contactId;
  if (!id) return [parcel];
  const same = await db.parcel.where(field).equals(id).toArray();
  return same
    .filter(answerable)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}
