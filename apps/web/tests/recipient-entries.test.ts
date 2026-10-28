import { describe, expect, it } from 'vitest';
import { recipientEntries } from '#/features/recipient/entries';
import { contactRow, NOW, personRow } from './helpers/local-rows';

describe('recipientEntries', () => {
  it('lists the active cards, then the contacts, a contact split on its last word with its uses', () => {
    const entries = recipientEntries(
      [
        personRow({ id: 'lea', firstName: 'Léa', lastName: 'Fontaine' }),
        personRow({ id: 'gone', active: false }),
        personRow({ id: 'deleted', deletedAt: NOW }),
      ],
      [
        contactRow({ id: 'nora', name: ' Nora  Ben Haddad ', usageCount: 3 }),
        contactRow({ id: 'old', deletedAt: NOW }),
      ],
    );

    expect(entries).toEqual([
      { id: 'lea', kind: 'person', firstName: 'Léa', lastName: 'Fontaine' },
      {
        id: 'nora',
        kind: 'contact',
        firstName: 'Nora Ben',
        lastName: 'Haddad',
        uses: 3,
      },
    ]);
  });
});
