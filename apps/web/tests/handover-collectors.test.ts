import { describe, expect, it } from 'vitest';
import { collectors, recipientOfRow } from '#/features/handover/collectors';
import { contactRow, personRow } from './helpers/local-rows';

const hugo = personRow({
  firstName: 'Hugo',
  lastName: 'Lefèvre',
  nameNorm: 'hugo lefevre',
  department: 'Finance',
});
const helene = personRow({
  firstName: 'Hélène',
  lastName: 'Lefebvre',
  nameNorm: 'helene lefebvre',
});
const atelier = contactRow({ name: 'Marc Petit', nameNorm: 'marc petit' });
const counts = new Map([
  [`person:${hugo.id}`, 2],
  [`contact:${atelier.id}`, 1],
]);

describe('« Qui retire ses colis ? »', () => {
  it('finds a name without its accents, parcels first with how many', () => {
    const { waiting, others } = collectors(
      [hugo, helene],
      [atelier],
      counts,
      'lefe',
    );

    expect(waiting).toEqual([
      {
        person: {
          id: `person:${hugo.id}`,
          name: 'Hugo Lefèvre',
          initials: 'HL',
          department: 'Finance',
        },
        parcels: 2,
      },
    ]);
    expect(others.map((o) => o.name)).toEqual(['Hélène Lefebvre']);
  });

  it('lists everyone with parcels waiting before anything is typed', () => {
    const { waiting, others } = collectors(
      [hugo, helene],
      [atelier],
      counts,
      '',
    );

    expect(waiting.map((w) => [w.person.name, w.parcels])).toEqual([
      ['Hugo Lefèvre', 2],
      ['Marc Petit', 1],
    ]);
    expect(others).toEqual([]);
  });

  it('leads a row back to its card or contact', () => {
    expect(recipientOfRow(`contact:${atelier.id}`)).toEqual({
      kind: 'contact',
      id: atelier.id,
    });
  });
});
