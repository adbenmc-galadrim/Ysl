import { describe, expect, it } from 'vitest';
import { describeRecipient } from '#/features/handover/recipient';
import { parseRemiseColisSearch } from '#/features/handover/route';
import { contactRow, personRow } from './helpers/local-rows';

describe('describeRecipient with departments', () => {
  it('names the department by its id, and keeps the word without one', () => {
    const person = personRow({ departmentId: 'x', department: 'Ancien nom' });

    expect(
      describeRecipient({ kind: 'person', person }, new Map([['x', 'Presse']]))
        .department,
    ).toBe('Presse');
    expect(describeRecipient({ kind: 'person', person }).department).toBe(
      'Ancien nom',
    );
  });
});

describe('the search of /remise/colis', () => {
  it('keeps the code checked by a QR', () => {
    expect(
      parseRemiseColisSearch({
        kind: 'contact',
        id: 'c-1',
        via: 'qr',
        at: '1761300000000',
        code: 'code-1',
      }),
    ).toEqual({
      kind: 'contact',
      id: 'c-1',
      via: 'qr',
      at: 1761300000000,
      code: 'code-1',
    });
  });

  it('never says « vérifié » for a link it cannot read', () => {
    const search = parseRemiseColisSearch({
      id: 'p-1',
      via: 'magic',
      code: 'x',
    });

    expect(search).toMatchObject({ kind: 'person', via: 'manuel' });
    expect(search.code).toBeUndefined();
  });
});

describe('describeRecipient', () => {
  it('names a card by its first and last name', () => {
    expect(
      describeRecipient({
        kind: 'person',
        person: personRow({ firstName: 'Nora', lastName: 'Haddad' }),
      }),
    ).toEqual({
      name: 'Nora Haddad',
      firstName: 'Nora',
      initials: 'NH',
      department: 'Studio',
    });
  });

  it('tells a contact outside the directory apart', () => {
    expect(
      describeRecipient({
        kind: 'contact',
        contact: contactRow({ name: 'Marc Petit', department: 'Intérim' }),
      }),
    ).toMatchObject({
      firstName: 'Marc',
      department: 'Hors annuaire, Intérim',
    });
  });
});
