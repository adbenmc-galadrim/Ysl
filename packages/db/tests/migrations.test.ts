import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@repo/shared/id';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

const client = new PGlite();
const db = drizzle({ client, schema });

const agentId = 'agent-1';
const organizationId = newId();
const otherOrganizationId = newId();
const org = { organizationId };

async function expectViolation(write: Promise<unknown>, constraint: string) {
  const error: unknown = await write.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  const cause = (error as { cause?: { message?: string; constraint?: string } })
    ?.cause;
  expect(
    [cause?.constraint, cause?.message, (error as Error)?.message].join(' '),
  ).toContain(constraint);
}

function newPerson(email: string, organization = organizationId) {
  return {
    id: newId(),
    organizationId: organization,
    lastName: 'Martin',
    firstName: 'Camille',
    nameNorm: 'martin camille',
    email,
  };
}

function newParcel() {
  return {
    id: newId(),
    ...org,
    status: 'recu' as const,
    receivedAt: new Date(),
    receivedBy: agentId,
  };
}

async function serverXidOf(id: string) {
  const [row] = await db
    .select({ serverXid: schema.parcel.serverXid })
    .from(schema.parcel)
    .where(eq(schema.parcel.id, id));
  return row?.serverXid;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await db.insert(schema.organization).values([
    { id: organizationId, name: 'Service courrier' },
    { id: otherOrganizationId, name: 'Autre client' },
  ]);
  await db
    .insert(schema.user)
    .values({ id: agentId, name: 'Agent', email: 'agent@example.test' });
  await db
    .insert(schema.organizationMember)
    .values({ userId: agentId, ...org });
});

afterAll(async () => {
  await client.close();
});

describe('migrations', () => {
  it('create every table of the schema on an empty database', async () => {
    const { rows } = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );

    expect(rows.map((row) => row.tablename)).toEqual(
      expect.arrayContaining([
        'organization',
        'organization_member',
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
        'sync_op',
        'sync_generation',
      ]),
    );
  });

  it('give every synced table an insert and an update cursor trigger', async () => {
    const { rows: synced } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.columns where table_schema = 'public' and column_name = 'server_xid'",
    );
    const { rows: triggers } = await client.query<{ tgname: string }>(
      `select t.tgname
         from pg_trigger t
         join pg_proc p on p.oid = t.tgfoid
        where p.proname = 'stamp_server_xid' and not t.tgisinternal`,
    );
    const names = triggers.map((row) => row.tgname);

    expect(synced).toHaveLength(12);
    for (const { table_name } of synced) {
      expect(names).toContain(`${table_name}_stamp_server_xid_insert`);
      expect(names).toContain(`${table_name}_stamp_server_xid_update`);
    }
  });
});

describe('sync generation', () => {
  it('start with one generation, and refuse a second row', async () => {
    const [row] = await db.select().from(schema.syncGeneration);

    expect(row?.id).toBe(1);
    expect(row?.generation).toMatch(/^[0-9a-f-]{36}$/);
    await expectViolation(
      db.insert(schema.syncGeneration).values({ id: 2 }),
      'sync_generation_single_row',
    );
  });

  it('change the generation when a restore bumps it', async () => {
    const [before] = await db.select().from(schema.syncGeneration);

    await db
      .update(schema.syncGeneration)
      .set({ generation: sql`gen_random_uuid()`, restoredAt: new Date() });
    const [after] = await db.select().from(schema.syncGeneration);

    expect(after?.generation).not.toBe(before?.generation);
  });
});

describe('identifiers', () => {
  it('leave identifiers to the client', async () => {
    await expect(
      client.query(
        `insert into contact (organization_id, name, name_norm) values ('${organizationId}', 'Sans identifiant', 'sans identifiant')`,
      ),
    ).rejects.toThrow(/null value in column "id"/);
  });

  it('refuse an identifier that is not a UUID v7', async () => {
    await expectViolation(
      db.insert(schema.contact).values({
        id: '0b6f1d5e-3c4a-4f8e-9a2b-7c1d2e3f4a5b',
        ...org,
        name: 'Livreur',
        nameNorm: 'livreur',
      }),
      'contact_id_v7',
    );
  });
});

