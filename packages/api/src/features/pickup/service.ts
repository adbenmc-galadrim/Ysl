import {
  pickupVerdict,
  type PickupVerifyInput,
  type PickupVerifyOutput,
} from '@repo/contract/pickup';
import type { AnyDb } from '@repo/db';
import {
  contact,
  department,
  directoryPerson,
  pickupCode,
} from '@repo/db/schema';
import { and, eq } from 'drizzle-orm';
import type { ParcelScope } from '#lib/access';

type Recipient = NonNullable<PickupVerifyOutput['recipient']>;

async function recipientOf(
  db: AnyDb,
  organizationId: string,
  code: { personId: string | null; contactId: string | null },
): Promise<Recipient | null> {
  if (code.personId) {
    const [person] = await db
      .select({
        firstName: directoryPerson.firstName,
        lastName: directoryPerson.lastName,
      })
      .from(directoryPerson)
      .where(
        and(
          eq(directoryPerson.organizationId, organizationId),
          eq(directoryPerson.id, code.personId),
        ),
      );
    return person
      ? {
          kind: 'person',
          id: code.personId,
          name: `${person.firstName} ${person.lastName}`.trim(),
        }
      : null;
  }
  if (!code.contactId) return null;
  const [row] = await db
    .select({ name: contact.name })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.id, code.contactId),
      ),
    );
  return row ? { kind: 'contact', id: code.contactId, name: row.name } : null;
}

/** The one code of this hash open in the company, and the counter it opens. */
async function otherDepartment(
  db: AnyDb,
  organizationId: string,
  kind: PickupVerifyInput['kind'],
  hash: string,
  now: Date,
): Promise<PickupVerifyOutput | null> {
  const rows = await db
    .select()
    .from(pickupCode)
    .where(
      and(
        eq(pickupCode.organizationId, organizationId),
        eq(kind === 'token' ? pickupCode.tokenHash : pickupCode.pinHash, hash),
      ),
    );
  const verdict = pickupVerdict(rows, now);
  if (verdict.status !== 'active' || !verdict.code.departmentId) return null;
  const { code } = verdict;
  const [home] = await db
    .select({ name: department.name, location: department.receptionPoint })
    .from(department)
    .where(
      and(
        eq(department.organizationId, organizationId),
        eq(department.id, verdict.code.departmentId),
      ),
    );
  if (!home) return null;
  const recipient =
    kind === 'token' ? await recipientOf(db, organizationId, code) : null;
  return {
    status: 'other_department',
    codeId: code.id,
    recipient: null,
    elsewhere: {
      department: home.name,
      location: home.location,
      name: recipient?.name ?? null,
    },
  };
}

/**
 * `pickup.verify` (§8.6): the server's word on a QR or a PIN of this
 * mailroom, for the desk whose own copy does not know it yet (a code a
 * colleague has just issued) or may be behind (used on another iPhone).
 * The same rule as on the iPhone (`pickupVerdict`); nothing is written,
 * the handover alone uses a code. A department opens its own codes only:
 * another's is `unknown` on its iPhone, and here `other_department` for a
 * client that can say so, to send the employee to the right counter.
 */
export async function verifyPickup(
  db: AnyDb,
  organizationId: string,
  { kind, hash, elsewhere }: PickupVerifyInput,
  now = new Date(),
  scope: ParcelScope = { kind: 'company' },
): Promise<PickupVerifyOutput> {
  const rows = await db
    .select()
    .from(pickupCode)
    .where(
      and(
        eq(pickupCode.organizationId, organizationId),
        eq(kind === 'token' ? pickupCode.tokenHash : pickupCode.pinHash, hash),
        scope.kind === 'department'
          ? eq(pickupCode.departmentId, scope.departmentId)
          : undefined,
      ),
    );
  if (rows.length === 0 && elsewhere && scope.kind === 'department') {
    const other = await otherDepartment(db, organizationId, kind, hash, now);
    if (other) return other;
  }
  const verdict = pickupVerdict(rows, now);
  const code =
    verdict.status === 'active'
      ? verdict.code
      : verdict.status === 'ambiguous'
        ? undefined
        : [...rows].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          )[0];
  return {
    status: verdict.status,
    codeId: code?.id ?? null,
    recipient: code ? await recipientOf(db, organizationId, code) : null,
  };
}
