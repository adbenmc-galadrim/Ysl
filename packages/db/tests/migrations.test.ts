import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@repo/shared/id';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

const client = new PGlite();
const db = drizzle({ client, schema });

const agentId = 'agent-1';

function newPerson(email: string) {
  return {
    id: newId(),
    lastName: 'Martin',
    firstName: 'Camille',
    email,
    source: 'csv' as const,
  };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await db
    .insert(schema.user)
    .values({ id: agentId, name: 'Agent', email: 'agent@example.test' });
});

afterAll(async () => {
  await client.close();
});

describe('migrations', () => {
  it('create every table of the initial schema on an empty database', async () => {
    const { rows } = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );

    expect(rows.map((row) => row.tablename)).toEqual(
      expect.arrayContaining([
        'directory_person',
        'contact',
        'sender',
        'sender_account',
        'batch',
        'parcel',
        'email_template',
        'notification',
        'pickup_code',
        'handover',
        'event',
        'setting',
      ]),
    );
  });

  it('bump the sync cursor on insert and update of every synced table', async () => {
    const { rows: synced } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.columns where table_schema = 'public' and column_name = 'server_seq'",
    );
    const { rows: bumped } = await client.query<{ relname: string }>(
      `select c.relname
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_proc p on p.oid = t.tgfoid
        where p.proname = 'bump_server_seq'
          and not t.tgisinternal
          and t.tgtype & 23 = 23`,
    );

    expect(synced).toHaveLength(12);
    expect(bumped.map((row) => row.relname).sort()).toEqual(
      synced.map((row) => row.table_name).sort(),
    );
  });

  it('leave identifiers to the client', async () => {
    await expect(
      client.query("insert into contact (name) values ('Sans identifiant')"),
    ).rejects.toThrow();
  });

  it('move the sync cursor forward on every write', async () => {
    const id = newId();
    const [inserted] = await db
      .insert(schema.parcel)
      .values({
        id,
        status: 'recu',
        receivedAt: new Date(),
        receivedBy: agentId,
        serverSeq: 1_000_000,
      })
      .returning();
    const [updated] = await db
      .update(schema.parcel)
      .set({ notes: 'Étagère B' })
      .where(eq(schema.parcel.id, id))
      .returning();

    expect(inserted?.id).toBe(id);
    expect(inserted?.serverSeq).toBeLessThan(1_000_000);
    expect(updated?.serverSeq).toBeGreaterThan(inserted?.serverSeq ?? 0);

    const [setting] = await db
      .insert(schema.setting)
      .values({ id: newId(), key: 'pickup_hours', value: '9 h - 12 h' })
      .returning();

    expect(setting?.serverSeq).toBeGreaterThan(updated?.serverSeq ?? 0);
  });

  it('refuse a parcel addressed to both a person and a contact', async () => {
    const person = newPerson('camille.martin@example.test');
    const contactId = newId();
    await db.insert(schema.directoryPerson).values(person);
    await db
      .insert(schema.contact)
      .values({ id: contactId, name: 'Livreur du traiteur' });

    await expect(
      db.insert(schema.parcel).values({
        id: newId(),
        status: 'recu',
        personId: person.id,
        contactId,
        receivedAt: new Date(),
        receivedBy: agentId,
      }),
    ).rejects.toThrow();
  });

  it('refuse two directory entries with the same email, deleted ones aside', async () => {
    const first = newPerson('dominique.durand@example.test');
    await db.insert(schema.directoryPerson).values(first);

    await expect(
      db
        .insert(schema.directoryPerson)
        .values(newPerson('Dominique.Durand@example.test')),
    ).rejects.toThrow();

    await db
      .update(schema.directoryPerson)
      .set({ deletedAt: new Date() })
      .where(eq(schema.directoryPerson.id, first.id));

    await expect(
      db
        .insert(schema.directoryPerson)
        .values(newPerson('Dominique.Durand@example.test')),
    ).resolves.toBeDefined();
  });

  it('keep one setting per key, deleted ones aside', async () => {
    const firstId = newId();
    await db
      .insert(schema.setting)
      .values({ id: firstId, key: 'reminder_days', value: [2, 5] });

    await expect(
      db
        .insert(schema.setting)
        .values({ id: newId(), key: 'reminder_days', value: [3] }),
    ).rejects.toThrow();

    await db
      .update(schema.setting)
      .set({ deletedAt: new Date() })
      .where(eq(schema.setting.id, firstId));

    await expect(
      db
        .insert(schema.setting)
        .values({ id: newId(), key: 'reminder_days', value: [3] }),
    ).resolves.toBeDefined();
  });

  it('keep one active pickup code per person', async () => {
    const person = newPerson('alex.petit@example.test');
    await db.insert(schema.directoryPerson).values(person);
    const code = (tokenHash: string) => ({
      id: newId(),
      personId: person.id,
      tokenHash,
      pinHash: 'pin-hash',
      expiresAt: new Date(),
    });
    const first = code('token-1');
    await db.insert(schema.pickupCode).values(first);

    await expect(
      db.insert(schema.pickupCode).values(code('token-2')),
    ).rejects.toThrow();

    await db
      .update(schema.pickupCode)
      .set({ usedAt: new Date() })
      .where(eq(schema.pickupCode.id, first.id));

    await expect(
      db.insert(schema.pickupCode).values(code('token-3')),
    ).resolves.toBeDefined();
  });

  it('keep one default email template per owner and type', async () => {
    const template = () => ({
      id: newId(),
      type: 'avis' as const,
      name: 'Avis de passage',
      subject: 'Colis en attente',
      body: 'Bonjour',
      isDefault: true,
      ownerId: agentId,
    });
    await db.insert(schema.emailTemplate).values(template());

    await expect(
      db.insert(schema.emailTemplate).values(template()),
    ).rejects.toThrow();
  });

  it('refuse a pickup code that covers nobody', async () => {
    await expect(
      db.insert(schema.pickupCode).values({
        id: newId(),
        tokenHash: 'token-hash',
        pinHash: 'pin-hash',
        expiresAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('keep one sender per carrier account, deleted ones aside', async () => {
    const senderId = newId();
    await db.insert(schema.sender).values({
      id: senderId,
      displayName: 'Atelier Nord',
      nameNorm: 'atelier nord',
    });
    const account = {
      carrier: 'ups',
      accountNumber: '1A2B3C',
      senderId,
    };
    const firstId = newId();
    await db.insert(schema.senderAccount).values({ id: firstId, ...account });

    await expect(
      db.insert(schema.senderAccount).values({ id: newId(), ...account }),
    ).rejects.toThrow();

    await db
      .update(schema.senderAccount)
      .set({ deletedAt: new Date() })
      .where(eq(schema.senderAccount.id, firstId));

    await expect(
      db.insert(schema.senderAccount).values({ id: newId(), ...account }),
    ).resolves.toBeDefined();
  });
});
