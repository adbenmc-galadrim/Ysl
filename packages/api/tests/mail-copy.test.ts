import type { PGlite } from '@electric-sql/pglite';
import {
  newPickupToken,
  pickupPinHash,
  pickupTokenHash,
} from '@repo/contract/pickup';
import { SYNCED_ENTITIES } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, eq, isNull } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { brevoMailer } from '#features/mail/brevo';
import { sendPickupCopy } from '#features/mail/copy';
import {
  forgetClosedSecrets,
  openPickupSecret,
  sealPickupSecret,
} from '#features/mail/pickup-secret';
import { drainEmailOutbox } from '#features/mail/queue';
import { prepareServerMails } from '#features/mail/server-send';
import { startFakeBrevo } from './helpers/fake-brevo';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

const server = vi.hoisted(() => ({ on: true }));
vi.mock('#features/mail/config', () => ({
  serverMailEnabled: () => server.on,
}));

const {
  department,
  directoryPerson,
  emailOutbox,
  emailSuppression,
  event,
  notification,
  parcel,
  pickupCode,
  pickupSecret,
} = schema;

const NOW = new Date('2026-10-26T09:00:00Z');
const LATER = new Date('2026-10-26T10:00:00Z');
const DELEGATE = 'paul.mercier@example.test';

let client: PGlite;
let db: TestDb;
let brevo: Awaited<ReturnType<typeof startFakeBrevo>>;
let mailer: ReturnType<typeof brevoMailer>;
let finance: string;
let studio: string;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  brevo = await startFakeBrevo();
  mailer = brevoMailer({
    apiKey: 'test-key',
    from: { email: 'courrier@plateforme.test', name: 'Courrier' },
    fetch: brevo.fetch,
  });
  finance = newId();
  studio = newId();
  await db.insert(department).values([
    { id: finance, organizationId: ORGANIZATION_ID, name: 'Finance' },
    { id: studio, organizationId: ORGANIZATION_ID, name: 'Studio' },
  ]);
}, 60_000);

afterAll(async () => {
  await brevo.close();
  await client.close();
});

beforeEach(async () => {
  server.on = true;
  brevo.sent.length = 0;
  await db.delete(emailOutbox);
  await db.delete(emailSuppression);
});

const any = () => asAnyDb(db);

async function addPerson() {
  const id = newId();
  await db.insert(directoryPerson).values({
    id,
    organizationId: ORGANIZATION_ID,
    departmentId: finance,
    firstName: 'Nora',
    lastName: 'Haddad',
    nameNorm: 'haddad nora',
    email: `${id}@example.test`,
  });
  return id;
}

async function addParcel(personId: string, fields: object = {}) {
  const row = {
    ...parcelRow(),
    personId,
    departmentId: finance,
    carrier: 'UPS',
    tracking: '1Z999AA10123456784',
    ...fields,
  };
  await db.insert(parcel).values(row as typeof parcel.$inferInsert);
  return row.id;
}

async function request(
  personId: string,
  parcelIds: string[],
  type: 'avis' | 'relance' = 'avis',
  at = NOW,
) {
  await db.insert(notification).values({
    id: newId(),
    organizationId: ORGANIZATION_ID,
    type,
    personId,
    recipients: ['ignored@example.test'],
    parcelIds,
    status: 'prepared',
    channel: 'server',
    preparedAt: at,
    preparedBy: AGENT_ID,
  });
}

async function round(now = NOW) {
  await prepareServerMails(any(), { now });
  await db.update(emailOutbox).set({ nextAttemptAt: now });
  return drainEmailOutbox(any(), mailer, { now: () => now });
}

/** A parcel told by the server: its mail left, the code open. */
async function notified() {
  const person = await addPerson();
  const id = await addParcel(person);
  await request(person, [id]);
  await round();
  const first = brevo.sent[0]!;
  brevo.sent.length = 0;
  return { person, id, first };
}

async function drain() {
  await db.update(emailOutbox).set({ nextAttemptAt: LATER });
  return drainEmailOutbox(any(), mailer, { now: () => LATER });
}

