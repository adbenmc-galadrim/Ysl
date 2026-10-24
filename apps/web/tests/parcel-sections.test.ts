import type { Parcel, ParcelState } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import { summarize, toSections } from '#/features/parcels/sections';

const parcel = (id: string, state: ParcelState): Parcel => ({
  id,
  recipient: 'Destinataire',
  department: 'Service',
  carrier: 'Transporteur',
  last4: '0000',
  state,
  status: '',
});

describe('toSections', () => {
  it('keeps every state, in the order the day is worked in', () => {
    const sections = toSections([
      parcel('e', 'handedOver'),
      parcel('d', 'late'),
      parcel('c', 'notified'),
      parcel('b', 'toNotify'),
      parcel('a', 'incomplete'),
    ]);
    expect(sections.map((section) => section.title)).toEqual([
      'À compléter',
      'À notifier',
      'En attente de retrait',
      'Remis aujourd’hui',
    ]);
    expect(sections[2]?.parcels.map((row) => row.id)).toEqual(['d', 'c']);
  });

  it('leaves out an empty section', () => {
    expect(toSections([parcel('a', 'notified')]).map((s) => s.title)).toEqual([
      'En attente de retrait',
    ]);
  });
});

describe('summarize', () => {
  it('counts what is left to do', () => {
    expect(
      summarize([
        parcel('a', 'incomplete'),
        parcel('b', 'toNotify'),
        parcel('c', 'notified'),
      ]),
    ).toBe('3 colis, dont 2 à traiter');
  });

  it('says so when nothing waits', () => {
    expect(summarize([])).toBe('Aucun colis en attente');
  });
});
