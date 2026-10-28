import type { PGlite } from '@electric-sql/pglite';
import {
  newPickupToken,
  PICKUP_CODE_TTL_MS,
  pickupPinHash,
  pickupTokenHash,
} from '@repo/contract/pickup';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifyPickup } from '#features/pickup/service';
import {
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;

const NOW = new Date('2026-10-28T10:00:00Z');
const LATER = new Date(NOW.getTime() + 60_000);

beforeAll(async () => {
  ({ client, db } = await openTestDb());
});

afterAll(async () => {
  await client.close();
});

async function person(organizationId = ORGANIZATION_ID) {
  const id = newId();
  await db.insert(schema.directoryPerson).values({
    id,
    organizationId,
    lastName: 'Haddad',
    firstName: 'Nora',
    nameNorm: 'nora haddad',
    email: `nora.${id}@example.test`,
  });
  return id;
}

async function code(
  recipient: { personId?: string; contactId?: string },
  {
    token = newPickupToken(),
    pin = '4821',
    organizationId = ORGANIZATION_ID,
    ...overrides
  }: Partial<typeof schema.pickupCode.$inferInsert> & {
    token?: string;
    pin?: string;
  } = {},
) {
  const row = {
    id: newId(),
    organizationId,
    createdAt: NOW,
    ...recipient,
    tokenHash: await pickupTokenHash(token),
    pinHash: await pickupPinHash(pin),
    expiresAt: new Date(NOW.getTime() + PICKUP_CODE_TTL_MS),
    ...overrides,
  };
  await db.insert(schema.pickupCode).values(row);
  return row;
}

const verify = (kind: 'token' | 'pin', hash: string) =>
  verifyPickup(asAnyDb(db), ORGANIZATION_ID, { kind, hash }, LATER);

describe('pickup.verify', () => {
  it('names whose QR it is, and leaves the code open', async () => {
    const nora = await person();
    const token = newPickupToken();
    const open = await code({ personId: nora }, { token });

    const answer = await verify('token', await pickupTokenHash(token));
    const [stored] = await db.select().from(schema.pickupCode);

    expect(answer).toEqual({
      status: 'active',
      codeId: open.id,
      recipient: { kind: 'person', id: nora, name: 'Nora Haddad' },
    });
    expect(stored?.usedAt).toBeNull();
  });

  it('says a contact’s PIN, and why a code no longer opens', async () => {
    const contactId = newId();
    await db.insert(schema.contact).values({
      id: contactId,
      organizationId: ORGANIZATION_ID,
      name: 'Marc Petit',
      nameNorm: 'marc petit',
    });
    await code({ contactId }, { pin: '1357' });
    const used = await code(
      { personId: await person() },
      { pin: '2468', usedAt: NOW },
    );

    expect(await verify('pin', await pickupPinHash('1357'))).toMatchObject({
      status: 'active',
      recipient: { kind: 'contact', id: contactId, name: 'Marc Petit' },
    });
    expect(await verify('pin', await pickupPinHash('2468'))).toMatchObject({
      status: 'used',
      codeId: used.id,
    });
  });

  it('names nobody for a PIN two open codes share', async () => {
    await code({ personId: await person() }, { pin: '9090' });
    await code({ personId: await person() }, { pin: '9090' });

    expect(await verify('pin', await pickupPinHash('9090'))).toEqual({
      status: 'ambiguous',
      codeId: null,
      recipient: null,
    });
  });

  it('knows nothing of another mailroom’s codes', async () => {
    const token = newPickupToken();
    await code(
      { personId: await person(OTHER_ORGANIZATION_ID) },
      { token, organizationId: OTHER_ORGANIZATION_ID },
    );

    expect(await verify('token', await pickupTokenHash(token))).toEqual({
      status: 'unknown',
      codeId: null,
      recipient: null,
    });
  });
});