const copy = (parcelIds: string[], fields: object = {}) =>
  sendPickupCopy(
    any(),
    {
      organizationId: ORGANIZATION_ID,
      agentId: AGENT_ID,
      scope: { kind: 'company' },
      parcelIds,
      address: DELEGATE,
      name: 'Paul Mercier',
      ...fields,
    },
    { now: LATER },
  );

const openCodes = (person: string) =>
  db
    .select()
    .from(pickupCode)
    .where(and(eq(pickupCode.personId, person), isNull(pickupCode.deletedAt)));

describe('the sealed secret', () => {
  it('stays off the sync', () => {
    expect(SYNCED_ENTITIES).not.toContain('pickup_secret');
  });

  it('opens for its own code only, and holds nothing in clear', () => {
    const clear = { pin: '4821', token: newPickupToken() };
    const sealed = sealPickupSecret('code-a', clear);
    expect(openPickupSecret('code-a', sealed)).toEqual(clear);
    expect(openPickupSecret('code-b', sealed)).toBeNull();
    expect(sealed).not.toContain(clear.pin);
    expect(Buffer.from(sealed, 'base64').toString('latin1')).not.toContain(
      clear.token,
    );
  });
});

describe('a copy after the mail left', () => {
  it('carries the very same QR and PIN, and draws nothing', async () => {
    const { person, id, first } = await notified();
    const before = await openCodes(person);

    expect(await copy([id])).toEqual({ status: 'qr' });
    await drain();

    const [sent] = brevo.sent;
    expect(sent!.to[0]!.email).toBe(DELEGATE);
    expect(sent!.textContent).toContain('Copie pour Paul Mercier');
    expect(sent!.attachment?.[0]?.content).toBe(first.attachment?.[0]?.content);
    expect(/(\d{4})/.exec(sent!.textContent)![1]).toBe(
      /(\d{4})/.exec(first.textContent)![1],
    );
    expect(await openCodes(person)).toEqual(before);
    const types = await db.select().from(event).where(eq(event.entityId, id));
    expect(types.map((row) => row.type)).toContain('parcel.copied');
    const [row] = await db
      .select()
      .from(notification)
      .where(eq(notification.personId, person));
    expect(row?.deliveryStatus ?? null).toBeNull();
  });

  it('wipes the code in clear from the queue once it left', async () => {
    const { id } = await notified();
    await copy([id]);
    await drain();
    const [row] = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.recipient, DELEGATE));
    expect(row).toMatchObject({ status: 'sent', textBody: '', htmlBody: null });
  });

  it('may be asked again after a copy that failed', async () => {
    const { id } = await notified();
    await copy([id]);
    await db
      .update(emailOutbox)
      .set({ status: 'failed' })
      .where(eq(emailOutbox.recipient, DELEGATE));

    expect(await copy([id])).toEqual({ status: 'qr' });
    expect(await drain()).toMatchObject({ sent: 1 });
    expect(brevo.sent.map((mail) => mail.to[0]!.email)).toEqual([DELEGATE]);
  });

  it('falls back on the PIN when the secret does not open', async () => {
    const { id, person } = await notified();
    const [code] = await openCodes(person);
    await db
      .update(pickupSecret)
      .set({
        sealed: sealPickupSecret('another-code', { pin: '0000', token: 't' }),
      })
      .where(eq(pickupSecret.codeId, code!.id));

    expect(await copy([id])).toEqual({ status: 'pin' });
  });

  it('goes once to an address for a code', async () => {
    const { id } = await notified();
    await copy([id]);
    expect(await copy([id])).toEqual({ status: 'already' });
    expect(await drain()).toMatchObject({
      sent: 1,
    });
  });

  it('quotes the PIN alone when a phone drew the code', async () => {
    const person = await addPerson();
    const id = await addParcel(person, {
      status: 'notifie',
      notifiedAt: NOW,
      lastNotifiedAt: NOW,
    });
    await db.insert(pickupCode).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      personId: person,
      departmentId: finance,
      tokenHash: await pickupTokenHash(newPickupToken()),
      pinHash: await pickupPinHash('7302'),
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    });

    expect(await copy([id])).toEqual({ status: 'pin' });
    await drain();

    expect(brevo.sent[0]!.textContent).toContain('7302');
    expect(brevo.sent[0]!.attachment).toBeUndefined();
    expect(brevo.sent[0]!.htmlContent).not.toContain('<table');
  });

  it.each([['off', () => (server.on = false)]])(
    'sends nothing with the server sending %s',
    async (status, arrange) => {
      const { id } = await notified();
      arrange();
      expect(await copy([id])).toEqual({ status });
      expect(
        await db
          .select()
          .from(emailOutbox)
          .where(eq(emailOutbox.recipient, DELEGATE)),
      ).toHaveLength(0);
    },
  );

  it('refuses an unsubscribed address', async () => {
    const { id } = await notified();
    await db.insert(emailSuppression).values({
      organizationId: ORGANIZATION_ID,
      email: DELEGATE,
      reason: 'unsubscribed',
      at: NOW,
    });
    expect(await copy([id])).toEqual({ status: 'unsubscribed' });
  });

  it('refuses a parcel of another department or of another recipient', async () => {
    const { id } = await notified();
    expect(
      await copy([id], {
        scope: { kind: 'department', departmentId: studio },
      }),
    ).toEqual({ status: 'notFound' });
    const other = await notified();
    expect(await copy([id, other.id])).toEqual({ status: 'notFound' });
  });

  it('says so when no code is open', async () => {
    const { person, id } = await notified();
    await db
      .update(pickupCode)
      .set({ deletedAt: LATER })
      .where(eq(pickupCode.personId, person));
    expect(await copy([id])).toEqual({ status: 'noCode' });
  });
});

