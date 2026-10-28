import {
  pickupVerdict,
  type PickupVerifyInput,
  type PickupVerifyOutput,
} from '@repo/contract/pickup';
import type { AnyDb } from '@repo/db';
import { contact, directoryPerson, pickupCode } from '@repo/db/schema';
import { and, eq } from 'drizzle-orm';

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

/**
 * `pickup.verify` (§8.6): the server's word on a QR or a PIN of this
 * mailroom, for the desk whose own copy does not know it yet (a code a
 * colleague has just issued) or may be behind (used on another iPhone).
 * The same rule as on the iPhone (`pickupVerdict`); nothing is written,
 * the handover alone uses a code.
 */
export async function verifyPickup(
  db: AnyDb,
  organizationId: string,
  { kind, hash }: PickupVerifyInput,
  now = new Date(),
): Promise<PickupVerifyOutput> {
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
