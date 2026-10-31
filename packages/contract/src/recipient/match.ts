import {
  nameTokens,
  PARTICLES,
  readableName,
  readTokens,
  withinOneEdit,
} from './words';

/** A card of the directory (`directory_person`) or a contact outside it (`contact`). */
export type RecipientKind = 'person' | 'contact';

export type RecipientEntry = {
  id: string;
  kind: RecipientKind;
  firstName: string;
  lastName: string;
  /** How many parcels the mailroom gave a contact (F27): a visitor who comes back rises on a tie. */
  uses?: number;
  /** The department that holds a card, none on a row the device has not pulled again. Tells two cards of one name apart. */
  departmentId?: string | null;
  /** Its name, as the agent reads it. */
  department?: string;
};

/** A contact given this many parcels comes back: it passes a card on a tie (F27). */
export const FREQUENT_USES = 2;

const comesBack = (entry: RecipientEntry) =>
  (entry.uses ?? 0) >= FREQUENT_USES ? entry.uses! : 0;

type Indexed = {
  entry: RecipientEntry;
  first: string[];
  last: string[];
  /** First and last name glued, as an OCR that lost the space reads them. */
  glued: string;
  order: string;
};

/** The directory prepared once for many readings. */
export type RecipientIndex = {
  entries: readonly Indexed[];
  /** First names the directory knows, for the lost `I` of `|SABELLE` (§4.8). */
  firstNames: ReadonlySet<string>;
};

/** Where a name comes from: a structured code, the OCR's name, or the whole text. */
export type ReadSource = 'code' | 'ocr' | 'text';

export type RecipientRead = {
  text: string;
  source: Exclude<ReadSource, 'text'>;
};

export type RecipientMatch = {
  entry: RecipientEntry;
  /** v1 scale: 2 per name word found as is, 1 at one edit or cut short, 0,5 for an initial; a last name alone counts half. */
  score: number;
  /** First and last name both found as is. */
  exact: boolean;
  source: ReadSource;
};

export type RecipientResult = {
  /** The name read, mended: what a new card is prefilled with. */
  readName: string | null;
  /** The closest people, best first, three at most. */
  suggestions: RecipientMatch[];
  /**
   * The suggestion that stands out: a first name (or its initial) and a
   * last name, ahead of every other. A last name alone never does.
   */
  best: RecipientMatch | null;
};

export const SUGGESTIONS = 3;
export const MIN_SCORE = 1;
export const BEST_SCORE = 2.5;
export const EXACT_SCORE = 4;
/** One edit is forgiven from five letters on (v1, §4.8). */
export const FUZZY_MIN_LENGTH = 5;
/** A word cut short by a fold or a glare still counts from four letters. */
export const PREFIX_MIN_LENGTH = 4;

const significant = (text: string) =>
  nameTokens(text).filter((token) => !PARTICLES.has(token));

export function indexRecipients(
  entries: readonly RecipientEntry[],
): RecipientIndex {
  const indexed: Indexed[] = [];
  const firstNames = new Set<string>();
  for (const entry of entries) {
    let first = significant(entry.firstName);
    let last = significant(entry.lastName);
    if (last.length === 0) [first, last] = [[], first];
    if (last.length === 0) continue;
    for (const name of first) firstNames.add(name);
    indexed.push({
      entry,
      first,
      last,
      glued: first.length ? [...first, ...last].join('') : '',
      order: [...first, ...last].join(' '),
    });
  }
  return { entries: indexed, firstNames };
}

/** A word read, or two neighbours glued, with the positions it covers. */
type Item = { word: string; parts: readonly number[] };

type Read = {
  items: readonly Item[];
  exact: ReadonlyMap<string, readonly Item[]>;
};

type Hit = { score: number; parts: readonly number[] };

const NONE: Hit = { score: 0, parts: [] };

const overlaps = (a: readonly number[], b: readonly number[]) =>
  a.some((part) => b.includes(part));

const close = (word: string, token: string) =>
  (token.length >= PREFIX_MIN_LENGTH &&
    word.length > token.length &&
    word.startsWith(token)) ||
  (word.length >= FUZZY_MIN_LENGTH && withinOneEdit(word, token));

/** The best word read for one name word, among those not `taken` by the other name. */
const hitOf = (
  word: string,
  read: Read,
  strict: boolean,
  taken: readonly number[],
): Hit => {
  for (const item of read.exact.get(word) ?? []) {
    if (!overlaps(item.parts, taken)) return { score: 2, parts: item.parts };
  }
  if (strict) return NONE;
  for (const item of read.items) {
    if (!overlaps(item.parts, taken) && close(word, item.word)) {
      return { score: 1, parts: item.parts };
    }
  }
  return NONE;
};

