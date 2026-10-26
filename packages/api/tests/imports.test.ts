import { readFileSync } from 'node:fs';
import type { Session } from '@repo/auth';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({ db, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const schema = await import('@repo/db/schema');
const { and, eq } = await import('drizzle-orm');
const { newId } = await import('@repo/shared/id');
const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID, ORGANIZATION_ID, OTHER_ORGANIZATION_ID, STRANGER_ID } =
  await import('./helpers/pglite');

const sample = readFileSync(
  new URL('./fixtures/v1-history.csv', import.meta.url),
  'utf8',
);

function sessionOf(userId: string, role: 'admin' | 'agent'): Session {
  const session = sessionFor(role);
  return {
    session: { ...session.session, userId },
    user: { ...session.user, id: userId },
  };
}

const admin = () => callerFor(sessionOf(AGENT_ID, 'admin'));

const HELENE_ID = newId();
const SCANNED_ID = newId();

beforeAll(async () => {
  await db.insert(schema.directoryPerson).values({
    id: HELENE_ID,
    organizationId: ORGANIZATION_ID,
    lastName: 'Dupré',
    firstName: 'Hélène',
    nameNorm: 'helene dupre',
    email: 'Helene.Dupre@example.com',
  });
  await db.insert(schema.parcel).values({
    id: SCANNED_ID,
    organizationId: ORGANIZATION_ID,
    status: 'recu',
    tracking: '986578788855',
    trackingNorm: '986578788855',
    receivedAt: new Date('2026-03-08T09:00:00Z'),
    receivedBy: AGENT_ID,
  });
});

afterAll(async () => {
  await client.close();
});

const parcelsOf = (organizationId: string) =>
  db
    .select()
    .from(schema.parcel)
    .where(eq(schema.parcel.organizationId, organizationId));

describe('imports.v1Csv', () => {
  it('turns away an agent and an admin of no mailroom', async () => {
    await expect(
      callerFor(sessionOf(AGENT_ID, 'agent')).imports.v1Csv({ csv: sample }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      callerFor(sessionOf('nobody', 'admin')).imports.v1Csv({ csv: sample }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a file that is no v1 export', async () => {
    await expect(
      admin().imports.v1Csv({ csv: 'nom;email\nA;a@example.com\n' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message:
        'Ce fichier n’est pas un export de la v1 : il lui manque les colonnes « tracking » et « destinataire ».',
    });
  });

  it('imports the sample and reports what it left out and marked', async () => {
    const report = await admin().imports.v1Csv({ csv: sample });

    expect(report).toMatchObject({
      imported: 7,
      skipped: 5,
      contactsCreated: 3,
    });
    expect(report.skips.map(({ line, reason }) => [line, reason])).toEqual([
      [8, 'duplicate-in-file'],
      [9, 'duplicate-in-file'],
      [10, 'date-invalid'],
      [11, 'tracking-missing'],
      [14, 'already-present'],
    ]);
    expect(report.flagged).toEqual([
      {
        line: 3,
        tracking: '7185713569',
        recipient: 'Éloïse Martin',
        carrier: 'FedEx',
        flags: ['tracking-rejected'],
      },
      {
        line: 7,
        tracking: '10464000209404',
        recipient: 'Jean-Noël Bréhat',
        carrier: 'DPD',
        flags: ['status-unknown'],
        status: 'Perdu',
      },
      expect.objectContaining({ line: 13, flags: ['recipient-missing'] }),
    ]);
  });

  it('never stores 7185713569 as a sure parcel', async () => {
    const [doubtful] = await db
      .select()
      .from(schema.parcel)
      .where(eq(schema.parcel.tracking, '7185713569'));
    expect(doubtful).toMatchObject({
      status: 'a_completer',
      notes: 'Tracking douteux à l’import de la v1',
    });
    const [imported] = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.entityId, doubtful!.id));
    expect(imported).toMatchObject({
      entity: 'parcel',
      type: 'parcel.imported',
      detail: { flags: ['tracking-rejected'] },
      actorId: AGENT_ID,
    });
  });

  it('links each row to the directory or to one contact per e-mail', async () => {
    const parcels = await parcelsOf(ORGANIZATION_ID);
    const byTracking = new Map(parcels.map((row) => [row.tracking, row]));
    expect(byTracking.get('1ZE6344W0499230622')).toMatchObject({
      personId: HELENE_ID,
      contactId: null,
      status: 'recu',
      carrier: 'UPS',
      senderName: 'Maison Lefèvre; Paris',
      notes: 'Fragile, "haut" en haut',
      receivedBy: AGENT_ID,
    });
    const eloise = byTracking.get('7185713569')!.contactId;
    expect(byTracking.get('8J02299079750')).toMatchObject({
      contactId: eloise,
      status: 'remis',
      deliveredAt: new Date('2026-03-04T15:00:00Z'),
      deliveredBy: AGENT_ID,
      pieceTotal: 2,
    });
    expect(byTracking.get('5413337112')).toMatchObject({
      status: 'a_completer',
      notes: '=HYPERLINK("x")',
    });
    expect(byTracking.get('10464000209404')!.contactId).toBe(
      byTracking.get('5413337112')!.contactId,
    );

    const contacts = await db
      .select()
      .from(schema.contact)
      .where(eq(schema.contact.organizationId, ORGANIZATION_ID));
    expect(
      contacts
        .map(({ name, email, usageCount }) => ({ name, email, usageCount }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      {
        name: 'Éloïse Martin',
        email: 'eloise.martin@example.com',
        usageCount: 2,
      },
      { name: 'Jean-Noël Bréhat', email: null, usageCount: 2 },
      { name: "Zoé O'Neil", email: 'zoe.oneil@example.com', usageCount: 1 },
    ]);
  });

  it('adds nothing when the same file comes back, corrected parcel included', async () => {
    await db
      .update(schema.parcel)
      .set({ tracking: '794808390594', trackingNorm: '794808390594' })
      .where(eq(schema.parcel.tracking, '7185713569'));
    const before = (await parcelsOf(ORGANIZATION_ID)).length;

    const report = await admin().imports.v1Csv({ csv: sample });

    expect(report).toMatchObject({
      imported: 0,
      skipped: 12,
      contactsCreated: 0,
      flagged: [],
    });
    expect(await parcelsOf(ORGANIZATION_ID)).toHaveLength(before);
    const [eloise] = await db
      .select()
      .from(schema.contact)
      .where(
        and(
          eq(schema.contact.organizationId, ORGANIZATION_ID),
          eq(schema.contact.email, 'eloise.martin@example.com'),
        ),
      );
    expect(eloise?.usageCount).toBe(2);
  });

  it('finds every parcel already there in its own CSV export (#60)', async () => {
    const parcels = await parcelsOf(ORGANIZATION_ID);
    const { csv } = await admin().exports.parcelsCsv();

    const report = await admin().imports.v1Csv({ csv });

    expect(report).toMatchObject({ imported: 0, contactsCreated: 0 });
    expect(report.skips).toHaveLength(parcels.length);
    expect(new Set(report.skips.map((skip) => skip.reason))).toEqual(
      new Set(['already-present']),
    );
    expect(report.skips.map((skip) => skip.tracking).sort()).toEqual(
      parcels.map((row) => row.tracking).sort(),
    );
  });

  it('leaves the other mailroom alone, and imports there on its own', async () => {
    expect(await parcelsOf(OTHER_ORGANIZATION_ID)).toEqual([]);

    const report = await callerFor(
      sessionOf(STRANGER_ID, 'admin'),
    ).imports.v1Csv({ csv: sample });

    expect(report).toMatchObject({ imported: 8, contactsCreated: 4 });
    expect(await parcelsOf(OTHER_ORGANIZATION_ID)).toHaveLength(8);
  });
});
