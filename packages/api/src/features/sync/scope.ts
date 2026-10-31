import { createHash } from 'node:crypto';
import {
  batch,
  contact,
  department,
  deposit,
  directoryPerson,
  event,
  handover,
  notification,
  parcel,
  pickupCode,
  recipientAlias,
  sender,
  senderAccount,
  senderAlias,
} from '@repo/db/schema';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import type { PullPage } from '@repo/contract/sync';
import { and, eq, gte, lt, or, sql, type SQL } from 'drizzle-orm';
import { parcelInScope, type ParcelScope } from '#lib/access';
import type { SyncTable } from '#features/sync/tables';

/**
 * The generation as this reader sees it: a device that changes department,
 * or goes from the whole company to one department, holds a cursor of another
 * generation and starts over, so what it may no longer read leaves it. A
 * whole-company reader keeps the server's.
 */
export function readerGeneration(generation: string, scope: ParcelScope) {
  if (scope.kind === 'company') return generation;
  const reader =
    scope.kind === 'department'
      ? scope.departmentId
      : `tour:${scope.shuttleId}`;
  const hex = createHash('sha256')
    .update(`${generation}:${reader}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** The shuttle's learning and its batches: nothing a department reads or writes. */
const HIDDEN_FROM_DEPARTMENT = new Set<SyncTable>([
  batch,
  sender,
  senderAccount,
  senderAlias,
  recipientAlias,
]);

export function isHiddenFromDepartment(table: SyncTable): boolean {
  return HIDDEN_FROM_DEPARTMENT.has(table);
}

/**
 * Which rows of `table` this scope reads, within the range of the pull. A
 * row that hangs on a parcel may be older than the moment the parcel reached
 * the department: it comes when it or its parcel falls in the range.
 */
export function visibleRows(
  table: SyncTable,
  scope: ParcelScope,
  organizationId: string,
  page: Pick<PullPage, 'from' | 'bound'>,
  inRange: SQL | undefined,
): SQL | undefined {
  if (scope.kind === 'company') return inRange;
  const inScope = parcelInScope(scope);
  if (scope.kind === 'department' && HIDDEN_FROM_DEPARTMENT.has(table)) {
    return sql`false`;
  }

  const parcelsWhere = (link: SQL, ranged: boolean) => sql`exists (
    select 1 from ${parcel}
     where ${parcel.organizationId} = ${organizationId}
       and ${inScope}
       and ${link}
       ${ranged ? sql`and ${and(gte(parcel.serverXid, page.from), lt(parcel.serverXid, page.bound))}` : sql``}
  )`;
  const hanging = (link: SQL) =>
    and(parcelsWhere(link, false), or(inRange, parcelsWhere(link, true)));

  if (table === deposit) {
    return and(
      scope.kind === 'department'
        ? eq(deposit.departmentId, scope.departmentId)
        : eq(deposit.shuttleId, scope.shuttleId),
      inRange,
    );
  }
  if (table === parcel) {
    // Those it no longer carries come too, for its phone to let them go (`forReader`).
    return and(
      scope.kind === 'tour'
        ? or(inScope, sql`${scope.shuttleId} = any(${parcel.formerShuttleIds})`)
        : inScope,
      inRange,
    );
  }
  if (scope.kind === 'department') {
    const { departmentId } = scope;
    if (table === directoryPerson) {
      return and(eq(directoryPerson.departmentId, departmentId), inRange);
    }
    if (table === pickupCode) {
      return and(eq(pickupCode.departmentId, departmentId), inRange);
    }
    if (table === department) {
      return and(eq(department.id, departmentId), inRange);
    }
    if (table === contact) {
      return hanging(sql`${parcel.contactId} = ${contact.id}`);
    }
  } else if (table === pickupCode) {
    // A shuttle reads the whole directory and every contact, not the codes of people it carries nothing for.
    return hanging(
      sql`(${parcel.personId} = ${pickupCode.personId} or ${parcel.contactId} = ${pickupCode.contactId})`,
    );
  }
  if (table === notification) {
    return hanging(sql`${parcel.id} = any(${notification.parcelIds})`);
  }
  if (table === handover) {
    return hanging(sql`${parcel.id} = any(${handover.parcelIds})`);
  }
  if (table === event) {
    return and(
      eq(event.entity, PARCEL_EVENT_ENTITY),
      hanging(sql`${parcel.id} = ${event.entityId}`),
    );
  }
  return inRange;
}
