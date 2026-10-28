import type { HandoverMethod } from '@repo/contract/handover';
import type { TranslateFn } from '@repo/shared/i18n';
import type { IconName } from '@repo/ui';
import type {
  CourrierDatabase,
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
};

export function handoverSyncOf(ops: readonly OutboxOp[]): HandoverSync {
  if (ops.some((op) => op.state === 'rejected')) return 'rejected';
  return ops.length ? 'unsent' : 'synced';
}

/**
 * The parcels a handover did hand over: all it lists once cancelled, else
 * those whose `deliveredAt` it wrote — a handover kept after losing one of
 * its parcels to another iPhone does not count that one.
 */
export function handedOf(
  handover: LocalHandover,
  parcels: readonly (LocalParcel | undefined)[],
): LocalParcel[] {
  return parcels.filter(
    (parcel): parcel is LocalParcel =>
      !!parcel &&
      !parcel.deletedAt &&
      (!!handover.cancelledAt ||
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
  const [parcels, ops] = await Promise.all([
    db.parcel.bulkGet(handover.parcelIds),
    db.outbox
      .where('[entity+entityId]')
      .equals(['handover', handover.id])
      .toArray(),
  ]);
  return {
    handover,
    parcels: handedOf(handover, parcels),
    sync: handoverSyncOf(ops),
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
