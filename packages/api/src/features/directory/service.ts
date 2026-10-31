import {
  type MoveEffects,
  type MovePersonInput,
  PARCEL_ON_MOVE,
} from '@repo/contract/directory';
import type { AnyDb } from '@repo/db';
import { department, directoryPerson, parcel } from '@repo/db/schema';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';

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