describe('sync cursor', () => {
  it('number an insert, whatever the client sends', async () => {
    const [inserted] = await db
      .insert(schema.parcel)
      .values({ ...newParcel(), serverXid: 1_000_000_000_000 })
      .returning();

    expect(inserted?.serverXid).toBeLessThan(1_000_000_000_000);
  });

  it('move forward on a real update only', async () => {
    const parcel = newParcel();
    await db.insert(schema.parcel).values(parcel);
    const inserted = await serverXidOf(parcel.id);

    await db
      .update(schema.parcel)
      .set({ notes: 'Étagère B' })
      .where(eq(schema.parcel.id, parcel.id));
    const updated = await serverXidOf(parcel.id);

    await db
      .update(schema.parcel)
      .set({ notes: 'Étagère B' })
      .where(eq(schema.parcel.id, parcel.id));

    expect(updated).toBeGreaterThan(inserted ?? Infinity);
    expect(await serverXidOf(parcel.id)).toBe(updated);
  });

  it('refuse to move a row to another organization', async () => {
    const parcel = newParcel();
    await db.insert(schema.parcel).values(parcel);

    await expectViolation(
      db
        .update(schema.parcel)
        .set({ organizationId: otherOrganizationId })
        .where(eq(schema.parcel.id, parcel.id)),
      'cannot change',
    );
  });
});

