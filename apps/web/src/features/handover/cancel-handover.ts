import type { HandoverCancelReason } from '@repo/contract/handover';
import { statusPatch, stepBackOf } from '@repo/contract/parcel-status';
import type { TranslateFn } from '@repo/shared/i18n';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  agentNameOf,
  type HandoverEntry,
  loadHandoverEntry,
  methodLabel,
} from '#/features/handover/entry';
import { parcelEvent } from '#/features/parcels/events';
import { formatWhen } from '#/features/parcels/record';

export type CancelHandoverInput = {
  reason: HandoverCancelReason;
  note?: string | null;
};

export type CancelHandoverOptions = {
  agentId: string;
  agentName?: string | null;
  now?: Date;
};

export class HandoverCancelRefusedError extends Error {
  constructor(handoverId: string) {
    super(`Handover ${handoverId} cannot be cancelled`);
    this.name = 'HandoverCancelRefusedError';
  }
}

/**
 * Whether « Annuler » is offered: the handover stands, the server has not
 * refused it, and it still holds a parcel to send back.
 */
export function canCancelHandover(entry: HandoverEntry): boolean {
  return (
    !entry.handover.cancelledAt &&
    entry.sync !== 'rejected' &&
    entry.parcels.length > 0
  );
}

/** Where the parcels go back: only a parcel already notified awaits its pickup. */
function backTitle(parcels: readonly LocalParcel[], t: TranslateFn): string {
  const count = parcels.length;
  const notified = parcels.filter((parcel) => parcel.notifiedAt).length;
  if (count === 1) {
    return t(
      notified ? 'handover.cancel.back.one' : 'handover.cancel.notify.one',
    );
  }
  if (notified === count) return t('handover.cancel.back.many', { count });
  return t(
    notified ? 'handover.cancel.mixed.many' : 'handover.cancel.notify.many',
    { count },
  );
}

/** What the sheet says it is undoing: « Remis hier à 9 h 12 », and how. */
export function describeCancelSheet(
  { handover, parcels }: HandoverEntry,
  now: Date,
  t: TranslateFn,
  me?: string,
) {
  const when = formatWhen(handover.at, now, t);
  return {
    handedOver: t('handover.cancel.handedOver', {
      when: when.charAt(0).toLowerCase() + when.slice(1),
    }),
    proof: t('handover.cancel.proof', {
      name: handover.recipientName,
      how: methodLabel(handover.method, t),
      agent: agentNameOf(handover, t, me),
    }),
    backTitle: backTitle(parcels, t),
  };
}

/**
 * F44, local first: the handover cancelled with its reason, then each parcel
 * it did hand over waiting again with its event, in one `commitLocal` (the
 * server's guard looks for the cancelled handover before the parcel). A
 * parcel lost to another iPhone stays with the handover that won it. The
 * pickup code stays used: a code that has served does not open again, the
 * next handover goes by the name or a new notice.
 */
export async function cancelHandover(
  db: CourrierDatabase,
  handoverId: string,
  { reason, note }: CancelHandoverInput,
  { agentId, agentName, now = new Date() }: CancelHandoverOptions,
): Promise<{ count: number }> {
  const entry = await loadHandoverEntry(db, handoverId);
  if (!entry || !canCancelHandover(entry)) {
    throw new HandoverCancelRefusedError(handoverId);
  }
  const { handover, parcels } = entry;
  const kept = note?.trim() || null;
  // Another iPhone's clock may be ahead: a cancellation never precedes its handover.
  const cancelledAt = now < handover.at ? handover.at : now;
  const upserts: Upsert[] = [
    {
      entity: 'handover',
      row: {
        ...handover,
        cancelledAt,
        cancelReason: reason,
        cancelNote: kept,
        cancelledByName: agentName?.trim() || null,
      },
    },
    ...parcels.map((parcel): Upsert => {
      const to = stepBackOf(parcel);
      if (!to) throw new HandoverCancelRefusedError(handoverId);
      return {
        entity: 'parcel',
        row: { ...parcel, ...statusPatch(parcel, to, { now, agentId }) },
      };
    }),
    ...parcels.map((parcel) =>
      parcelEvent(
        parcel.id,
        {
          type: 'parcel.handover_cancelled',
          handoverId: handover.id,
          reason,
          note: kept,
        },
        { agentId, now },
      ),
    ),
  ];
  await commitLocal(db, { upserts }, { now });
  return { count: parcels.length };
}
