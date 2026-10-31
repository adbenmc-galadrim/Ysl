/** Name particles (v1): never a name on their own, kept between two names. */
export const PARTICLES = new Set([
  'de',
  'du',
  'da',
  'di',
  'le',
  'la',
  'el',
  'al',
  'van',
  'von',
  'del',
  'dos',
  'des',
]);

/** Words of a label that are never a name (v1 `NOT_NAME`, carriers, civilities). */
export const NOT_NAME = new Set([
  'rue',
  'avenue',
  'av',
  'bd',
  'boulevard',
  'place',
  'paris',
  'france',
  'cedex',
  'contact',
  'ship',
  'to',
  'from',
  'phone',
  'tel',
  'ref',
  'colis',
  'num',
  'poids',
  'weight',
  'kg',
  'origin',
  'date',
  'tracking',
  'waybill',
  'ile',
  'delivery',
  'address',
  'sender',
  'expediteur',
  'destinataire',
  'recipient',
  'service',
  'express',
  'worldwide',
  'italy',
  'attn',
  'dpd',
  'chronopost',
  'colissimo',
  'poste',
  'ups',
  'dhl',
  'fedex',
  'tnt',
  'gls',
  'capital',
  'social',
  'rcs',
  'siege',
  'tva',
  'mr',
  'mrs',
  'ms',
  'mme',
  'mlle',
  'dr',
]);

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** What one letter of an anchor may print as: an OCR slip (v1 `RE_CO`), or its accent. */
const PRINTED_AS: Record<string, string> = {
  A: 'A4ÀÂÄ',
  C: 'CÇ',
  E: 'EÉÈÊË',
  I: 'I1L!|ÎÏ',
  O: 'OÔÖ',
  U: 'UVÙÛÜ',
  V: 'VW',
  "'": "'’",
};

const WHOLE_WORD_UP_TO = 4;

const letterPattern = (letter: string) => {
  const printed = PRINTED_AS[letter];
  if (printed) return `[${printed.replace('|', '\\|')}]`;
  return letter.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
};

const wordPattern = (word: string) => [...word].map(letterPattern).join('');

/**
 * An anchor as labels print it, OCR slips allowed, on the raw text: the
 * anchor is folded, the text is not. The last word of a phrase keeps its first
 * letters only, the rest being the most damaged (« SAINT LAUREN1 »); a single
 * word must be whole, it could start a name.
 */