describe('integrity', () => {
  it('refuse a parcel addressed to both a person and a contact', async () => {
    const person = newPerson('camille.martin@example.test');
    const contactId = newId();
    await db.insert(schema.directoryPerson).values(person);
    await db.insert(schema.contact).values({
      id: contactId,
      ...org,
      name: 'Livreur du traiteur',
      nameNorm: 'livreur du traiteur',
    });

    await expectViolation(
      db
        .insert(schema.parcel)
        .values({ ...newParcel(), personId: person.id, contactId }),
      'parcel_single_recipient',
    );
  });

  it('refuse a delivered parcel without who and when', async () => {
    await expectViolation(
      db.insert(schema.parcel).values({ ...newParcel(), status: 'remis' }),
      'parcel_delivery_check',
    );
  });

  it('refuse a piece number beyond the total', async () => {
    await expectViolation(
      db
        .insert(schema.parcel)
        .values({ ...newParcel(), pieceN: 3, pieceTotal: 2 }),
      'parcel_pieces_check',
    );
  });

  it('refuse an unknown status', async () => {
    await expectViolation(
      client.query(
        `insert into parcel (id, organization_id, status, received_at, received_by) values ('${newId()}', '${organizationId}', 'perdu', now(), '${agentId}')`,
      ),
      'parcel_status_check',
    );
  });

  it('keep a reserve whole: a known reason, and its date with it', async () => {
    await expectViolation(
      db.insert(schema.parcel).values({ ...newParcel(), damage: 'ouvert' }),
      'parcel_damage_check',
    );
    await expectViolation(
      db
        .insert(schema.parcel)
        .values({ ...newParcel(), damagedAt: new Date() }),
      'parcel_damage_check',
    );
    await expectViolation(
      client.query(
        `insert into parcel (id, organization_id, status, received_at, received_by, damage, damaged_at) values ('${newId()}', '${organizationId}', 'recu', now(), '${agentId}', 'perdu', now())`,
      ),
      'parcel_damage_check',
    );
    const reserved = { ...newParcel(), damage: 'mouille' as const };
    await db
      .insert(schema.parcel)
      .values({ ...reserved, damagedAt: new Date() });
    await db
      .update(schema.parcel)
      .set({ damage: null, damagedAt: null })
      .where(eq(schema.parcel.id, reserved.id));
  });

  it('refuse a handover of no parcel', async () => {
    await expectViolation(
      db.insert(schema.handover).values({
        id: newId(),
        ...org,
        parcelIds: [],
        recipientName: 'Camille Martin',
        method: 'qr',
        agentId,
        at: new Date(),
      }),
      'handover_parcels_check',
    );
  });

  it('keep the event log append-only, retention purge aside', async () => {
    const id = newId();
    await db.insert(schema.event).values({
      id,
      ...org,
      entity: 'parcel',
      entityId: newId(),
      type: 'received',
      actorId: agentId,
      at: new Date(),
    });

    await expectViolation(
      db
        .update(schema.event)
        .set({ detail: { forged: true } })
        .where(eq(schema.event.id, id)),
      'append-only',
    );
    await expectViolation(
      db.delete(schema.event).where(eq(schema.event.id, id)),
      'append-only',
    );
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.purge', 'on', true)`);
        await tx.delete(schema.event).where(eq(schema.event.id, id));
      }),
    ).resolves.toBeUndefined();
  });

  it('refuse a reference to a row of another organization', async () => {
    const stranger = newPerson('noe.bernard@example.test', otherOrganizationId);
    await db.insert(schema.directoryPerson).values(stranger);

    await expectViolation(
      db
        .insert(schema.parcel)
        .values({ ...newParcel(), personId: stranger.id }),
      'parcel_person_id_fk',
    );
  });

  it('refuse a handover listing a parcel of another organization', async () => {
    await expectViolation(
      db.insert(schema.handover).values({
        id: newId(),
        ...org,
        parcelIds: [newId()],
        recipientName: 'Camille Martin',
        method: 'qr',
        agentId,
        at: new Date(),
      }),
      'outside its organization',
    );
  });

  it('keep the parcels of a person who leaves, and tell the devices', async () => {
    const person = newPerson('sacha.leroy@example.test');
    await db.insert(schema.directoryPerson).values(person);
    const parcel = { ...newParcel(), personId: person.id };
    await db.insert(schema.parcel).values(parcel);
    const before = await serverXidOf(parcel.id);

    await db
      .delete(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person.id));
    const [kept] = await db
      .select()
      .from(schema.parcel)
      .where(eq(schema.parcel.id, parcel.id));

    expect(kept?.personId).toBeNull();
    expect(kept?.serverXid).toBeGreaterThan(before ?? Infinity);
  });

  it('refuse to delete a person whose pickup code devices still hold', async () => {
    const person = newPerson('lou.garnier@example.test');
    await db.insert(schema.directoryPerson).values(person);
    await db.insert(schema.pickupCode).values({
      id: newId(),
      ...org,
      personId: person.id,
      tokenHash: 'token-leaver',
      pinHash: 'pin-hash',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expectViolation(
      db
        .delete(schema.directoryPerson)
        .where(eq(schema.directoryPerson.id, person.id)),
      'pickup_code_person_id_fk',
    );
  });

  it('refuse a handover listing the same parcel twice', async () => {
    const parcel = newParcel();
    await db.insert(schema.parcel).values(parcel);

    await expectViolation(
      db.insert(schema.handover).values({
        id: newId(),
        ...org,
        parcelIds: [parcel.id, parcel.id],
        recipientName: 'Camille Martin',
        method: 'qr',
        agentId,
        at: new Date(),
      }),
      'lists a parcel twice',
    );
  });

  it('stamp writes even with triggers disabled for replication', async () => {
    const parcel = newParcel();
    await db.insert(schema.parcel).values(parcel);
    const before = await serverXidOf(parcel.id);

    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx
        .update(schema.parcel)
        .set({ notes: 'Correction' })
        .where(eq(schema.parcel.id, parcel.id));
    });

    expect(await serverXidOf(parcel.id)).toBeGreaterThan(before ?? Infinity);
  });
});

