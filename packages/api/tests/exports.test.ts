import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import { contact, directoryPerson, handover, parcel } from '@repo/db/schema';
import { newId } from '@repo/shared/id';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({ db, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID, OTHER_ORGANIZATION_ID, ORGANIZATION_ID, parcelRow } =
  await import('./helpers/pglite');
const { parseCsv } = await import('./helpers/csv');
const { PARCELS_CSV_HEADER, exportParcelsCsv, formatExportDate } =
  await import('#features/exports/service');

function memberSession(userId: string): Session {
  const session = sessionFor('agent');
  return {
    session: { ...session.session, userId },
    user: { ...session.user, id: userId },
  };
}

const personId = newId();
const contactId = newId();
const ids = {
  person: newId(),
  contact: newId(),
  readName: newId(),
  deleted: newId(),
  other: newId(),
};

beforeAll(async () => {
  await db.insert(directoryPerson).values({
    id: personId,
    organizationId: ORGANIZATION_ID,
    firstName: 'Hélène',
    lastName: 'Durand',
    nameNorm: 'helene durand',
    email: 'helene.durand@example.test',
    department: 'Finance',
  });
  await db.insert(contact).values({
    id: contactId,
    organizationId: ORGANIZATION_ID,
    name: 'Atelier Ménard',
    nameNorm: 'atelier menard',
    email: 'atelier@example.test',
  });
  await db.insert(parcel).values([
    {
      ...parcelRow(),
      id: ids.person,
      status: 'remis',
      personId,
      carrier: 'UPS',
      tracking: '1Z999AA10123456784',
      senderName: '=HYPERLINK("http://x";"Fournisseur")',
      pieceN: 2,
      pieceTotal: 3,
      weightKg: 1.25,
      carrierService: 'Express Saver',
      reference: 'PO-4512',
      location: 'Étagère B',
      notes: 'Laissé à l’accueil\npar le livreur; fragile',
      damage: 'carton_abime',
      damageNote: 'coin enfoncé',
      damagedAt: new Date('2026-10-24T08:06:00Z'),
      receivedAt: new Date('2026-10-24T08:05:00Z'),
      notifiedAt: new Date('2026-10-24T08:30:00Z'),
      lastNotifiedAt: new Date('2026-10-25T07:00:00Z'),
      deliveredAt: new Date('2026-10-25T14:32:00Z'),
      deliveredBy: AGENT_ID,
    },
    {
      ...parcelRow(),
      id: ids.contact,
      status: 'notifie',
      type: 'recommande',
      contactId,
      notificationEmail: 'courrier@example.test',
      department: 'Achats',
      receivedAt: new Date('2026-10-24T09:00:00Z'),
      notifiedAt: new Date('2026-10-24T09:10:00Z'),
    },
    {
      ...parcelRow(),
      id: ids.readName,
      status: 'a_completer',
      type: 'sans_suivi',
      readName: '+M. Lefèvre',
      receivedAt: new Date('2026-10-24T10:00:00Z'),
    },
    {
      ...parcelRow(),
      id: ids.deleted,
      deletedAt: new Date('2026-10-24T11:00:00Z'),
    },
    { ...parcelRow(OTHER_ORGANIZATION_ID), id: ids.other },
  ]);
  const handed = {
    organizationId: ORGANIZATION_ID,
    recipientName: 'Hélène Durand',
    personId,
    agentId: AGENT_ID,
  };
  await db.insert(handover).values([
    {
      ...handed,
      id: newId(),
      parcelIds: [ids.person],
      method: 'manuel',
      agentName: 'Lina Morel',
      at: new Date('2026-10-25T14:00:00Z'),
      cancelledAt: new Date('2026-10-25T14:01:00Z'),
    },
    {
      ...handed,
      id: newId(),
      parcelIds: [ids.person],
      delegateName: 'Paul Roy',
      method: 'qr',
      agentName: 'Karim Benali',
      hasSignature: true,
      at: new Date('2026-10-25T14:32:00Z'),
    },
    {
      ...handed,
      id: newId(),
      parcelIds: [ids.contact],
      personId: null,
      contactId,
      recipientName: 'Atelier Ménard',
      method: 'pin',
      at: new Date('2026-10-24T09:20:00Z'),
      cancelledAt: new Date('2026-10-24T09:25:00Z'),
      cancelReason: 'wrong_parcel',
      cancelNote: 'Celui de M. Bernard',
    },
  ]);
});

afterAll(async () => {
  await client.close();
});

describe('exports.parcelsCsv', () => {
  it('turns away an account no mailroom attached', async () => {
    await expect(
      callerFor(memberSession('nobody')).exports.parcelsCsv(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('hands a member the file of its mailroom', async () => {
    const result = await callerFor(
      memberSession(AGENT_ID),
    ).exports.parcelsCsv();
    expect(result.count).toBe(3);
    expect(result.filename).toMatch(
      /^courrier-historique-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('holds only the parcels ticked on Colis, never another mailroom’s', async () => {
    const result = await callerFor(
      memberSession(AGENT_ID),
    ).exports.selectionCsv({ parcelIds: [ids.contact, ids.other] });
    expect(result.count).toBe(1);
    expect(
      parseCsv(result.csv)
        .slice(1)
        .map((row) => row[0]),
    ).toEqual([ids.contact]);
  });
});

describe('exportParcelsCsv', () => {
  const now = new Date('2026-10-26T22:30:00Z');

  it('names the file after the day in Paris, without the brand', async () => {
    const { filename } = await exportParcelsCsv(db, ORGANIZATION_ID, now);
    expect(filename).toBe('courrier-historique-2026-10-26.csv');
    const { filename: late } = await exportParcelsCsv(
      db,
      ORGANIZATION_ID,
      new Date('2026-10-26T23:30:00Z'),
    );
    expect(late).toBe('courrier-historique-2026-10-27.csv');
  });

  it('reads back to one line per kept parcel, in reception order', async () => {
    const { csv } = await exportParcelsCsv(db, ORGANIZATION_ID, now);
    const [header, ...rows] = parseCsv(csv);
    expect(header?.slice(0, 12)).toEqual(
      'id;date_reception;date_remise;statut;transporteur;tracking;destinataire;email;departement;expediteur;nb_colis;notes'.split(
        ';',
      ),
    );
    expect(header).toEqual([...PARCELS_CSV_HEADER]);
    expect(rows.map((row) => row[0])).toEqual([
      ids.person,
      ids.contact,
      ids.readName,
    ]);
    for (const row of rows) expect(row).toHaveLength(header!.length);
  });

  it('writes every column of a delivered parcel as Excel shows it', async () => {
    const { csv } = await exportParcelsCsv(db, ORGANIZATION_ID, now);
    const [header, first] = parseCsv(csv);
    const cells = Object.fromEntries(
      header!.map((name, i) => [name, first![i]]),
    );
    expect(cells).toEqual({
      id: ids.person,
      date_reception: '24/10/2026 10:05',
      date_remise: '25/10/2026 15:32',
      statut: 'Remis',
      transporteur: 'UPS',
      tracking: '1Z999AA10123456784',
      destinataire: 'Hélène Durand',
      email: 'helene.durand@example.test',
      departement: 'Finance',
      expediteur: `'=HYPERLINK("http://x";"Fournisseur")`,
      nb_colis: '2',
      notes: 'Laissé à l’accueil\npar le livreur; fragile',
      statut_v2: 'Remis',
      type: 'Colis',
      service_transporteur: 'Express Saver',
      reference: 'PO-4512',
      poids_kg: '1,25',
      emplacement: 'Étagère B',
      date_notification: '24/10/2026 10:30',
      derniere_notification: '25/10/2026 08:00',
      reserve: 'Carton abîmé : coin enfoncé',
      remis_le: '25/10/2026 15:32',
      remis_a: 'Hélène Durand (retiré par Paul Roy)',
      remis_par: 'Karim Benali',
      methode_remise: 'QR code vérifié',
      remise_annulee: '',
      motif_annulation: '',
      signature: 'oui',
      photo_remise: 'non',
    });
  });

  it('names the recipient from the contact, then from the label', async () => {
    const { csv } = await exportParcelsCsv(db, ORGANIZATION_ID, now);
    const [header, , second, third] = parseCsv(csv);
    const column = (name: string) => header!.indexOf(name);
    expect(second![column('destinataire')]).toBe('Atelier Ménard');
    expect(second![column('email')]).toBe('courrier@example.test');
    expect(second![column('departement')]).toBe('Achats');
    expect(second![column('statut')]).toBe('Notifie');
    expect(second![column('type')]).toBe('Recommandé');
    expect(third![column('destinataire')]).toBe(`'+M. Lefèvre`);
    expect(third![column('statut')]).toBe('En attente');
    expect(third![column('statut_v2')]).toBe('À compléter');
    expect(third![column('nb_colis')]).toBe('1');
    expect(third![column('date_remise')]).toBe('');
  });

  it('tells a cancelled handover, and nothing for a parcel never handed over', async () => {
    const { csv } = await exportParcelsCsv(db, ORGANIZATION_ID, now);
    const [header, , second, third] = parseCsv(csv);
    const cells = (row: string[]) =>
      header!.slice(-8).map((_, i) => row[header!.length - 8 + i]);
    expect(header!.slice(-8)).toEqual([
      'remis_le',
      'remis_a',
      'remis_par',
      'methode_remise',
      'remise_annulee',
      'motif_annulation',
      'signature',
      'photo_remise',
    ]);
    expect(cells(second!)).toEqual([
      '24/10/2026 11:20',
      'Atelier Ménard',
      '',
      'Code vérifié',
      '24/10/2026 11:25',
      'Mauvais colis : Celui de M. Bernard',
      'non',
      'non',
    ]);
    expect(cells(third!)).toEqual(['', '', '', '', '', '', '', '']);
  });

  it('writes a winter date in Paris winter time', () => {
    expect(formatExportDate(new Date('2026-12-01T08:00:00Z'))).toBe(
      '01/12/2026 09:00',
    );
  });
});
