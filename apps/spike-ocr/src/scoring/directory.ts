import { bestSubstringDistance, normalizeWords } from '#/scoring/text';

export type DirectoryMatch = {
  name: string;
  score: number;
  line: string;
};

export type DirectoryOptions = {
  size?: number;
  seed?: number;
};

export const DIRECTORY_SIZE = 120;
export const MIN_MATCH_SCORE = 0.6;
export const TOP_MATCHES = 3;

const FIRST_NAMES = [
  'Camille',
  'Louise',
  'Hugo',
  'Léa',
  'Nathan',
  'Inès',
  'Jules',
  'Chloé',
  'Arthur',
  'Manon',
  'Théo',
  'Zoé',
  'Gabriel',
  'Jade',
  'Raphaël',
  'Lina',
  'Sacha',
  'Alice',
  'Noah',
  'Rose',
  'Éloïse',
  'Maël',
  'Agathe',
  'Yanis',
  'Mathis',
  'Clara',
  'Lucas',
  'Emma',
];

const LAST_NAMES = [
  'Bernard',
  'Lefèvre',
  'Moreau',
  'Garnier',
  'Rousseau',
  'Fontaine',
  'Chevalier',
  'Blanchard',
  'Mercier',
  'Lambert',
  'Faure',
  'Girard',
  'Dupuis',
  'Nguyen',
  'Perrin',
  'Morin',
  'Roux',
  'Fournier',
  'Gauthier',
  'Barbier',
  'Colin',
  'Masson',
  'Renard',
  'Picard',
];

const ALPHABET = 'ABCDEFGHIJKLMNOPRSTUVY';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nearHomonym(name: string, random: () => number): string | undefined {
  const parts = name.split(' ');
  const last = parts.pop();
  if (!last || last.length < 3 || parts.length === 0) return undefined;
  const position = Math.floor(random() * last.length);
  const letter = ALPHABET[Math.floor(random() * ALPHABET.length)] ?? 'E';
  const mode = Math.floor(random() * 3);
  const changed =
    mode === 0
      ? last.slice(0, position) +
        letter.toLowerCase() +
        last.slice(position + 1)
      : mode === 1
        ? last.slice(0, position) + letter.toLowerCase() + last.slice(position)
        : last.slice(0, position) + last.slice(position + 1);
  return [...parts, changed].join(' ');
}

export function buildDirectory(
  recipients: readonly string[],
  { size = DIRECTORY_SIZE, seed = 20261023 }: DirectoryOptions = {},
): string[] {
  const random = mulberry32(seed);
  const seen = new Set<string>();
  const entries: string[] = [];
  const add = (name: string | undefined): boolean => {
    if (!name) return false;
    const key = normalizeWords(name);
    if (key === '' || seen.has(key)) return false;
    seen.add(key);
    entries.push(name);
    return true;
  };
  for (const recipient of recipients) add(recipient);
  const base = [...entries];
  let attempts = 0;
  while (entries.length < size && attempts < size * 50) {
    attempts += 1;
    if (base.length > 0 && attempts % 3 === 0) {
      const source = base[Math.floor(random() * base.length)] ?? '';
      add(nearHomonym(source, random));
      continue;
    }
    const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)] ?? '';
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)] ?? '';
    add(`${first} ${last}`);
  }
  return entries;
}

function nameVariants(words: string): string[] {
  const tokens = words.split(' ');
  if (tokens.length < 2) return [words];
  const last = tokens[tokens.length - 1] ?? '';
  return [
    ...new Set([
      words,
      [last, ...tokens.slice(0, -1)].join(' '),
      [...tokens].reverse().join(' '),
    ]),
  ];
}

export function candidateTexts(lines: readonly string[]): string[] {
  const cleaned = lines.map(normalizeWords).filter((line) => line !== '');
  const pairs = cleaned.slice(1).map((line, i) => `${cleaned[i]} ${line}`);
  return [...cleaned, ...pairs];
}

export function matchRecipient(
  lines: readonly string[],
  directory: readonly string[],
  top = TOP_MATCHES,
): DirectoryMatch[] {
  const candidates = candidateTexts(lines);
  const matches: DirectoryMatch[] = [];
  for (const name of directory) {
    const variants = nameVariants(normalizeWords(name));
    const length = variants[0]?.length ?? 0;
    if (length === 0) continue;
    let best: DirectoryMatch = { name, score: 0, line: '' };
    for (const candidate of candidates) {
      for (const variant of variants) {
        const score = 1 - bestSubstringDistance(variant, candidate) / length;
        if (score > best.score) best = { name, score, line: candidate };
      }
    }
    if (best.score >= MIN_MATCH_SCORE) matches.push(best);
  }
  return matches
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.name.length - a.name.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, top);
}