describe('uniqueness', () => {
  it('refuse two directory entries with the same email, deleted ones and other organizations aside', async () => {
    const first = newPerson('dominique.durand@example.test');
    await db.insert(schema.directoryPerson).values(first);

    await expectViolation(
      db
        .insert(schema.directoryPerson)
        .values(newPerson('Dominique.Durand@example.test')),
      'directory_person_email_idx',
    );
    await expect(
      db
        .insert(schema.directoryPerson)
        .values(
          newPerson('dominique.durand@example.test', otherOrganizationId),
        ),
    ).resolves.toBeDefined();

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

  it('keep one setting per key and organization, deleted ones aside', async () => {
    const firstId = newId();
    await db
      .insert(schema.setting)
      .values({ id: firstId, ...org, key: 'reminder_days', value: [2, 5] });

    await expectViolation(
      db
        .insert(schema.setting)
        .values({ id: newId(), ...org, key: 'reminder_days', value: [3] }),
      'setting_key_idx',
    );

    await db
      .update(schema.setting)
      .set({ deletedAt: new Date() })
      .where(eq(schema.setting.id, firstId));

    await expect(
      db
        .insert(schema.setting)
        .values({ id: newId(), ...org, key: 'reminder_days', value: [3] }),
    ).resolves.toBeDefined();
  });

  it('keep one active pickup code per person', async () => {
    const person = newPerson('alex.petit@example.test');
    await db.insert(schema.directoryPerson).values(person);
    const code = (tokenHash: string) => ({
      id: newId(),
      ...org,
      personId: person.id,
      tokenHash,
      pinHash: 'pin-hash',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const first = code('token-1');
    await db.insert(schema.pickupCode).values(first);

    await expectViolation(
      db.insert(schema.pickupCode).values(code('token-2')),
      'pickup_code_active_person_idx',
    );

    await db
      .update(schema.pickupCode)
      .set({ usedAt: new Date() })
      .where(eq(schema.pickupCode.id, first.id));

    await expect(
      db.insert(schema.pickupCode).values(code('token-3')),
    ).resolves.toBeDefined();
  });

  it('refuse a pickup code that covers nobody', async () => {
    await expectViolation(
      db.insert(schema.pickupCode).values({
        id: newId(),
        ...org,
        tokenHash: 'token-nobody',
        pinHash: 'pin-hash',
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
      'pickup_code_single_recipient',
    );
  });

  it('keep one default email template per owner and type', async () => {
    const template = () => ({
      id: newId(),
      ...org,
      type: 'avis' as const,
      name: 'Avis de passage',
      subject: 'Colis en attente',
      body: 'Bonjour',
      isDefault: true,
      ownerId: agentId,
    });
    await db.insert(schema.emailTemplate).values(template());

    await expectViolation(
      db.insert(schema.emailTemplate).values(template()),
      'email_template_default_idx',
    );
  });

  it('keep one sender per carrier account, whatever the case, deleted ones aside', async () => {
    const senderId = newId();
    await db.insert(schema.sender).values({
      id: senderId,
      ...org,
      displayName: 'Atelier Nord',
      nameNorm: 'atelier nord',
    });
    const firstId = newId();
    await db.insert(schema.senderAccount).values({
      id: firstId,
      ...org,
      carrier: 'ups',
      accountNumber: '1A2B3C',
      senderId,
    });
    const duplicate = () => ({
      id: newId(),
      ...org,
      carrier: 'UPS',
      accountNumber: ' 1a 2b3c',
      senderId,
    });

    await expectViolation(
      db.insert(schema.senderAccount).values(duplicate()),
      'sender_account_carrier_number_idx',
    );

    await db
      .update(schema.senderAccount)
      .set({ deletedAt: new Date() })
      .where(eq(schema.senderAccount.id, firstId));

    await expect(
      db.insert(schema.senderAccount).values(duplicate()),
    ).resolves.toBeDefined();
  });
});