describe('a later mail', () => {
  it('hands the new code to whoever holds a copy', async () => {
    const { person, id } = await notified();
    await copy([id]);
    await drain();
    brevo.sent.length = 0;

    const next = new Date(LATER.getTime() + 2 * 3_600_000);
    await request(person, [id], 'relance', next);
    await round(next);

    const to = (address: string) =>
      brevo.sent.find((mail) => mail.to[0]!.email === address);
    const held = to(DELEGATE);
    const own = brevo.sent.find((mail) => mail.to[0]!.email !== DELEGATE);
    expect(held?.attachment?.[0]?.content).toBe(own?.attachment?.[0]?.content);
    expect(held?.textContent).toContain('Copie pour Paul Mercier');
    const [code] = await openCodes(person);
    const [secret] = await db
      .select()
      .from(pickupSecret)
      .where(eq(pickupSecret.codeId, code!.id));
    expect(secret?.copiedTo).toEqual([
      { address: DELEGATE, name: 'Paul Mercier' },
    ]);
  });

  it('holds back a copy whose code closed while it waited', async () => {
    const { person, id } = await notified();
    await copy([id]);
    await db
      .update(pickupCode)
      .set({ usedAt: LATER })
      .where(eq(pickupCode.personId, person));

    expect(await drain()).toMatchObject({ sent: 0, failed: 1 });
    expect(brevo.sent).toHaveLength(0);
  });
});

describe('forgetClosedSecrets', () => {
  it('drops a used code, keeps a withdrawn one the three days a failure may bring it back', async () => {
    const { person } = await notified();
    const [code] = await openCodes(person);
    const has = async () =>
      (
        await db
          .select()
          .from(pickupSecret)
          .where(eq(pickupSecret.codeId, code!.id))
      ).length;

    await db
      .update(pickupCode)
      .set({ deletedAt: LATER })
      .where(eq(pickupCode.id, code!.id));
    await forgetClosedSecrets(any(), LATER);
    expect(await has()).toBe(1);
    await forgetClosedSecrets(
      any(),
      new Date(LATER.getTime() + 4 * 86_400_000),
    );
    expect(await has()).toBe(0);
  });
});
