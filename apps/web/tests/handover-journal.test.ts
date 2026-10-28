import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase } from '#/features/db/schema';
import { loadHandoverEntry } from '#/features/handover/entry';
import {
  describeHandoverDetail,
  journalSections,
  loadJournal,
} from '#/features/handover/journal';
import {
  handoverRow,
  NOW,
  openTestDatabase,
  parcelRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const day = (date: number, hours: number, minutes = 0) =>
  new Date(2026, 9, date, hours, minutes);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('the handover journal', () => {
  it('lists every handover by day, the newest first', async () => {
    await db.handover.bulkPut([
      handoverRow({ recipientName: 'Inès Garnier', at: day(20, 10, 12) }),
      handoverRow({ recipientName: 'Nora Haddad', at: day(24, 11, 20) }),
      handoverRow({ recipientName: 'Noé Bertin', at: day(23, 17, 40) }),
      handoverRow({ recipientName: 'Marc Petit', at: day(24, 9, 5) }),
      handoverRow({ recipientName: 'Supprimée', deletedAt: NOW }),
    ]);

    const sections = journalSections(await loadJournal(db), '', NOW, t);

    expect(
      sections.map((section) => [
        section.title,
        section.entries.map((entry) => entry.recipient),
      ]),
    ).toEqual([
      ['Aujourd’hui', ['Nora Haddad', 'Marc Petit']],
      ['Hier', ['Noé Bertin']],
      ['Mardi 20 octobre', ['Inès Garnier']],
    ]);
  });

  it('tells how many, how, when and by which agent', async () => {
    const at = day(24, 11, 20);
    const parcels = [1, 2, 3].map(() =>
      parcelRow({ status: 'remis', deliveredAt: at }),
    );
    await db.parcel.bulkPut(parcels);
    await db.handover.put(
      handoverRow({
        parcelIds: parcels.map((parcel) => parcel.id),
        method: 'qr',
        delegateName: 'Lucas Martin',
        at,
      }),
    );

    const [entry] = journalSections(await loadJournal(db), '', NOW, t)[0]!
      .entries;

    expect(entry).toMatchObject({
      recipient: 'Nora Haddad',
      icon: 'qr',
      summary: '3 colis · QR code vérifié, retiré par Lucas Martin',
      detail: '11 h 20 · Karim Benali',
      state: 'done',
    });
  });

  it('does not count a parcel another iPhone handed over first', async () => {
    const at = day(24, 11, 20);
    const kept = parcelRow({ status: 'remis', deliveredAt: at });
    const lost = parcelRow({ status: 'remis', deliveredAt: day(24, 11, 18) });
    await db.parcel.bulkPut([kept, lost]);
    await db.handover.put(
      handoverRow({ parcelIds: [kept.id, lost.id], method: 'manuel', at }),
    );

    const [entry] = journalSections(await loadJournal(db), '', NOW, t)[0]!
      .entries;

    expect(entry?.summary).toBe('1 colis · Sans vérification');
  });

  it('marks what waits on this iPhone and what was cancelled', async () => {
    const waiting = handoverRow({ agentName: null, at: day(24, 11) });
    await commitLocal(db, { upserts: [{ entity: 'handover', row: waiting }] });
    await db.handover.put(
      handoverRow({ at: day(24, 10), cancelledAt: day(24, 10, 4) }),
    );

    const entries = journalSections(await loadJournal(db), '', NOW, t)[0]!
      .entries;

    expect(
      entries.map(({ state, status, detail }) => [state, status, detail]),
    ).toEqual([
      ['unsent', 'Pas encore envoyée au serveur', '11 h 00 · Un agent'],
      ['cancelled', 'Annulée à 10 h 04', '10 h 00 · Karim Benali'],
    ]);
  });

  it('dates a cancellation made another day', async () => {
    await db.handover.put(
      handoverRow({ at: day(23, 17, 40), cancelledAt: day(24, 9, 5) }),
    );

    const [entry] = journalSections(await loadJournal(db), '', NOW, t)[0]!
      .entries;

    expect(entry?.status).toBe('Annulée aujourd’hui à 9 h 05');
  });

  it('says « Vous » to the agent of a handover kept without a name', async () => {
    await db.handover.put(handoverRow({ agentName: null, agentId: 'me' }));
    const items = await loadJournal(db);
    const detail = (me: string) =>
      journalSections(items, '', NOW, t, me)[0]!.entries[0]!.detail;

    expect(detail('me')).toBe('12 h 00 · Vous');
    expect(detail('other')).toBe('12 h 00 · Un agent');
  });

  it('finds a handover by the employee, the colleague or the agent, accents aside', async () => {
    await db.handover.bulkPut([
      handoverRow({ recipientName: 'Noé Bertin', agentName: 'Lina Morel' }),
      handoverRow({ recipientName: 'Nora Haddad', delegateName: 'Zoé Roux' }),
      handoverRow({ recipientName: 'Marc Petit' }),
    ]);
    const items = await loadJournal(db);
    const found = (query: string) =>
      journalSections(items, query, NOW, t).flatMap((section) =>
        section.entries.map((entry) => entry.recipient),
      );

    expect(found('noe')).toEqual(['Noé Bertin']);
    expect(found('ZOE')).toEqual(['Nora Haddad']);
    expect(found('lina')).toEqual(['Noé Bertin']);
    expect(found('karim').sort()).toEqual(['Marc Petit', 'Nora Haddad']);
    expect(found('zz')).toEqual([]);
  });

  it('opens a handover with its parcels, its agent and how it was proved', async () => {
    const parcels = [
      parcelRow({ senderName: 'Zalando', status: 'remis' }),
      parcelRow({ type: 'recommande', status: 'remis' }),
    ];
    await db.parcel.bulkPut(parcels);
    const row = handoverRow({
      parcelIds: parcels.map((parcel) => parcel.id),
      at: day(23, 17, 40),
      cancelledAt: day(23, 17, 42),
    });
    await db.handover.put(row);

    const view = describeHandoverDetail(
      (await loadHandoverEntry(db, row.id))!,
      NOW,
      t,
    );

    expect(view).toMatchObject({
      title: '2 colis remis',
      subtitle: 'à Nora Haddad',
      cancelled: 'Remise annulée hier à 17 h 42',
      items: [
        { label: 'Quand', value: 'Hier à 17 h 40' },
        { label: 'Agent', value: 'Karim Benali' },
        { label: 'Méthode', value: 'Code vérifié' },
        { label: 'Synchronisation', value: 'À jour' },
      ],
    });
    expect(view.parcels.map((parcel) => parcel.title)).toEqual([
      'Zalando',
      'Recommandé',
    ]);
  });

  it('says where the signature and the photo are: here, or on the agent’s iPhone', async () => {
    const parcel = parcelRow({ status: 'remis' });
    await db.parcel.put(parcel);
    const row = handoverRow({
      parcelIds: [parcel.id],
      method: 'signature',
      hasSignature: true,
      hasPhoto: true,
    });
    await db.handover.put(row);
    await db.handoverProof.put({
      id: 'proof-1',
      handoverId: row.id,
      kind: 'photo',
      path: 'photos/proof-1.jpg',
      width: 1600,
      height: 1200,
      bytes: 9,
      createdAt: NOW,
    });

    const entry = (await loadHandoverEntry(db, row.id))!;
    const view = describeHandoverDetail(entry, NOW, t);

    expect(entry.proofs).toEqual(['photo']);
    expect(view.items.slice(2, 5)).toEqual([
      { label: 'Méthode', value: 'Signée' },
      { label: 'Signature', value: 'Sur l’iPhone de l’agent' },
      { label: 'Photo', value: 'Sur cet iPhone' },
    ]);
  });
});
