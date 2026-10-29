import { describe, expect, it } from 'vitest';
import {
  announcedCollector,
  collectorCard,
  collectorChoices,
  collectorName,
} from '#/features/handover/collector';
import { contactRow, NOW, parcelRow, personRow } from './helpers/local-rows';

const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);

const paul = personRow({
  firstName: 'Paul',
  lastName: 'Mercier',
  nameNorm: 'paul mercier',
  department: 'Juridique',
});
const marc = contactRow({
  name: 'Marc Petit',
  nameNorm: 'marc petit',
  department: 'Intérim',
});

describe('announcedCollector', () => {
  it('offers the colleague of the latest reply among the parcels still notified', () => {
    const parcels = [
      parcelRow({
        status: 'notifie',
        expectedDelegate: 'Lucas Martin',
        repliedAt: NOW,
      }),
      parcelRow({
        status: 'notifie',
        expectedDelegate: 'Paul Mercier',
        repliedAt: LATER,
      }),
      parcelRow({ status: 'recu' }),
    ];

    expect(announcedCollector(parcels)).toEqual({
      name: 'Paul Mercier',
      at: LATER,
    });
  });

  it('offers the colleague without a date when the reply was not dated', () => {
    expect(
      announcedCollector([
        parcelRow({ status: 'notifie', expectedDelegate: 'Paul Mercier' }),
      ]),
    ).toEqual({ name: 'Paul Mercier', at: null });
  });

  it('offers nobody when no one was announced, or the parcel was not notified', () => {
    expect(
      announcedCollector([
        parcelRow({ status: 'notifie' }),
        parcelRow({ status: 'recu', expectedDelegate: 'Paul Mercier' }),
      ]),
    ).toBeNull();
  });
});

describe('collectorCard', () => {
  it('finds the department of the card or contact that bears the name', () => {
    expect(collectorCard('paul MERCIER', [paul], [marc])).toEqual({
      name: 'Paul Mercier',
      initials: 'PM',
      department: 'Juridique',
    });
    expect(collectorCard('Marc Petit', [paul], [marc])).toMatchObject({
      name: 'Marc Petit',
      department: 'Hors annuaire, Intérim',
    });
  });

  it('keeps a name nobody bears as it was said', () => {
    expect(collectorCard('Léa Roux', [paul], [marc])).toEqual({
      name: 'Léa Roux',
      initials: 'LR',
    });
  });
});

describe('collectorChoices', () => {
  it('searches the directory and the contacts, nothing before a letter is typed', () => {
    expect(collectorChoices([paul], [marc], '').listed).toEqual([]);
    expect(
      collectorChoices([paul], [marc], 'merc').listed.map((row) => row.name),
    ).toEqual(['Paul Mercier']);
    expect(
      collectorChoices([paul], [marc], 'petit').listed.map((row) => row.name),
    ).toEqual(['Marc Petit']);
  });
});

describe('collectorName', () => {
  it('keeps a typed name tidy, and nobody for the recipient themselves', () => {
    expect(collectorName('  Léa   Roux ', 'Nora Haddad')).toBe('Léa Roux');
    expect(collectorName('NORA haddad', 'Nora Haddad')).toBeNull();
    expect(collectorName('   ', 'Nora Haddad')).toBeNull();
    expect(collectorName(' ... ', 'Nora Haddad')).toBeNull();
  });
});
