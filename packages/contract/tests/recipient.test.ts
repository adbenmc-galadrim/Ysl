import { describe, expect, it } from 'vitest';
import {
  fixOcrWord,
  indexRecipients,
  matchRecipient,
  readableName,
  type RecipientEntry,
  silentMatch,
  type RecipientRead,
} from '@repo/contract/recipient';

const person = (
  id: string,
  firstName: string,
  lastName: string,
): RecipientEntry => ({ id, kind: 'person', firstName, lastName });

const DIRECTORY = indexRecipients([
  person('lea', 'Léa', 'Fontaine'),
  person('louis', 'Louis', 'Fontaine'),
  person('lise', 'Lise', 'Fontan'),
  person('isabelle', 'Isabelle', 'Moreau'),
  person('eulalie', 'Eulalie', 'Lefèvre'),
  person('axelle', 'Axelle', 'Lelievre'),
  person('pierre', 'Pierre', 'de La Rochère'),
  person('laurent', 'Laurent', 'Martin'),
  person('hugo', 'Hugo', 'Dupont'),
  person('leo', 'Léo', 'Durand'),
  { id: 'nora', kind: 'contact', firstName: 'Nora', lastName: 'Haddad' },
]);

const ocr = (text: string): RecipientRead => ({ text, source: 'ocr' });
const code = (text: string): RecipientRead => ({ text, source: 'code' });

const ids = (reads: RecipientRead[], text?: string) =>
  matchRecipient(DIRECTORY, reads, text).suggestions.map((s) => s.entry.id);

const bestOf = (reads: RecipientRead[], text?: string) =>
  matchRecipient(DIRECTORY, reads, text).best?.entry.id ?? null;

describe('fixOcrWord — v1 corrections', () => {
  it('reads one or two digits among letters as letters', () => {
    expect(fixOcrWord('EULAL1E')).toBe('EULALIE');
    expect(fixOcrWord('M0REAU')).toBe('MOREAU');
    expect(fixOcrWord('DUP0NT5')).toBe('DUPONTS');
    expect(fixOcrWord('75007')).toBe('75007');
  });

  it('takes a leading bar for the I the directory knows, else for noise', () => {
    const known = new Set(['isabelle']);
    expect(fixOcrWord('|SABELLE', known)).toBe('ISABELLE');
    expect(fixOcrWord('lSABELLE', known)).toBe('ISABELLE');
    expect(fixOcrWord('|MOREAU', known)).toBe('MOREAU');
  });

  it('raises a lower-case first letter and drops edge punctuation', () => {
    expect(fixOcrWord('eULALIE')).toBe('EULALIE');
    expect(fixOcrWord('«FONTAINE».')).toBe('FONTAINE');
  });
});

