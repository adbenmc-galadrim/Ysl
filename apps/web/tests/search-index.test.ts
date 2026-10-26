import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { listSearchEntries } from '#/features/search/api/search-entries';
import {
  groupResults,
  type SearchEntry,
  searchEntries,
} from '#/features/search/search-index';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

const at = (day: number, hour = 9, month = 9) =>
  new Date(2026, month, day, hour, 0);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const trackings = (entries: SearchEntry[]) =>
  entries.map((entry) => entry.row.tracking).sort();

describe('search', () => {
  it('finds a recipient without accents or case', async () => {
    const ines = personRow({ firstName: 'Inès', lastName: 'Garnier' });
    await db.directoryPerson.put(ines);
    await db.parcel.bulkPut([
      parcelRow({ tracking: 'INES', personId: ines.id }),
      parcelRow({ tracking: 'OTHER' }),
    ]);
    const entries = await listSearchEntries(db, NOW);

    for (const query of ['ines', 'INÈS', 'inès garn', ' Garnier ']) {
      expect(trackings(searchEntries(entries, query, 'all', NOW))).toEqual([
        'INES',
      ]);
    }
  });

  it('looks into the service, carrier, sender, label name and tracking', async () => {
    const contact = contactRow({ name: 'Hugo Lambert' });
    await db.contact.put(contact);
    await db.parcel.bulkPut([
      parcelRow({ tracking: 'SERVICE', department: 'Ressources humaines' }),
      parcelRow({ tracking: 'CARRIER', carrier: 'Chronopost' }),
      parcelRow({ tracking: 'SENDER', senderName: 'Hermès Paris' }),
      parcelRow({ tracking: 'LABEL', readName: 'Mme Léa Roussel' }),
      parcelRow({ tracking: 'CONTACT', contactId: contact.id }),
      parcelRow({ tracking: '1Z E63 44W 0499' }),
    ]);
    const entries = await listSearchEntries(db, NOW);
    const find = (query: string) =>
      trackings(searchEntries(entries, query, 'all', NOW));

    expect(find('ressources')).toEqual(['SERVICE']);
    expect(find('chrono')).toEqual(['CARRIER']);
    expect(find('hermes')).toEqual(['SENDER']);
    expect(find('roussel')).toEqual(['LABEL']);
    expect(find('lambert')).toEqual(['CONTACT']);
    expect(find('e6344w')).toEqual(['1Z E63 44W 0499']);
    expect(find('1ze 6344')).toEqual(['1Z E63 44W 0499']);
  });

  it('keeps only the parcels that hold every word', async () => {
    await db.parcel.bulkPut([
      parcelRow({ tracking: 'UPS', carrier: 'UPS', department: 'Studio' }),
      parcelRow({ tracking: 'DHL', carrier: 'DHL', department: 'Studio' }),
    ]);
    const entries = await listSearchEntries(db, NOW);

    expect(trackings(searchEntries(entries, 'studio ups', 'all', NOW))).toEqual(
      ['UPS'],
    );
  });

  it('reaches old handovers and returns, dated, but never deleted parcels', async () => {
    await db.parcel.bulkPut([
      parcelRow({
        tracking: 'OLD',
        status: 'remis',
        receivedAt: at(10),
        deliveredAt: at(14, 12),
        deliveredBy: 'agent-1',
      }),
      parcelRow({ tracking: 'BACK', status: 'retourne' }),
      parcelRow({ tracking: 'LASTWEEK', receivedAt: at(17, 10) }),
      parcelRow({ tracking: 'GONE', deletedAt: NOW }),
    ]);
    const entries = await listSearchEntries(db, NOW);
    const status = (tracking: string) =>
      entries.find((entry) => entry.row.tracking === tracking)?.row.status;

    expect(trackings(entries)).toEqual(['BACK', 'LASTWEEK', 'OLD']);
    expect(status('OLD')).toBe('Remis le 14 oct. à 12 h 00');
    expect(status('BACK')).toBe('Retourné à l’expéditeur');
    expect(status('LASTWEEK')).toBe('Reçu le 17 oct. à 10 h 00');
  });

  it('narrows to each chip', async () => {
    await db.parcel.bulkPut([
      parcelRow({ tracking: 'INCOMPLETE', status: 'a_completer' }),
      parcelRow({ tracking: 'RECEIVED', receivedAt: at(24, 8) }),
      parcelRow({
        tracking: 'LATE',
        status: 'notifie',
        receivedAt: at(1),
        notifiedAt: at(1),
      }),
      parcelRow({
        tracking: 'TODAY',
        status: 'remis',
        receivedAt: at(1, 9, 8),
        deliveredAt: at(24, 9),
        deliveredBy: 'agent-1',
      }),
      parcelRow({
        tracking: 'SUMMER',
        status: 'remis',
        receivedAt: at(1, 9, 6),
        deliveredAt: at(2, 9, 6),
        deliveredBy: 'agent-1',
      }),
      parcelRow({ tracking: 'BACK', status: 'retourne', receivedAt: at(2) }),
    ]);
    const entries = await listSearchEntries(db, NOW);
    const chip = (filter: Parameters<typeof searchEntries>[2]) =>
      trackings(searchEntries(entries, '', filter, NOW));

    expect(chip('all')).toHaveLength(6);
    expect(chip('waiting')).toEqual(['INCOMPLETE', 'LATE', 'RECEIVED']);
    expect(chip('delivered')).toEqual(['SUMMER', 'TODAY']);
    expect(chip('last30')).toEqual([
      'BACK',
      'INCOMPLETE',
      'LATE',
      'RECEIVED',
      'TODAY',
    ]);
    expect(chip('today')).toEqual(['INCOMPLETE', 'RECEIVED', 'TODAY']);
    expect(chip('incomplete')).toEqual(['INCOMPLETE']);
    expect(chip('late')).toEqual(['LATE']);
  });
});

