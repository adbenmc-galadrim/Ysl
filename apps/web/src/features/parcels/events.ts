import {
  eventColumns,
  PARCEL_EVENT_ENTITY,
  type ParcelEvent,
} from '@repo/contract/parcel-event';
import { newId } from '@repo/shared/id';
import type { Upsert } from '#/features/db/commit';

export type EventContext = { agentId: string; now: Date };

/** The `event` row of something done to a parcel, to commit with the change itself. */
export function parcelEvent(
  parcelId: string,
  event: ParcelEvent,
  { agentId, now }: EventContext,
): Upsert {
  return {
    entity: 'event',
    row: {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      entity: PARCEL_EVENT_ENTITY,
      entityId: parcelId,
      actorId: agentId,
      at: now,
      ...eventColumns(event),
    },
  };
}
