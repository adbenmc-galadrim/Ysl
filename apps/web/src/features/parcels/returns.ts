import {
  type ReturnReason,
  returnStart,
  statusPatch,
  StatusTransitionError,
} from '@repo/contract/parcel-status';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { codesOf } from '#/features/mail/pickup-code';
import { parcelEvent } from '#/features/parcels/events';
import {
  liveParcel,
  type StatusChangeOptions,
} from '#/features/parcels/status';

const WAITING = ['recu', 'depose', 'notifie'];

const sameRecipient = (a: LocalParcel, b: LocalParcel) =>
  a.personId === b.personId && a.contactId === b.contactId;

/** Its code closes once nothing else waits for that person at that department, as a handover leaves it. */
async function closedCode(
  db: CourrierDatabase,
  parcel: LocalParcel,
  now: Date,
): Promise<Upsert[]> {
  if (!parcel.personId && !parcel.contactId) return [];
  const others = await db.parcel
    .filter(
      (row) =>
        row.id !== parcel.id &&
        !row.deletedAt &&
        WAITING.includes(row.status) &&
        sameRecipient(row, parcel) &&
        row.departmentId === parcel.departmentId,
    )
    .count();
  if (others > 0) return [];
  const codes = (
    await codesOf(db, {
      personId: parcel.personId,
      contactId: parcel.contactId,
      departmentId: parcel.departmentId ?? null,
    })
  ).filter((code) => !code.deletedAt && !code.usedAt);
  return codes.map((code) => ({
    entity: 'pickup_code',
    row: { ...code, deletedAt: now, updatedAt: now },
  }));
}

/**
 * « Préparer le retour » (révision YSL-89): off the shelf of a department
 * with tours, the parcel waits for the shuttle; anywhere else it is gone.
 */
export async function returnParcel(
  db: CourrierDatabase,
  parcelId: string,
  reason: ReturnReason,
  tour: boolean,
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<void> {
  const parcel = await liveParcel(db, parcelId);
  const to = returnStart(parcel, tour);
  if (!to) throw new StatusTransitionError(parcel.status, 'retourne');
  await commitLocal(
    db,
    {
      upserts: [
        {
          entity: 'parcel',
          row: {
            ...parcel,
            ...statusPatch(parcel, to, { now, agentId }),
            returnReason: reason,
          },
        },
        parcelEvent(
          parcelId,
          { type: 'parcel.status', from: parcel.status, to },
          { agentId, now },
        ),
        ...(await closedCode(db, parcel, now)),
      ],
    },
    { now },
  );
}

/** The shuttle comes by (`retour_en_route`), or the parcel reaches its sender (`retourne`): several at once. */
export async function moveReturns(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  to: 'retour_en_route' | 'retourne',
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<void> {
  const parcels = await Promise.all(parcelIds.map((id) => liveParcel(db, id)));
  await commitLocal(
    db,
    {
      upserts: parcels.flatMap((parcel): Upsert[] => [
        {
          entity: 'parcel',
          row: { ...parcel, ...statusPatch(parcel, to, { now, agentId }) },
        },
        parcelEvent(
          parcel.id,
          { type: 'parcel.status', from: parcel.status, to },
          { agentId, now },
        ),
      ]),
    },
    { now },
  );
}