describe('groupResults', () => {
  it('groups by standing in the order of the day, latest first', async () => {
    await db.parcel.bulkPut([
      parcelRow({
        tracking: 'OUT-OLD',
        status: 'remis',
        deliveredAt: at(2),
        deliveredBy: 'agent-1',
      }),
      parcelRow({
        tracking: 'OUT-NEW',
        status: 'remis',
        deliveredAt: at(14),
        deliveredBy: 'agent-1',
      }),
      parcelRow({ tracking: 'IN', receivedAt: at(24, 8) }),
    ]);
    const sections = groupResults(
      await listSearchEntries(db, NOW),
      'status',
      NOW,
      t,
    );

    expect(
      sections.map((s) => [s.title, s.parcels.map((p) => p.tracking)]),
    ).toEqual([
      ['À notifier', ['IN']],
      ['Remis', ['OUT-NEW', 'OUT-OLD']],
    ]);
  });

  it('keeps namesakes apart and sorts recipients by name, unknown last', async () => {
    const ines = personRow({ firstName: 'Inès', lastName: 'Garnier' });
    const otherInes = personRow({ firstName: 'Inès', lastName: 'Garnier' });
    const ana = personRow({ firstName: 'Ana', lastName: 'Zola' });
    await db.directoryPerson.bulkPut([ines, otherInes, ana]);
    await db.parcel.bulkPut([
      parcelRow({ tracking: 'NOBODY' }),
      parcelRow({ tracking: 'INES-1', personId: ines.id }),
      parcelRow({ tracking: 'INES-2', personId: otherInes.id }),
      parcelRow({ tracking: 'ANA', personId: ana.id }),
    ]);
    const sections = groupResults(
      await listSearchEntries(db, NOW),
      'recipient',
      NOW,
      t,
    );

    expect(sections.map((s) => s.title)).toEqual([
      'Ana Zola',
      'Inès Garnier',
      'Inès Garnier',
      'Destinataire inconnu',
    ]);
    expect(new Set(sections.map((s) => s.id)).size).toBe(4);
  });

  it('groups by day, latest first, naming today and yesterday', async () => {
    await db.parcel.bulkPut([
      parcelRow({ tracking: 'OLD', receivedAt: at(14) }),
      parcelRow({ tracking: 'TODAY', receivedAt: at(24, 8) }),
      parcelRow({ tracking: 'YESTERDAY', receivedAt: at(23, 18) }),
      parcelRow({ tracking: 'LAST-YEAR', receivedAt: new Date(2025, 10, 3) }),
    ]);
    const sections = groupResults(
      await listSearchEntries(db, NOW),
      'date',
      NOW,
      t,
    );

    expect(sections.map((s) => s.title)).toEqual([
      'Aujourd’hui',
      'Hier',
      'Mercredi 14 octobre',
      'Lundi 3 novembre 2025',
    ]);
  });
});