describe('matchRecipient — the read name', () => {
  it('finds a full name in any order, accents aside', () => {
    expect(bestOf([ocr('FONTAINE LEA')])).toBe('lea');
    expect(bestOf([ocr('Léa Fontaine')])).toBe('lea');
    const { best } = matchRecipient(DIRECTORY, [code('LEA FONTAINE')]);
    expect(best).toMatchObject({ exact: true, source: 'code', score: 4 });
  });

  it('mends the OCR before matching', () => {
    expect(bestOf([ocr('EULAL1E LEFEVRE')])).toBe('eulalie');
    expect(bestOf([ocr('|SABELLE MOREAU')])).toBe('isabelle');
    expect(bestOf([ocr('ISABELLE | MOREAU')])).toBe('isabelle');
  });

  it('glues a word the OCR cut in two, and splits two it glued', () => {
    expect(bestOf([ocr('EU LALIE LEFEVRE')])).toBe('eulalie');
    expect(bestOf([ocr('LEFEV RE EULALIE')])).toBe('eulalie');
    expect(bestOf([ocr('AXELLELELIEVRE')])).toBe('axelle');
  });

  it('skips particles on both sides', () => {
    expect(bestOf([ocr('PIERRE DE LA ROCHERE')])).toBe('pierre');
    expect(bestOf([ocr('PIERRE ROCHERE')])).toBe('pierre');
  });

  it('forgives one edit from five letters on, not below', () => {
    expect(bestOf([ocr('HUGO DUPOND')])).toBe('hugo');
    expect(bestOf([ocr('LEA FONTAIME')])).toBe('lea');
    expect(bestOf([ocr('HUGA DUPONT')])).toBe(null);
    expect(bestOf([ocr('LEA DURAND')])).toBe(null);
    expect(ids([ocr('LEA DURAND')])).toEqual(['leo']);
  });

  it('weighs the first name with the last: a last name alone counts half', () => {
    const { suggestions } = matchRecipient(DIRECTORY, [ocr('HUGO DUPONT')]);
    expect(suggestions[0]).toMatchObject({ score: 4 });
    const alone = matchRecipient(DIRECTORY, [ocr('DUPONT')]);
    expect(alone.suggestions[0]).toMatchObject({ score: 1 });
  });

  it('never selects a partial homonym on its own', () => {
    expect(bestOf([ocr('FONTAINE')])).toBe(null);
    expect(bestOf([code('FONTAINE')])).toBe(null);
    expect(bestOf([ocr('L. FONTAINE')])).toBe(null);
    expect(ids([ocr('L. FONTAINE')])).toEqual(['lea', 'louis']);
    expect(bestOf([ocr('DUPONT')])).toBe(null);
  });

  it('ranks the three closest for a name cut short', () => {
    const { suggestions, best, readName } = matchRecipient(DIRECTORY, [
      ocr('L. FONTAIN'),
    ]);
    expect(suggestions.map((s) => s.entry.id)).toEqual([
      'lea',
      'lise',
      'louis',
    ]);
    expect(best).toBeNull();
    expect(readName).toBe('L. Fontain');
  });

  it('never counts one word read for both names', () => {
    const martins = indexRecipients([
      person('mm', 'Martin', 'Martin'),
      person('pm', 'Paul', 'Martin'),
      person('ma', 'Martin', 'Arnaud'),
    ]);
    const read = (text: string) => matchRecipient(martins, [code(text)]);
    expect(read('PAUL MARTIN').best?.entry.id).toBe('pm');
    expect(read('MARTIN ARNAUD').best?.entry.id).toBe('ma');
    expect(read('MARTIN').best).toBeNull();
    expect(read('MARTIN MARTIN').best?.entry.id).toBe('mm');
  });

  it('takes an initial with a unique last name', () => {
    expect(bestOf([ocr('H. DUPONT')])).toBe('hugo');
  });

  it('ignores the debris of the host company', () => {
    expect(ids([ocr('SAINT LAURENT')])).toEqual([]);
    expect(ids([ocr('SA1NT LAURENT BELLECHASSE')])).toEqual([]);
    expect(ids([ocr('YVES SAINT LAURENT MARTIN')])).toEqual(['laurent']);
    expect(bestOf([ocr('LAURENT MARTIN')])).toBe('laurent');
  });

  it('puts a card before a contact on a tie and proposes contacts', () => {
    expect(bestOf([ocr('NORA HADDAD')])).toBe('nora');
  });

  it('proposes a contact read as « M. PETIT », the most used first on a tie', () => {
    const petits = (uses: number) =>
      matchRecipient(
        indexRecipients([
          person('marie', 'Marie', 'Petit'),
          {
            id: 'marc',
            kind: 'contact',
            firstName: 'Marc',
            lastName: 'Petit',
            uses,
          },
        ]),
        [ocr('M. PETIT')],
      ).suggestions.map((s) => s.entry.id);
    expect(petits(1)).toEqual(['marie', 'marc']);
    expect(petits(3)).toEqual(['marc', 'marie']);
  });

  it('keeps the strongest reading of the code and the OCR', () => {
    const { best } = matchRecipient(DIRECTORY, [
      code('HUGO DUPONT'),
      ocr('HUG0 DUP0NT'),
    ]);
    expect(best).toMatchObject({ source: 'code', exact: true });
    const fromOcr = matchRecipient(DIRECTORY, [
      code('FONTAINE'),
      ocr('LEA FONTAINE'),
    ]);
    expect(fromOcr.best).toMatchObject({ source: 'ocr', entry: { id: 'lea' } });
  });
});

