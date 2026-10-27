import type { Parcel, ParcelState } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import {
  counters,
  filterRows,
  sectionId,
  sectionTitles,
  summarize,
  toSections,
} from '#/features/parcels/sections';

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

describe('section titles', () => {
  it('maps the ids kept on the iPhone to the titles drawn, and back', () => {
    expect(sectionTitles(['handedOver', 'incomplete'])).toEqual([
      'À compléter',
      'Remis aujourd’hui',
    ]);
    expect(sectionId('En attente de retrait')).toBe('waiting');
    expect(sectionId('Inconnue')).toBeUndefined();
  });
});

describe('counters', () => {
  const rows = [
    parcel('a', 'incomplete'),
    parcel('b', 'notified'),
    parcel('c', 'late'),
    parcel('d', 'toNotify'),
  ];

  it('counts what is left to complete, to hand over, to chase', () => {
    expect(counters(rows, null)).toEqual([
      { id: 'incomplete', label: 'À compléter', count: 1 },
      { id: 'waiting', label: 'À retirer', count: 2 },
      { id: 'late', label: 'En souffrance', count: 1 },
    ]);
  });

  it('keeps only the rows of the counter on', () => {
    expect(filterRows(rows, 'incomplete').map((p) => p.id)).toEqual(['a']);
    expect(filterRows(rows, 'waiting').map((p) => p.id)).toEqual(['b', 'c']);
    expect(filterRows(rows, null)).toHaveLength(4);
  });

  it('leaves out a counter at zero, unless it is on', () => {
    const done = [parcel('d', 'toNotify')];
    expect(counters(done, null)).toEqual([]);
    expect(counters(done, 'incomplete')).toEqual([
      { id: 'incomplete', label: 'À compléter', count: 0 },
    ]);
  });
});
