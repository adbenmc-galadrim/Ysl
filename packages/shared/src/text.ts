/**
 * The frozen key of a name (`name_norm` of `sender`, `contact` and
 * `directory_person`): compatibility form, no diacritic, lower case, ASCII
 * letters and digits only, one space between words, spelled-out initials
 * glued back (`S.p.A.` and `SPA` share a key). Changing this rule rewrites
 * every normalized column and forces a full pull (TODO YSL-17).
 */
export function normalizeName(text: string): string {
  const words = text
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word !== '');
  const glued: string[] = [];
  let initials = '';
  for (const word of words) {
    if (word.length === 1) {
      initials += word;
      continue;
    }
    if (initials) glued.push(initials);
    initials = '';
    glued.push(word);
  }
  if (initials) glued.push(initials);
  return glued.join(' ');
}

const jaro = (a: string, b: string): number => {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const matchedA = new Array<boolean>(a.length).fill(false);
  const matchedB = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const from = Math.max(0, i - window);
    const to = Math.min(b.length - 1, i + window);
    for (let j = from; j <= to; j += 1) {
      if (matchedB[j] || a[i] !== b[j]) continue;
      matchedA[i] = true;
      matchedB[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!matchedA[i]) continue;
    while (!matchedB[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  return (
    (matches / a.length +
      matches / b.length +
      (matches - transpositions / 2) / matches) /
    3
  );
};

const PREFIX_MAX = 4;
const PREFIX_SCALE = 0.1;

/**
 * Jaro-Winkler similarity in [0, 1] (§4.3: a known name at ≥ 0,92 earns a
 * bonus). Compare normalized names, not raw labels.
 */
export function jaroWinkler(a: string, b: string): number {
  const base = jaro(a, b);
  let prefix = 0;
  while (prefix < PREFIX_MAX && prefix < a.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  return base + prefix * PREFIX_SCALE * (1 - base);
}
