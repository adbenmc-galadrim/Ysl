import { canHandOver, canWriteDirectory } from '@repo/contract/auth';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import { SYNC_STATUS, type SyncOp } from '@repo/contract/sync';
import type { AnyDb } from '@repo/db';
import {
  contact,
  directoryPerson,
  handover,
  notification,
  parcel,
  pickupCode,
} from '@repo/db/schema';
import type { TranslationKey } from '@repo/shared/i18n';
import { and, eq, inArray } from 'drizzle-orm';
import { SyncRejected } from '#features/sync/errors';
import { isHiddenFromDepartment } from '#features/sync/scope';
import { tableOf } from '#features/sync/tables';
import { parcelScope, type Access } from '#lib/access';

type Values = Record<string, unknown>;

function refuse(
  op: SyncOp,
  why: string,
  key: Extract<TranslationKey, `sync.op.${string}`>,
): never {
  throw new SyncRejected(
    SYNC_STATUS.forbidden,
    `${op.entity} ${op.entityId} ${why}`,
    key,
  );
}

const outOfScope = (op: SyncOp): never =>
  refuse(op, 'is out of the department', 'sync.op.outOfScope');

/** A handover, a parcel going in or out of `remis`, a code marked used. */
async function checkHandOver(
  tx: AnyDb,
  op: SyncOp,
  { organizationId }: Access,
): Promise<void> {
  const noHandover = () => refuse(op, 'hands over', 'sync.op.noHandover');
  if (op.entity === 'handover') noHandover();
  if (op.entity === 'pickup_code' && op.type === 'upsert' && op.patch.usedAt) {
    const [row] = await tx
      .select({ usedAt: pickupCode.usedAt })
      .from(pickupCode)
      .where(
        and(
          eq(pickupCode.organizationId, organizationId),
          eq(pickupCode.id, op.entityId),
        ),
      );
    if (!row?.usedAt) noHandover();
  }
  if (op.entity === 'parcel' && op.type === 'upsert' && 'status' in op.patch) {
    const [row] = await tx
      .select({ status: parcel.status })
      .from(parcel)
      .where(
        and(
          eq(parcel.organizationId, organizationId),
          eq(parcel.id, op.entityId),
        ),
      );
    if ((row?.status === 'remis') !== (op.patch.status === 'remis')) {
      noHandover();
    }
  }
}

const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];

/** Every parcel named is in the department. */
async function allInDepartment(
  tx: AnyDb,
  organizationId: string,
  departmentId: string,
  ids: string[],
): Promise<boolean> {
  if (ids.length === 0) return false;
  const rows = await tx
    .select({ id: parcel.id })
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        eq(parcel.departmentId, departmentId),
        inArray(parcel.id, ids),
      ),
    );
  return rows.length === new Set(ids).size;
}

async function personIn(
  tx: AnyDb,
  organizationId: string,
  departmentId: string,
  personId: unknown,
): Promise<boolean> {
  if (typeof personId !== 'string') return true;
  const [row] = await tx
    .select({ id: directoryPerson.id })
    .from(directoryPerson)
    .where(
      and(
        eq(directoryPerson.organizationId, organizationId),
        eq(directoryPerson.departmentId, departmentId),
        eq(directoryPerson.id, personId),
      ),
    );
  return !!row;
}

/** A contact the department already holds a parcel for, or that this account just created (§3.7.9). */
async function contactIn(
  tx: AnyDb,
  { organizationId, userId }: Access,
  departmentId: string,
  contactId: unknown,
): Promise<boolean> {
  if (typeof contactId !== 'string') return true;
  const [row] = await tx
    .select({ createdBy: contact.createdBy })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.id, contactId),
      ),
    );
  if (!row || row.createdBy === userId) return true;
  const [linked] = await tx
    .select({ id: parcel.id })
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        eq(parcel.departmentId, departmentId),
        eq(parcel.contactId, contactId),
      ),
    )
    .limit(1);
  return !!linked;
}