const bestOf = (
  words: readonly string[],
  read: Read,
  strict: boolean,
  taken: readonly number[] = [],
) =>
  words.reduce<Hit>((top, word) => {
    const found = hitOf(word, read, strict, taken);
    return found.score > top.score ? found : top;
  }, NONE);

/** The words read, and each pair of neighbours glued: an OCR that cut `EULALIE` in two (v1). */
const readOf = (tokens: readonly string[]): Read => {
  const items: Item[] = tokens.map((word, i) => ({ word, parts: [i] }));
  tokens.slice(1).forEach((token, i) => {
    const word = tokens[i]! + token;
    if (tokens[i]!.length > 1 && word.length > 3) {
      items.push({ word, parts: [i, i + 1] });
    }
  });
  const exact = new Map<string, Item[]>();
  for (const item of items) {
    exact.set(item.word, [...(exact.get(item.word) ?? []), item]);
  }
  return { items, exact };
};

/**
 * v1 `matchEmployeesInText`: last name and first name weighed, a last name
 * alone halved, an initial worth half a first name. The two names rest on
 * different words read: « MARTIN » alone is not Martin Martin. A stray
 * letter of the whole text is no initial.
 */
const scoreOf = (person: Indexed, read: Read, strict: boolean): number => {
  if (person.glued && read.exact.has(person.glued)) return EXACT_SCORE;
  const weigh = (lastFirst: boolean) => {
    let last: Hit;
    let first: Hit;
    if (lastFirst) {
      last = bestOf(person.last, read, strict);
      first = bestOf(person.first, read, strict, last.parts);
    } else {
      first = bestOf(person.first, read, strict);
      last = bestOf(person.last, read, strict, first.parts);
    }
    if (last.score === 0) return 0;
    let score = first.score;
    const initial = (item: Item) =>
      item.word.length === 1 &&
      !overlaps(item.parts, last.parts) &&
      person.first.some((name) => name[0] === item.word);
    if (!strict && score === 0 && read.items.some(initial)) score = 0.5;
    return score > 0 ? last.score + score : last.score / 2;
  };
  return Math.max(weigh(true), weigh(false));
};

const KIND_ORDER: Record<RecipientKind, number> = { person: 0, contact: 1 };

/**
 * The recipient chain of F18 after the reading: the names a code or the OCR
 * gave, mended, weighed against every card; without any name, the whole
 * printed text, exact words only (v1 strict mode). The best ranked first;
 * on a tie, a contact who keeps coming back, then a card before a contact,
 * then twins by department: nothing stands out among them (no `best`), so
 * the agent chooses, the department telling them apart.
 * An empty directory proposes nobody and still returns the name read, for
 * a new card.
 */
export function matchRecipient(
  index: RecipientIndex,
  reads: readonly RecipientRead[],
  text?: string | null,
): RecipientResult {
  const named = reads
    .map((read) => ({
      source: read.source,
      tokens: readTokens(read.text, index.firstNames),
      readName: readableName(read.text, index.firstNames),
    }))
    .filter((read) => read.tokens.length > 0);
  const strict = named.length === 0;
  const passes = strict
    ? text
      ? [
          {
            source: 'text' as const,
            tokens: readTokens(text, index.firstNames),
          },
        ]
      : []
    : named;

  const scored: RecipientMatch[] = [];
  for (const person of index.entries) {
    let top: RecipientMatch | null = null;
    for (const pass of passes) {
      const read = readOf(pass.tokens);
      const score = scoreOf(person, read, strict);
      if (score >= MIN_SCORE && (!top || score > top.score)) {
        top = {
          entry: person.entry,
          score,
          exact: score === EXACT_SCORE,
          source: pass.source,
        };
      }
    }
    if (top) scored.push(top);
  }

  const order = new Map(index.entries.map((p) => [p.entry, p.order]));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      comesBack(b.entry) - comesBack(a.entry) ||
      KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] ||
      order.get(a.entry)!.localeCompare(order.get(b.entry)!) ||
      (a.entry.department ?? '').localeCompare(b.entry.department ?? '') ||
      a.entry.id.localeCompare(b.entry.id),
  );
  const [first, second] = scored;
  return {
    readName: named[0]?.readName ?? null,
    suggestions: scored.slice(0, SUGGESTIONS),
    best:
      first && first.score >= BEST_SCORE && (second?.score ?? 0) < first.score
        ? first
        : null,
  };
}

/**
 * The only match taken without the agent: a name a code printed that is,
 * first name and last name, one card and no other. An OCR name, however
 * exact, and a partial homonym always go before the agent.
 */
export function silentMatch(result: RecipientResult): RecipientMatch | null {
  const { best } = result;
  return best?.exact && best.source === 'code' ? best : null;
}
