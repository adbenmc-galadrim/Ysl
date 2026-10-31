import {
  type MoveEffects,
  type MovePersonInput,
  type MoveRequest,
  PARCEL_ON_MOVE,
  type RequestMoveInput,
} from '@repo/contract/directory';
import type { AnyDb } from '@repo/db';
import {
  department,
  directoryMoveRequest,
  directoryPerson,
  parcel,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { parcelScope, type Access } from '#lib/access';

const translate = createTranslator(DEFAULT_LOCALE);

function personNotFound(): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: translate('directory.error.personNotFound'),
  });
}

function departmentNotFound(): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: translate('departments.error.notFound'),
  });
}

async function personIn(tx: AnyDb, organizationId: string, personId: string) {
  const [row] = await tx
    .select({
      departmentId: directoryPerson.departmentId,
      email: directoryPerson.email,
    })
    .from(directoryPerson)
    .where(
      and(
        eq(directoryPerson.organizationId, organizationId),
        eq(directoryPerson.id, personId),
        isNull(directoryPerson.deletedAt),
      ),
    );
  if (!row) throw personNotFound();
  return row;
}

/** What moving this person would do to their parcels, for the admin to read first. */
export async function moveEffectsOf(
  tx: AnyDb,
  organizationId: string,
  personId: string,
): Promise<MoveEffects> {
  await personIn(tx, organizationId, personId);
  const rows = await tx
    .select({ status: parcel.status })
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        eq(parcel.personId, personId),
        isNull(parcel.deletedAt),
      ),
    );
  const count = (outcome: 'follows' | 'toSettle') =>
    rows.filter((row) => PARCEL_ON_MOVE[row.status] === outcome).length;
  return { follows: count('follows'), toSettle: count('toSettle') };
}

/**
 * Moves a person to another department. The server alone does it: a device's
 * copy of the card may be stale (`departmentWrite`). Their parcels and codes
 * follow by the trigger of drizzle/0021, so every other path gets the same rule.
 */
export async function movePerson(
  db: AnyDb,
  organizationId: string,
  { personId, departmentId }: MovePersonInput,
): Promise<MoveEffects> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ name: department.name })
      .from(department)
      .where(
        and(
          eq(department.organizationId, organizationId),
          eq(department.id, departmentId),
          isNull(department.deletedAt),
        ),
      );
    if (!target) throw departmentNotFound();
    const person = await personIn(tx, organizationId, personId);
    if (person.departmentId === departmentId) {
      return { follows: 0, toSettle: 0 };
    }
    // A department may have added the same address itself, without being able to know.
    const [twin] = await tx
      .select({ id: directoryPerson.id })
      .from(directoryPerson)
      .where(
        and(
          eq(directoryPerson.organizationId, organizationId),
          eq(directoryPerson.departmentId, departmentId),
          ne(directoryPerson.id, personId),
          eq(sql`lower(${directoryPerson.email})`, person.email.toLowerCase()),
          isNull(directoryPerson.deletedAt),
        ),
      );
    if (twin) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: translate('directory.error.sameAddress', {
          department: target.name,
        }),
      });
    }
    const effects = await moveEffectsOf(tx, organizationId, personId);
    await tx
      .update(directoryPerson)
      .set({ departmentId, department: target.name, updatedAt: new Date() })
      .where(
        and(
          eq(directoryPerson.organizationId, organizationId),
          eq(directoryPerson.id, personId),
        ),
      );
    return effects;
  });
}

const scopedToDepartment = (access: Access) => {
  const scope = parcelScope(access);
  return scope.kind === 'department'
    ? eq(directoryMoveRequest.departmentId, scope.departmentId)
    : undefined;
};

/**
 * Tells the admin one of the department's people should go elsewhere. Someone
 * of another department answers as someone who does not exist. Asking again
 * replaces the note.
 */
export async function requestMove(
  db: AnyDb,
  access: Access,
  { personId, note }: RequestMoveInput,
): Promise<void> {
  const scope = parcelScope(access);
  if (scope.kind !== 'department') throw personNotFound();
  const { organizationId, userId } = access;
  const person = await personIn(db, organizationId, personId);
  if (person.departmentId !== scope.departmentId) throw personNotFound();
  const values = {
    departmentId: scope.departmentId,
    requestedBy: userId,
    note: note || null,
    createdAt: new Date(),
  };
  await db
    .insert(directoryMoveRequest)
    .values({ id: newId(), organizationId, personId, ...values })
    .onConflictDoUpdate({
      target: [directoryMoveRequest.organizationId, directoryMoveRequest.personId],
      targetWhere: isNull(directoryMoveRequest.closedAt),
      set: values,
    });
}

/**
 * The requests still open, oldest first: all of them for the admin, its own
 * for a department. One whose person has left the department is over, however
 * they moved (`directory.move`, the import).
 */
export async function moveRequestsOf(
  db: AnyDb,
  access: Access,
): Promise<MoveRequest[]> {
  return db
    .select({
      personId: directoryMoveRequest.personId,
      departmentId: directoryMoveRequest.departmentId,
      departmentName: department.name,
      note: directoryMoveRequest.note,
      createdAt: directoryMoveRequest.createdAt,
    })
    .from(directoryMoveRequest)
    .innerJoin(
      directoryPerson,
      and(
        eq(directoryPerson.organizationId, directoryMoveRequest.organizationId),
        eq(directoryPerson.id, directoryMoveRequest.personId),
        eq(directoryPerson.departmentId, directoryMoveRequest.departmentId),
        isNull(directoryPerson.deletedAt),
      ),
    )
    .innerJoin(
      department,
      and(
        eq(department.organizationId, directoryMoveRequest.organizationId),
        eq(department.id, directoryMoveRequest.departmentId),
      ),
    )
    .where(
      and(
        eq(directoryMoveRequest.organizationId, access.organizationId),
        isNull(directoryMoveRequest.closedAt),
        scopedToDepartment(access),
      ),
    )
    .orderBy(asc(directoryMoveRequest.createdAt));
}

/** Dismissed by the admin, or withdrawn by the department that asked. */
export async function closeMoveRequest(
  db: AnyDb,
  access: Access,
  personId: string,
): Promise<void> {
  await db
    .update(directoryMoveRequest)
    .set({ closedAt: new Date() })
    .where(
      and(
        eq(directoryMoveRequest.organizationId, access.organizationId),
        eq(directoryMoveRequest.personId, personId),
        isNull(directoryMoveRequest.closedAt),
        scopedToDepartment(access),
      ),
    );
}
