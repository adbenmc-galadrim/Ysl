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

/**
 * The host company and its street as labels print them, OCR slips allowed:
 * debris of these lines must never bring a person (v1 `RE_CO`, `RE_ADDR`).
 * « Laurent » alone stays a first name; only the phrase is the company.
 */
const HOST_PHRASES = [
  /\b(?:Y[VW]ES\s*)?S[A4][I1L!|]NT\s*-?\s*L[A4][UV]R[A-Z0-9]*/gi,
  /\bYSL\b/gi,
];

/** Single words of the host's address, matched at one edit (v1 `isNameWord`). */
const HOST_WORDS = ['saint', 'bellechasse', 'ysl'];

const DIGIT_LETTERS: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
};

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

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

export const isHostWord = (word: string) =>
  HOST_WORDS.some((host) => withinOneEdit(word, host));

/** The text without the host company's name, which says nothing of the person. */
export const withoutHost = (text: string) =>
  HOST_PHRASES.reduce((rest, phrase) => rest.replace(phrase, ' '), text);

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
): string[] {
  const words = withoutHost(text)
    .split(/[\s:;,/]+/)
    .filter((word) => word !== '')
    .map((word) => fixOcrWord(word, firstNames));
  return words
    .flatMap(nameTokens)
    .filter(
      (token) =>
        !PARTICLES.has(token) && !NOT_NAME.has(token) && !isHostWord(token),
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
): string | null {
  const raw = withoutHost(text)
    .replace(/\b(\p{Lu})\.(?=\p{Lu}{2,})/gu, '$1. ')
    .split(/[\s:;,/]+/)
    .filter((word) => word !== '');
  if (raw.length > 1 && CIVILITY.test(raw[0]!)) raw.shift();
  const words = raw
    .map((word) => fixOcrWord(word, firstNames).replace(/\|+/g, ' ').trim())
    .filter((word) =>
      nameTokens(word).some(
        (token) => !NOT_NAME.has(token) && !isHostWord(token),
      ),
    )
    .map((word) => (/^\p{L}$/u.test(word) ? `${word}.` : word));
  return words.length ? toTitle(words.join(' ')) : null;
}
