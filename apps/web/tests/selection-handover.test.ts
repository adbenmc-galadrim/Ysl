import { describe, expect, it } from 'vitest';
import { readQueue, shiftQueue, writeQueue } from '#/features/handover/queue';
import {
  parseRemiseColisSearch,
  untickedAtFirst,
} from '#/features/handover/route';
import { planHandovers } from '#/features/parcels/selection';
import { NOW, parcelRow } from './helpers/local-rows';

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('handing a selection over', () => {
  it('makes one handover per person or contact and counts the parcels nobody is set for', () => {
    const nora = parcelRow({ personId: 'p-nora' });
    const noraNotified = parcelRow({
      personId: 'p-nora',
      status: 'notifie',
      notifiedAt: NOW,
    });
    const marc = parcelRow({ contactId: 'c-marc' });
    const { groups, skipped } = planHandovers([
      nora,
      marc,
      noraNotified,
      parcelRow({ status: 'a_completer', readName: 'J. Doe' }),
      parcelRow({ readName: 'Sans fiche' }),
      parcelRow({ personId: 'p-nora', status: 'remis', deliveredAt: NOW }),
      parcelRow({ personId: 'p-nora', deletedAt: NOW }),
    ]);

    expect(groups).toEqual([
      {
        recipient: { kind: 'person', id: 'p-nora' },
        parcelIds: [nora.id, noraNotified.id],
      },
      { recipient: { kind: 'contact', id: 'c-marc' }, parcelIds: [marc.id] },
    ]);
    expect(skipped).toBe(2);
  });

  it('opens « Remise, colis » with only the ticked parcels ticked, by name', () => {
    const search = parseRemiseColisSearch({
      kind: 'person',
      id: 'p-nora',
      via: 'manuel',
      colis: ['a', 'c'],
      file: true,
    });

    expect(search).toMatchObject({
      via: 'manuel',
      colis: ['a', 'c'],
      file: true,
    });
    expect(untickedAtFirst(['a', 'b', 'c', 'd'], search.colis)).toEqual([
      'b',
      'd',
    ]);
    expect(untickedAtFirst(['a', 'b'], undefined)).toEqual([]);
  });

  it('hands the queue over person by person, then forgets it', () => {
    const store = memoryStore();
    writeQueue(
      [
        {
          kind: 'person',
          id: 'p-hugo',
          name: 'Hugo Lefèvre',
          parcelIds: ['h'],
        },
        {
          kind: 'contact',
          id: 'c-marc',
          name: 'Marc',
          parcelIds: ['m1', 'm2'],
        },
      ],
      store,
    );

    expect(shiftQueue(store)?.name).toBe('Hugo Lefèvre');
    expect(readQueue(store).map((row) => row.id)).toEqual(['c-marc']);
    expect(shiftQueue(store)?.parcelIds).toEqual(['m1', 'm2']);
    expect(shiftQueue(store)).toBeUndefined();
    store.setItem('courrier.remise.file', '{broken');
    expect(readQueue(store)).toEqual([]);
  });
});
