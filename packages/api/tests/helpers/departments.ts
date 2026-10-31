import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { AGENT_ID, ORGANIZATION_ID, type TestDb } from './pglite';
import type { Access } from '#lib/access';

/** The accounts of the company of `openTestDb`, as each role reaches it. */
export function accessOf(
  role: Access['role'],
  departmentId: string | null = null,
): Access {
  return {
    organizationId: ORGANIZATION_ID,
    userId: AGENT_ID,
    role,
    departmentId,
  };
}

export async function addDepartment(
  db: TestDb,
  name: string,
  organizationId = ORGANIZATION_ID,
) {
  const id = newId();
  await db.insert(schema.department).values({ id, organizationId, name });
  return id;
}

export async function addPerson(
  db: TestDb,
  departmentId: string | null,
  organizationId = ORGANIZATION_ID,
) {
  const id = newId();
  await db.insert(schema.directoryPerson).values({
    id,
    organizationId,
    lastName: 'Haddad',
    firstName: 'Nora',
    nameNorm: 'nora haddad',
    email: `nora.${id}@example.test`,
    departmentId,
  });
  return id;
}

export async function addContact(db: TestDb, createdBy: string | null = null) {
  const id = newId();
  await db.insert(schema.contact).values({
    id,
    organizationId: ORGANIZATION_ID,
    name: 'Marc',
    nameNorm: 'marc',
    createdBy,
  });
  return id;
}
