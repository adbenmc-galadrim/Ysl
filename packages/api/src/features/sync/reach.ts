import { canWriteDirectory } from '@repo/contract/auth';
import {
  missingHandoverSteps,
  OPERATING_PROFILE_KEY,
  parseOperatingProfile,
  requiresHandoverSteps,
} from '@repo/contract/operating-profile';
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
  setting,
} from '@repo/db/schema';
import type { TranslationKey } from '@repo/shared/i18n';
import { and, arrayContains, eq, inArray, isNull } from 'drizzle-orm';
import { SyncRejected } from '#features/sync/errors';
import { isHiddenFromDepartment } from '#features/sync/scope';
import { tableOf } from '#features/sync/tables';
import {
  parcelInScope,
  parcelScope,
  type Access,
  type ParcelScope,
} from '#lib/access';
import { mayHandOver } from '#features/operating/service';

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

/** The company's profile and when it last changed; only a profile that requires a step counts. */
async function requiringProfile(tx: AnyDb, organizationId: string) {
  const [row] = await tx
    .select({ value: setting.value, updatedAt: setting.updatedAt })
    .from(setting)
    .where(
      and(
        eq(setting.organizationId, organizationId),
        eq(setting.key, OPERATING_PROFILE_KEY),
        isNull(setting.deletedAt),
      ),
    );
  if (!row) return null;
  const profile = parseOperatingProfile(row.value);
  return requiresHandoverSteps(profile)
    ? { profile, updatedAt: row.updatedAt }
    : null;
}

const noStep = (op: SyncOp): never =>
  refuse(op, 'misses a step the profile requires', 'sync.op.handoverSteps');

/**
 * The profile on what the phones send (ME16). A handover has already happened
 * at the counter: one made before the profile changed, or by a version without
 * this rule, which never sends `hasScan`, stays accepted. Its parcels and its
 * event follow the refusal, so no parcel is `remis` without a handover.
 */
async function checkHandoverSteps(
  tx: AnyDb,
  op: SyncOp,
  { organizationId }: Access,
): Promise<void> {
  if (op.type !== 'upsert') return;
  const { patch } = op;
  const delivered =
    op.entity === 'event' && patch.type === 'parcel.delivered'
      ? (patch.detail as { handoverId?: unknown } | null)?.handoverId
      : undefined;
  const isDelivery = op.entity === 'parcel' && patch.status === 'remis';
  if (op.entity !== 'handover' && !isDelivery && delivered === undefined) {
    return;
  }
  const required = await requiringProfile(tx, organizationId);
  if (!required) return;
  if (op.entity === 'handover') {
    const [known] = await tx
      .select({ id: handover.id })
      .from(handover)
      .where(
        and(
          eq(handover.organizationId, organizationId),
          eq(handover.id, op.entityId),
        ),
      );
    if (known || !('hasScan' in patch) || patch.cancelledAt) return;
    if (new Date(patch.at as string | Date) < required.updatedAt) return;
    const missing = missingHandoverSteps(required.profile, {
      method: patch.method as never,
      hasSignature: patch.hasSignature as boolean,
      hasPhoto: patch.hasPhoto as boolean,
      hasScan: patch.hasScan as boolean,
    });
    if (missing.length > 0) noStep(op);
    return;
  }
  const [listed] = await tx
    .select({ id: handover.id })
    .from(handover)
    .where(
      and(
        eq(handover.organizationId, organizationId),
        isDelivery
          ? arrayContains(handover.parcelIds, [op.entityId])
          : eq(handover.id, String(delivered)),
      ),
    )
    .limit(1);
  if (!listed) noStep(op);
}

const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];

