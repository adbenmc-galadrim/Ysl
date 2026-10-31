import { UNFINISHED_STATUSES } from '@repo/contract/parcel-status';
import { toUserRole } from '@repo/contract/auth';
import type {
  AttachDepartmentAccountInput,
  CreateDepartmentInput,
  Department,
  UpdateDepartmentInput,
} from '@repo/contract/departments';
import type { PickupSetting } from '@repo/contract/settings';
import { parsePickup } from '@repo/contract/settings';
import type { AnyDb } from '@repo/db';
import {
  department,
  departmentMember,
  directoryPerson,
  organizationMember,
  parcel,
  user,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { sqlState } from '#features/sync/errors';

const translate = createTranslator(DEFAULT_LOCALE);

const UNIQUE_VIOLATION = '23505';

type Row = typeof department.$inferSelect;

function toDepartment(row: Row): Department {
  return {
    id: row.id,
    name: row.name,
    receptionPoint: row.receptionPoint,
    pickup: parsePickup(row.pickup),
  };
}

function notFound(): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: translate('departments.error.notFound'),
  });
}

async function nameGuarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (sqlState(error) !== UNIQUE_VIOLATION) throw error;
    throw new TRPCError({
      code: 'CONFLICT',
      message: translate('departments.error.nameTaken'),
    });
  }
}

function active(organizationId: string, id: string) {
  return and(
    eq(department.organizationId, organizationId),
    eq(department.id, id),
    isNull(department.deletedAt),
  );
}

export async function listDepartments(
  db: AnyDb,
  organizationId: string,
  onlyId?: string,
): Promise<Department[]> {
  const rows = await db
    .select()
    .from(department)
    .where(
      and(
        eq(department.organizationId, organizationId),
        isNull(department.deletedAt),
        onlyId === undefined ? undefined : eq(department.id, onlyId),
      ),
    )
    .orderBy(asc(department.name));
  return rows.map(toDepartment);
}

export async function createDepartment(
  db: AnyDb,
  organizationId: string,
  input: CreateDepartmentInput,
): Promise<Department> {
  const [row] = await nameGuarded(() =>
    db
      .insert(department)
      .values({
        id: newId(),
        organizationId,
        name: input.name,
        receptionPoint: input.receptionPoint,
        pickup: input.pickup ?? null,
      })
      .returning(),
  );
  if (!row) throw notFound();
  return toDepartment(row);
}

export async function updateDepartment(
  db: AnyDb,
  organizationId: string,
  input: UpdateDepartmentInput,
): Promise<Department> {
  const [row] = await nameGuarded(() =>
    db
      .update(department)
      .set({
        name: input.name,
        receptionPoint: input.receptionPoint,
        updatedAt: new Date(),
      })
      .where(active(organizationId, input.id))
      .returning(),
  );
  if (!row) throw notFound();
  return toDepartment(row);
}

export async function updateDepartmentPickup(
  db: AnyDb,
  organizationId: string,
  id: string,
  pickup: PickupSetting,
): Promise<Department> {
  const [row] = await db
    .update(department)
    .set({ pickup, updatedAt: new Date() })
    .where(active(organizationId, id))
    .returning();
  if (!row) throw notFound();
  return toDepartment(row);
}

export async function archiveDepartment(
  db: AnyDb,
  organizationId: string,
  id: string,
): Promise<void> {
  const [member] = await db
    .select({ userId: departmentMember.userId })
    .from(departmentMember)
    .where(
      and(
        eq(departmentMember.organizationId, organizationId),
        eq(departmentMember.departmentId, id),
      ),
    )
    .limit(1);
  if (member) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: translate('departments.error.hasMembers'),
    });
  }
  // New parcels would still follow its people there, and nobody could hand them over.
  const [person] = await db
    .select({ id: directoryPerson.id })
    .from(directoryPerson)
    .where(
      and(
        eq(directoryPerson.organizationId, organizationId),
        eq(directoryPerson.departmentId, id),
        isNull(directoryPerson.deletedAt),
      ),
    )
    .limit(1);
  const [waiting] = await db
    .select({ id: parcel.id })
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        eq(parcel.departmentId, id),
        isNull(parcel.deletedAt),
        inArray(parcel.status, UNFINISHED_STATUSES),
      ),
    )
    .limit(1);
  if (person || waiting) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: translate('departments.error.inUse'),
    });
  }
  const [row] = await db
    .update(department)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(active(organizationId, id))
    .returning({ id: department.id });
  if (!row) throw notFound();
}

export async function attachDepartmentAccount(
  db: AnyDb,
  organizationId: string,
  input: AttachDepartmentAccountInput,
): Promise<void> {
  const [account] = await db
    .select({ role: user.role })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, input.userId),
      ),
    );
  if (!account) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: translate('departments.error.accountNotFound'),
    });
  }
  if (input.departmentId === null) {
    await db
      .delete(departmentMember)
      .where(eq(departmentMember.userId, input.userId));
    return;
  }
  if (toUserRole(account.role) !== 'department') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: translate('departments.error.notDepartmentAccount'),
    });
  }
  const [target] = await db
    .select({ id: department.id })
    .from(department)
    .where(active(organizationId, input.departmentId));
  if (!target) throw notFound();
  await db
    .insert(departmentMember)
    .values({
      userId: input.userId,
      organizationId,
      departmentId: input.departmentId,
    })
    .onConflictDoUpdate({
      target: departmentMember.userId,
      set: { departmentId: input.departmentId },
    });
}