/** What a department account writes: its own rows, and new ones only where they stay its own. */
async function checkDepartment(
  tx: AnyDb,
  op: SyncOp,
  access: Access,
  departmentId: string,
): Promise<void> {
  const { organizationId } = access;
  const inDepartment = (ids: string[]) =>
    allInDepartment(tx, organizationId, departmentId, ids);
  const { patch, entityId: id } = op;

  if (isHiddenFromDepartment(tableOf(op.entity))) outOfScope(op);

  switch (op.entity) {
    case 'parcel': {
      if (!(await inDepartment([id]))) outOfScope(op);
      const [row] = await tx
        .select({ personId: parcel.personId })
        .from(parcel)
        .where(
          and(eq(parcel.organizationId, organizationId), eq(parcel.id, id)),
        );
      // A copy names the person it already had: a parcel stays writable once they moved away.
      if (
        (patch.personId !== row?.personId &&
          !(await personIn(
            tx,
            organizationId,
            departmentId,
            patch.personId,
          ))) ||
        !(await contactIn(tx, access, departmentId, patch.contactId))
      ) {
        outOfScope(op);
      }
      return;
    }
    case 'directory_person': {
      const [row] = await tx
        .select({ departmentId: directoryPerson.departmentId })
        .from(directoryPerson)
        .where(
          and(
            eq(directoryPerson.organizationId, organizationId),
            eq(directoryPerson.id, id),
          ),
        );
      if (row ? row.departmentId !== departmentId : op.type === 'delete') {
        outOfScope(op);
      }
      return;
    }
    case 'pickup_code': {
      const [row] = await tx
        .select({ departmentId: pickupCode.departmentId })
        .from(pickupCode)
        .where(
          and(
            eq(pickupCode.organizationId, organizationId),
            eq(pickupCode.id, id),
          ),
        );
      if (row ? row.departmentId !== departmentId : op.type === 'delete') {
        outOfScope(op);
      }
      if (
        !(await personIn(tx, organizationId, departmentId, patch.personId)) ||
        !(await contactIn(tx, access, departmentId, patch.contactId))
      ) {
        outOfScope(op);
      }
      return;
    }
    case 'contact': {
      const [row] = await tx
        .select({ id: contact.id })
        .from(contact)
        .where(
          and(eq(contact.organizationId, organizationId), eq(contact.id, id)),
        );
      if (
        row
          ? !(await contactIn(tx, access, departmentId, id))
          : op.type === 'delete'
      ) {
        outOfScope(op);
      }
      return;
    }
    case 'notification':
    case 'handover': {
      const table = op.entity === 'handover' ? handover : notification;
      const [row] = await tx
        .select({ parcelIds: table.parcelIds })
        .from(table)
        .where(and(eq(table.organizationId, organizationId), eq(table.id, id)));
      if (row && !(await inDepartment(row.parcelIds))) outOfScope(op);
      if (!row && op.type === 'delete') outOfScope(op);
      if (
        op.type === 'upsert' &&
        patch.parcelIds !== undefined &&
        !(await inDepartment(idsOf(patch.parcelIds)))
      ) {
        outOfScope(op);
      }
      return;
    }
    case 'event': {
      if (
        patch.entity !== PARCEL_EVENT_ENTITY ||
        typeof patch.entityId !== 'string' ||
        !(await inDepartment([patch.entityId]))
      ) {
        outOfScope(op);
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Whether this account may write this row (§2.1), before anything else looks
 * at it. A department is held to its own rows; `department` is written by its
 * router only; `admin`, `agent` and a null role write as before (YSL-118).
 */
export async function checkReach(
  tx: AnyDb,
  op: SyncOp,
  access: Access,
): Promise<void> {
  if (op.entity === 'department') {
    refuse(op, 'is not written by a device', 'sync.op.readOnly');
  }
  if (!canHandOver(access.role)) await checkHandOver(tx, op, access);
  if (op.entity === 'directory_person' && !canWriteDirectory(access.role)) {
    refuse(op, 'is read-only for this account', 'sync.op.directoryReadOnly');
  }
  const scope = parcelScope(access);
  if (scope.kind === 'department') {
    await checkDepartment(tx, op, access, scope.departmentId);
  }
}

const withoutDepartment = ({ departmentId: _dropped, ...rest }: Values) => {
  void _dropped;
  return rest;
};

/**
 * The department a row gets. A department stamps its own and cannot give a
 * parcel away. A parcel for a person follows that person (the trigger of
 * drizzle/0020): a copy's department, perhaps stale, says nothing; one
 * without a person takes what the company's accounts say.
 */
export async function departmentWrite(
  tx: AnyDb,
  op: SyncOp,
  access: Access,
  values: Values,
): Promise<Values> {
  const scope = parcelScope(access);
  if (scope.kind === 'department') {
    if (op.entity === 'directory_person' || op.entity === 'pickup_code') {
      return { ...values, departmentId: scope.departmentId };
    }
    return op.entity === 'parcel' ? withoutDepartment(values) : values;
  }
  if (op.entity !== 'parcel' || !('departmentId' in values)) return values;
  let personId = values.personId;
  if (personId === undefined) {
    const [row] = await tx
      .select({ personId: parcel.personId })
      .from(parcel)
      .where(
        and(
          eq(parcel.organizationId, access.organizationId),
          eq(parcel.id, op.entityId),
        ),
      );
    personId = row?.personId;
  }
  return personId ? withoutDepartment(values) : values;
}