/** Every parcel named is within the scope. */
async function allInScope(
  tx: AnyDb,
  organizationId: string,
  scope: ParcelScope,
  ids: string[],
): Promise<boolean> {
  if (ids.length === 0) return false;
  const rows = await tx
    .select({ id: parcel.id })
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        parcelInScope(scope),
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
    allInScope(tx, organizationId, { kind: 'department', departmentId }, ids);
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

const offTour = (op: SyncOp): never =>
  refuse(op, 'is on another tour', 'sync.op.offTour');

/** What a shuttle on tour writes: its own parcels and new ones; the directory and the contacts stay open to it. */
async function checkTour(
  tx: AnyDb,
  op: SyncOp,
  { organizationId }: Access,
  scope: ParcelScope,
): Promise<void> {
  const onTour = (ids: string[]) => allInScope(tx, organizationId, scope, ids);
  const { patch, entityId: id } = op;
  switch (op.entity) {
    case 'parcel': {
      const [row] = await tx
        .select({ id: parcel.id })
        .from(parcel)
        .where(
          and(eq(parcel.organizationId, organizationId), eq(parcel.id, id)),
        );
      if (row && !(await onTour([id]))) offTour(op);
      return;
    }
    case 'notification': {
      const [row] = await tx
        .select({ parcelIds: notification.parcelIds })
        .from(notification)
        .where(
          and(
            eq(notification.organizationId, organizationId),
            eq(notification.id, id),
          ),
        );
      if (row && !(await onTour(row.parcelIds))) offTour(op);
      if (
        op.type === 'upsert' &&
        patch.parcelIds !== undefined &&
        !(await onTour(idsOf(patch.parcelIds)))
      ) {
        offTour(op);
      }
      return;
    }
    case 'event': {
      if (
        patch.entity === PARCEL_EVENT_ENTITY &&
        typeof patch.entityId === 'string' &&
        !(await onTour([patch.entityId]))
      ) {
        offTour(op);
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
 * router only.
 */
export async function checkReach(
  tx: AnyDb,
  op: SyncOp,
  access: Access,
): Promise<void> {
  if (op.entity === 'department') {
    refuse(op, 'is not written by a device', 'sync.op.readOnly');
  }
  if (!(await mayHandOver(tx, access))) await checkHandOver(tx, op, access);
  await checkHandoverSteps(tx, op, access);
  if (op.entity === 'directory_person' && !canWriteDirectory(access.role)) {
    refuse(op, 'is read-only for this account', 'sync.op.directoryReadOnly');
  }
  const scope = parcelScope(access);
  if (scope.kind === 'department') {
    await checkDepartment(tx, op, access, scope.departmentId);
  }
  if (scope.kind === 'tour') await checkTour(tx, op, access, scope);
}

const withoutDepartment = ({ departmentId: _dropped, ...rest }: Values) => {
  void _dropped;
  return rest;
};

/**
 * The department a row gets, and on tour who received it. A department stamps its own and cannot give a
 * parcel away. A parcel for a person follows that person (the trigger of
 * drizzle/0020): once it has a department, a copy's, perhaps stale, says
 * nothing; a new parcel or one without any takes what the agent chose at the
 * review (ME25, drizzle/0028); one without a person takes what the company's
 * accounts say. A card keeps its
 * department: a copy may predate a move, and only `directory.move` moves anyone.
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
  // A new parcel enters the tour of the shuttle that validated it; an update leaves this column alone.
  if (scope.kind === 'tour' && op.entity === 'parcel') {
    values = { ...values, receivedBy: access.userId };
  }
  if (!('departmentId' in values)) return values;
  if (op.entity === 'directory_person') {
    const [row] = await tx
      .select({ departmentId: directoryPerson.departmentId })
      .from(directoryPerson)
      .where(
        and(
          eq(directoryPerson.organizationId, access.organizationId),
          eq(directoryPerson.id, op.entityId),
        ),
      );
    if (!row) return values;
    const kept = withoutDepartment(values);
    // The word goes with the department: a stale one would name the old one on every parcel.
    if (row.departmentId) delete kept.department;
    return kept;
  }
  if (op.entity !== 'parcel') return values;
  const [row] = await tx
    .select({ personId: parcel.personId, departmentId: parcel.departmentId })
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, access.organizationId),
        eq(parcel.id, op.entityId),
      ),
    );
  const personId =
    values.personId === undefined ? row?.personId : values.personId;
  if (!personId || !row || row.departmentId === null) return values;
  return withoutDepartment(values);
}