describe('matchRecipient — without a name', () => {
  const LABEL = [
    'COLISSIMO',
    'SAINT LAURENT',
    'DUPOND HUGO',
    '37 RUE DE BELLECHASSE',
    '75007 PARIS',
  ].join('\n');

  it('searches the whole text for exact words only', () => {
    expect(bestOf([], LABEL)).toBe(null);
    expect(ids([], LABEL)).toEqual([]);
    expect(bestOf([], LABEL.replace('DUPOND', 'DUPONT'))).toBe('hugo');
    expect(bestOf([], 'COLISSIMO\nH\nDUPONT\n75007 PARIS')).toBe(null);
  });

  it('proposes nobody and keeps the name read when the directory is empty', () => {
    const empty = indexRecipients([]);
    expect(matchRecipient(empty, [ocr('M. JEAN DUPONT')])).toEqual({
      readName: 'Jean Dupont',
      suggestions: [],
      best: null,
    });
    expect(matchRecipient(empty, [], LABEL).readName).toBeNull();
  });
});

describe('silentMatch', () => {
  const silent = (reads: RecipientRead[]) =>
    silentMatch(matchRecipient(DIRECTORY, reads))?.entry.id ?? null;

  it('settles only a code name exact in first and last name', () => {
    expect(silent([code('HUGO DUPONT')])).toBe('hugo');
    expect(silent([ocr('HUGO DUPONT')])).toBeNull();
    expect(silent([code('H. DUPONT')])).toBeNull();
    expect(silent([code('HUGO DUPOND')])).toBeNull();
  });
});

describe('readableName', () => {
  it('mends and title-cases the name for a new card', () => {
    expect(readableName('|SABELLE  MOREAU', new Set(['isabelle']))).toBe(
      'Isabelle Moreau',
    );
    expect(readableName('JEAN-PIERRE DE LA ROCHERE')).toBe(
      'Jean-Pierre De La Rochere',
    );
    expect(readableName('L.FONTAIN')).toBe('L. Fontain');
    expect(readableName('SAINT LAURENT')).toBeNull();
  });
});

describe('twin cards (ME23)', () => {
  const twin = (id: string, department?: string): RecipientEntry => ({
    id,
    kind: 'person',
    firstName: 'Anne',
    lastName: 'Martin',
    ...(department ? { departmentId: `${id}-dep`, department } : {}),
  });

  it('settles neither of two cards of one name, even from a code, and brings both with their department', () => {
    const result = matchRecipient(
      indexRecipients([twin('b', 'Presse'), twin('a', 'Finance')]),
      [{ text: 'Anne Martin', source: 'code' }],
    );

    expect(result.best).toBeNull();
    expect(silentMatch(result)).toBeNull();
    expect(
      result.suggestions.map(({ entry }) => [
        entry.id,
        entry.departmentId,
        entry.department,
      ]),
    ).toEqual([
      ['a', 'a-dep', 'Finance'],
      ['b', 'b-dep', 'Presse'],
    ]);
  });

  it('keeps a card without department among the suggestions, and a stable order', () => {
    const { suggestions, best } = matchRecipient(
      indexRecipients([twin('b'), twin('a', 'Finance'), twin('c')]),
      [{ text: 'Anne Martin', source: 'ocr' }],
    );

    expect(best).toBeNull();
    expect(suggestions.map(({ entry }) => entry.id)).toEqual(['b', 'c', 'a']);
  });
});
