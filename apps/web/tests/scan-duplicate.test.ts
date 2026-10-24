import 'fake-indexeddb/auto';
import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { DraftParcel } from '#/features/db/schema';
import {
  duplicateReading,
  parcelFields,
  recipientOf,
} from '#/features/scan/duplicate';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator('fr');

const draft = (overrides: Partial<DraftParcel> = {}): DraftParcel => ({
  id: 'd1',
  batchId: 'b1',
  createdAt: new Date(2026, 9, 24, 10, 42),
  photoId: null,
  reading: 'read',
  carrier: 'UPS',
  tracking: '1ZE6344W0499230622',
  trackingNorm: '1ZE6344W0499230622',
  readName: 'Camille Morel',
  symbols: [],
  ocrState: 'skipped',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

describe('duplicateReading', () => {
  it('names the original of this batch and when it was scanned', () => {
    expect(
      duplicateReading({ kind: 'batch', draft: draft() }, '', t, NOW),
    ).toEqual({
      kind: 'duplicate',
      title: 'Déjà dans ce lot',
      detail: 'Camille Morel, UPS ···0622, scanné à 10 h 42',
      message: 'Ce colis n’a pas été ajouté une deuxième fois.',
    });
  });

  it('falls back on the OCR guess, then on an unknown recipient and carrier', () => {
    const guessed = draft({ readName: null, ocrName: 'C. Morel' });
    expect(
      duplicateReading({ kind: 'batch', draft: guessed }, '', t, NOW).detail,
    ).toBe('C. Morel ?, UPS ···0622, scanné à 10 h 42');
    const bare = draft({ readName: null, carrier: null });
    expect(
      duplicateReading({ kind: 'batch', draft: bare }, '', t, NOW).detail,
    ).toBe(
      'Destinataire inconnu, Transporteur inconnu ···0622, scanné à 10 h 42',
    );
  });

  it('says a parcel received today, yesterday or on a date, at its time', () => {
    const at = (date: Date) =>
      duplicateReading(
        { kind: 'parcel', parcel: parcelRow({ receivedAt: date }) },
        'Camille Morel',
        t,
        NOW,
      );
    expect(at(new Date(2026, 9, 24, 10, 42))).toMatchObject({
      title: 'Déjà reçu aujourd’hui',
      detail: 'Camille Morel, UPS ···0622, reçu à 10 h 42',
    });
    expect(at(new Date(2026, 9, 23, 18, 5)).title).toBe('Déjà reçu hier');
    expect(at(new Date(2026, 9, 2, 9, 0)).title).toBe('Déjà reçu le 2 octobre');
  });

  it('says a handed-over parcel was remis, at its handover time', () => {
    const parcel = parcelRow({
      status: 'remis',
      receivedAt: new Date(2026, 9, 20, 9, 0),
      deliveredAt: new Date(2026, 9, 23, 17, 30),
      deliveredBy: 'agent-1',
    });
    expect(
      duplicateReading({ kind: 'parcel', parcel }, 'Hugo Lefèvre', t, NOW),
    ).toMatchObject({
      title: 'Déjà remis hier',
      detail: 'Hugo Lefèvre, UPS ···0622, remis à 17 h 30',
    });
  });
});

describe('parcelFields', () => {
  it('shows a received parcel as the screen shows a reading', () => {
    expect(parcelFields(parcelRow(), 'Camille Morel', t)).toEqual([
      { label: 'Transporteur', value: 'UPS' },
      { label: 'Suivi', value: '1ZE6344W0499230622', mono: true },
      { label: 'Destinataire', value: 'Camille Morel' },
    ]);
    expect(
      parcelFields(parcelRow({ carrier: null, tracking: null }), 'X', t),
    ).toMatchObject([
      { value: 'Inconnu' },
      { value: 'Non lu' },
      { value: 'X' },
    ]);
  });
});

describe('recipientOf', () => {
  it('names the directory person, else the contact, else the name read, else unknown', async () => {
    const db = await openTestDatabase();
    const person = personRow({ firstName: 'Camille', lastName: 'Morel' });
    const contact = contactRow({ name: 'Hugo Lefèvre' });
    await db.directoryPerson.add(person);
    await db.contact.add(contact);

    await expect(
      recipientOf(db, parcelRow({ personId: person.id }), t),
    ).resolves.toBe('Camille Morel');
    await expect(
      recipientOf(db, parcelRow({ contactId: contact.id }), t),
    ).resolves.toBe('Hugo Lefèvre');
    await expect(
      recipientOf(db, parcelRow({ readName: 'Léa Martin' }), t),
    ).resolves.toBe('Léa Martin');
    await expect(recipientOf(db, parcelRow(), t)).resolves.toBe(
      'Destinataire inconnu',
    );
  });
});
