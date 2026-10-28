import { damageOf } from '@repo/contract/parcel-damage';
import { standingReply } from '@repo/contract/parcel-reply';
import type { RecipientKind } from '@repo/contract/recipient';
import type { TranslateFn } from '@repo/shared/i18n';
import type { RemiseParcel } from '@repo/ui';
import { Dexie } from 'dexie';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  carrierLabel,
  DAY_MS,
  formatTime,
  shortDate,
  startOfDay,
} from '#/features/parcels/model';

/** Who collects: a card of the directory or a contact outside it. */
export type HandoverRecipient = { kind: RecipientKind; id: string };

/** What waits at the desk for someone: received, notified or not (P4). */
export const WAITING_STATUSES = ['recu', 'notifie'] as const;

const isWaiting = (parcel: LocalParcel) =>
  !parcel.deletedAt &&
  (WAITING_STATUSES as readonly string[]).includes(parcel.status);

export const recipientKey = ({ kind, id }: HandoverRecipient) =>
  `${kind}:${id}`;

/** Their parcels on the shelf, oldest first: the order the agent fetches them in. */
export async function listWaitingParcels(
  db: CourrierDatabase,
  recipient: HandoverRecipient,
): Promise<LocalParcel[]> {
  const field = recipient.kind === 'person' ? 'personId' : 'contactId';
  const parcels = await db.parcel.where(field).equals(recipient.id).toArray();
  return parcels
    .filter(isWaiting)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}

/** How many parcels wait for each card and contact, by `recipientKey`. */
export async function waitingCounts(
  db: CourrierDatabase,
): Promise<Map<string, number>> {
  const parcels = (
    await Promise.all(
      WAITING_STATUSES.map((status) =>
        db.parcel
          .where('[status+receivedAt]')
          .between([status, Dexie.minKey], [status, Dexie.maxKey])
          .toArray(),
      ),
    )
  ).flat();
  const counts = new Map<string, number>();
  for (const parcel of parcels.filter(isWaiting)) {
    const recipient: HandoverRecipient | null = parcel.personId
      ? { kind: 'person', id: parcel.personId }
      : parcel.contactId
        ? { kind: 'contact', id: parcel.contactId }
        : null;
    if (!recipient) continue;
    const key = recipientKey(recipient);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** « Reçu aujourd’hui à 10 h 15 », « Reçu hier », « Reçu le 14 oct. ». */
export function receivedLine(date: Date, now: Date, t: TranslateFn): string {
  const today = startOfDay(now);
  if (date >= today) {
    return t('handover.received.today', { time: formatTime(date) });
  }
  if (date.getTime() >= today.getTime() - DAY_MS) {
    return t('handover.received.yesterday');
  }
  return t('handover.received.on', { date: shortDate(date, now) });
}

/** « Retrait prévu par Paul Mercier »: the recipient said who comes (YSL-70; YSL-77 will offer the name). */
export function delegateLine(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): string | undefined {
  const reply = standingReply(parcel, now);
  return reply?.kind === 'colleague'
    ? t('handover.delegate', { name: reply.delegate })
    : undefined;
}

/** The colleague first: the line is cut short on a narrow screen, the day of reception matters less. */
function withDelegate(received: string, delegate: string | undefined): string {
  return delegate
    ? `${delegate} · ${received.charAt(0).toLowerCase()}${received.slice(1)}`
    : received;
}

/**
 * A parcel as the handover lists it, with what to check on the shelf: who
 * sent it, a reserve on its state; a registered one will ask for a signature.
 */
export function toRemiseParcel(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): RemiseParcel {
  return {
    id: parcel.id,
    carrier: carrierLabel(parcel, t),
    last4:
      parcel.tracking && parcel.type !== 'sans_suivi'
        ? parcel.tracking.slice(-4)
        : '',
    received: withDelegate(
      receivedLine(parcel.receivedAt, now, t),
      delegateLine(parcel, now, t),
    ),
    ...(parcel.senderName ? { sender: parcel.senderName } : {}),
    registered: parcel.type === 'recommande',
    damaged: damageOf(parcel) !== null,
  };
}
