import type { HandoverMethod } from '@repo/contract/handover';
import {
  PARCEL_EVENT_ENTITY,
  readParcelEvent,
} from '@repo/contract/parcel-event';
import type { TranslateFn } from '@repo/shared/i18n';
import type { IconName } from '@repo/ui';
import type {
  CourrierDatabase,
  HandoverProofKind,
  LocalHandover,
  LocalParcel,
  OutboxOp,
} from '#/features/db/schema';
import { carrierLabel } from '#/features/parcels/model';

/** Where a handover stands with the server, from its own outbox op. */
export type HandoverSync = 'synced' | 'unsent' | 'rejected';

/** A handover with the parcels it lists and its place in the outbox. */
export type HandoverEntry = {
  handover: LocalHandover;
  /** The parcels it handed over still on this iPhone, in its order. */
  parcels: LocalParcel[];
  sync: HandoverSync;
  /** Why the server refused it, as it said so. */
  refusal?: string;
  /** The signature and the photo this iPhone holds (D8: they stay where taken). */
  proofs: HandoverProofKind[];
};

/** The kinds of proof of a handover this iPhone holds. */
export async function proofKindsOf(
  db: CourrierDatabase,
  handoverId: string,
): Promise<HandoverProofKind[]> {
  const rows = await db.handoverProof
    .where('handoverId')
    .equals(handoverId)
    .toArray();
  return [...new Set(rows.map((row) => row.kind))].sort();
}

export function handoverSyncOf(ops: readonly OutboxOp[]): HandoverSync {
  if (ops.some((op) => op.state === 'rejected')) return 'rejected';
  return ops.length ? 'unsent' : 'synced';
}

/**
 * The parcels an agent undid this handover for, told by their events: a
 * handover that lost one to another iPhone wrote none for that one.
 */
export async function undoneParcelIds(
  db: CourrierDatabase,
  handover: LocalHandover,
): Promise<Set<string>> {
  if (!handover.cancelReason) return new Set();
  const events = await db.event
    .where('[entity+entityId]')
    .anyOf(handover.parcelIds.map((id) => [PARCEL_EVENT_ENTITY, id]))
    .toArray();
  return new Set(
    events.flatMap((row) => {
      const event = readParcelEvent(row.type, row.detail);
      return event?.type === 'parcel.handover_cancelled' &&
        event.handoverId === handover.id
        ? [row.entityId]
        : [];
    }),
  );
}

/**
 * The parcels a handover did hand over: those an agent undid it for, all it
 * lists when the synchronisation cancelled it, else those whose `deliveredAt`
 * it wrote — a handover kept after losing one of its parcels to another
 * iPhone does not count that one.
 */
export function handedOf(
  handover: LocalHandover,
  parcels: readonly (LocalParcel | undefined)[],
  undone?: ReadonlySet<string>,
): LocalParcel[] {
  return parcels.filter(
    (parcel): parcel is LocalParcel =>
      !!parcel &&
      !parcel.deletedAt &&
      (handover.cancelReason && undone
        ? undone.has(parcel.id)
        : !!handover.cancelledAt ||
          (parcel.status === 'remis' &&
            parcel.deliveredAt?.getTime() === handover.at.getTime())),
  );
}

/** The handover, or null once it is not (or no longer) on this iPhone. */
export async function loadHandoverEntry(
  db: CourrierDatabase,
  handoverId: string,
): Promise<HandoverEntry | null> {
  const handover = await db.handover.get(handoverId);
  if (!handover || handover.deletedAt) return null;
  const [parcels, undone, ops, proofs] = await Promise.all([
    db.parcel.bulkGet(handover.parcelIds),
    undoneParcelIds(db, handover),
    db.outbox
      .where('[entity+entityId]')
      .equals(['handover', handover.id])
      .toArray(),
    proofKindsOf(db, handover.id),
  ]);
  return {
    handover,
    parcels: handedOf(handover, parcels, undone),
    sync: handoverSyncOf(ops),
    refusal: ops.find((op) => op.state === 'rejected')?.lastError ?? undefined,
    proofs,
  };
}

/**
 * « Karim Benali »; a handover written before the name was kept says
 * « Vous » to its agent (`me`, the signed-in user) and « Un agent » to others.
 */
export function agentNameOf(
  handover: LocalHandover,
  t: TranslateFn,
  me?: string,
): string {
  if (handover.agentName) return handover.agentName;
  return handover.agentId === me
    ? t('handover.agent.me')
    : t('handover.agent.unknown');
}

/** « QR code vérifié », « Code vérifié », « Sans vérification ». */
export function methodLabel(method: HandoverMethod, t: TranslateFn): string {
  return t(`handover.method.${method}`);
}

export const METHOD_ICON: Record<HandoverMethod, IconName> = {
  qr: 'qr',
  pin: 'hash',
  signature: 'sign',
  manuel: 'user',
};

/** A parcel as a handover lists it: who sent it, then « DPD ···4471 ». */
export function handedParcel(
  parcel: LocalParcel,
  t: TranslateFn,
): { id: string; title: string; detail: string } {
  const carrier = carrierLabel(parcel, t);
  const last4 =
    parcel.tracking && parcel.type !== 'sans_suivi'
      ? parcel.tracking.slice(-4)
      : '';
  return {
    id: parcel.id,
    title: parcel.senderName ?? t(`parcel.type.${parcel.type}`),
    detail: last4 ? `${carrier} ···${last4}` : carrier,
  };
}