function anchorPhrase(anchor: string): RegExp | null {
  const words = fold(anchor)
    .replace(/’/g, "'")
    .toUpperCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  const last = words.at(-1);
  if (!last) return null;
  const open = words.length > 1 && last.length > WHOLE_WORD_UP_TO;
  const pattern = [
    ...words.slice(0, -1).map(wordPattern),
    wordPattern(open ? last.slice(0, WHOLE_WORD_UP_TO) : last) +
      (open ? '[\\p{L}\\p{N}]*' : '(?![\\p{L}\\p{N}])'),
  ].join('\\s*-?\\s*');
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}`, 'giu');
}

/** How a company's own name and street print: debris of these never bring a person. */
export type HostMarks = {
  phrases: readonly RegExp[];
  /** Single words of its name and address, matched at one edit (v1 `isNameWord`). */
  words: readonly string[];
};

export const NO_HOST: HostMarks = { phrases: [], words: [] };

/**
 * The longest anchor first: « Saint Laurent » must not leave « Yves » behind.
 * A long single word goes word by word only: cut out of the text, « Saint »
 * would turn « Marie Saint-Martin » into « Marie Martin ».
 */
export function hostMarks(anchors: readonly string[]): HostMarks {
  if (anchors.length === 0) return NO_HOST;
  const longest = [...anchors].sort((a, b) => b.length - a.length);
  return {
    phrases: longest
      .filter(
        (anchor) =>
          !/^\p{L}+$/u.test(fold(anchor).trim()) ||
          anchor.trim().length <= WHOLE_WORD_UP_TO,
      )
      .flatMap((anchor) => anchorPhrase(anchor) ?? []),
    words: anchors
      .map((anchor) => fold(anchor).trim())
      .filter((anchor) => /^\p{L}+$/u.test(anchor)),
  };
}

const DIGIT_LETTERS: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
};

/** Lower case, no accent, letters only: how names are compared. */
export const nameTokens = (text: string): string[] =>
  fold(text)
    .split(/[^a-z]+/)
    .filter((word) => word !== '');

/** True when `a` and `b` are at most one insertion, deletion or substitution apart. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (short.length === long.length) i += 1;
    j += 1;
  }
  return edits + (long.length - j) + (short.length - i) <= 1;
}

export const isHostWord = (word: string, host: HostMarks = NO_HOST) =>
  host.words.some((own) => withinOneEdit(word, own));

/** The text without the host company's name, which says nothing of the person. */
export const withoutHost = (text: string, host: HostMarks = NO_HOST) =>
  host.phrases.reduce((rest, phrase) => rest.replace(phrase, ' '), text);

/**
 * One word as the OCR printed it, mended the v1 way (`fixOcrWord`): a
 * leading `|`, `l` or `!` before capitals is a lost `I` when the directory
 * knows the first name, else noise; one or two digits among three letters
 * or more are letters (`EULAL1E`); a lower-case first letter before
 * capitals is a capital (`eULALIE`); punctuation at the edges goes.
 */
export function fixOcrWord(
  raw: string,
  firstNames: ReadonlySet<string> = new Set(),
): string {
  const lostI = /^[|l!]([A-ZÀ-Ý]{3,})$/.exec(raw);
  if (lostI) {
    const withI = `I${lostI[1]}`;
    return firstNames.has(fold(withI)) ? withI : lostI[1]!;
  }
  let word = raw.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
  const digits = word.match(/\d/g)?.length ?? 0;
  const letters = word.match(/\p{L}/gu)?.length ?? 0;
  if (digits > 0 && digits <= 2 && letters >= 3) {
    word = word.replace(/[0158]/g, (d) => DIGIT_LETTERS[d]!);
  }
  if (/^[a-zà-ÿ][A-ZÀ-Ý'’-]{2,}$/.test(word)) word = word.toUpperCase();
  return word;
}

/**
 * The words of a name as read: host company out, each word mended, a `|`
 * left inside a word taken for a separator, particles, civilities and label
 * words dropped.
 * Single letters stay: an initial (`L. FONTAINE`) counts for a first name.
 */
export function readTokens(
  text: string,
  firstNames: ReadonlySet<string> = new Set(),
  host: HostMarks = NO_HOST,
): string[] {
  const words = withoutHost(text, host)
    .split(/[\s:;,/]+/)
    .filter((word) => word !== '')
    .map((word) => fixOcrWord(word, firstNames));
  return words
    .flatMap(nameTokens)
    .filter(
      (token) =>
        !PARTICLES.has(token) &&
        !NOT_NAME.has(token) &&
        !isHostWord(token, host),
    );
}

/** « L. FONTAIN » → « L. Fontain » (v1 `toTitle`). */
export const toTitle = (text: string) =>
  text
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, edge: string, letter: string) => {
      return edge + letter.toUpperCase();
    });

const CIVILITY = /^(?:M|MR|MRS|MS|MME|MLLE|DR)\.?$/i;

/**
 * The name as read, mended and in title case, for a new card prefilled
 * from it: a leading civility goes, an initial keeps its dot.
 */
export function readableName(
  text: string,
  firstNames: ReadonlySet<string> = new Set(),
  host: HostMarks = NO_HOST,
): string | null {
  const raw = withoutHost(text, host)
    .replace(/\b(\p{Lu})\.(?=\p{Lu}{2,})/gu, '$1. ')
    .split(/[\s:;,/]+/)
    .filter((word) => word !== '');
  if (raw.length > 1 && CIVILITY.test(raw[0]!)) raw.shift();
  const words = raw
    .map((word) => fixOcrWord(word, firstNames).replace(/\|+/g, ' ').trim())
    .filter((word) =>
      nameTokens(word).some(
        (token) => !NOT_NAME.has(token) && !isHostWord(token, host),
      ),
    )
    .map((word) => (/^\p{L}$/u.test(word) ? `${word}.` : word));
  return words.length ? toTitle(words.join(' ')) : null;
}
