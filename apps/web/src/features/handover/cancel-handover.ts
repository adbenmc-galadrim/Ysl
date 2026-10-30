import type { HandoverCancelReason } from '@repo/contract/handover';
import { statusPatch, stepBackOf } from '@repo/contract/parcel-status';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  type HandoverEntry,
  loadHandoverEntry,
} from '#/features/handover/entry';
import { parcelEvent } from '#/features/parcels/events';

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
  // Another iPhone's clock may be ahead: a cancellation never precedes its handover.
  const cancelledAt = now < handover.at ? handover.at : now;
  const upserts: Upsert[] = [
    {
      entity: 'handover',
      row: {
        ...handover,
        cancelledAt,
        cancelReason: reason,
        cancelNote: note?.trim() || null,
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
          note: note?.trim() || null,
        },
        { agentId, now },
      ),
    ),
  ];
  await commitLocal(db, { upserts }, { now });
  return { count: parcels.length };
}
