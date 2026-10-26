import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { describe, expect, it } from 'vitest';
import { loadRecipientBook } from '#/features/parcels/recipients';
import { checkTracking } from '#/features/parcels/tracking-check';
import {
  contactRow,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

const camille = personRow({ id: 'p-1' });
const paul = contactRow({
  id: 'c-1',
  name: 'Paul Intérim',
  nameNorm: 'paul interim',
});

describe('checkTracking', () => {
  it('says the key of the carrier picked is right', () => {
    expect(checkTracking('1Z E63 44W 04 9923 0622', 'UPS', t).check).toEqual({
      tone: 'green',
      text: 'Clé de contrôle UPS valide',
    });
  });

  it('says it is wrong, and keeps quiet on an empty field', () => {
    expect(checkTracking('1ZE6344W0499230623', 'UPS', t).check?.tone).toBe(
      'red',
    );
    expect(checkTracking('  ', 'UPS', t)).toEqual({});
  });

  it('offers the carrier a number names when none is picked', () => {
    expect(checkTracking('1ZE6344W0499230622', '', t).carrier).toBe('UPS');
  });

  it('warns when the number is not one of the carrier picked', () => {
    expect(checkTracking('1ZE6344W0499230622', 'FedEx', t).check?.tone).toBe(
      'orange',
    );
  });
});

describe('loadRecipientBook', () => {
  it('reads the latest parcels first, for the recents', async () => {
    const db = await openTestDatabase();
    const first = parcelRow({ id: newId(), personId: camille.id });
    const second = parcelRow({ id: newId(), contactId: paul.id });
    await db.parcel.bulkPut([first, second]);

    const book = await loadRecipientBook(db);

    expect(book.latest.map((parcel) => parcel.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});
