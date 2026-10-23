const LIGATURES: Record<string, string> = {
  Œ: 'OE',
  Æ: 'AE',
  ß: 'SS',
};

function fold(text: string): string {
  return text
    .toUpperCase()
    .replace(/[ŒÆß]/g, (char) => LIGATURES[char] ?? char)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function normalizeWords(text: string): string {
  return fold(text)
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function normalizeCompact(text: string): string {
  return fold(text).replace(/[^A-Z0-9]+/g, '');
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution =
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(
        substitution,
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export function bestSubstringDistance(
  needle: string,
  haystack: string,
): number {
  if (needle.length === 0) return 0;
  let column = Array.from({ length: needle.length + 1 }, (_, i) => i);
  let best = column[needle.length] ?? needle.length;
  for (let j = 1; j <= haystack.length; j += 1) {
    const next = [0];
    for (let i = 1; i <= needle.length; i += 1) {
      const substitution =
        (column[i - 1] ?? 0) + (needle[i - 1] === haystack[j - 1] ? 0 : 1);
      next[i] = Math.min(
        substitution,
        (column[i] ?? 0) + 1,
        (next[i - 1] ?? 0) + 1,
      );
    }
    column = next;
    best = Math.min(best, column[needle.length] ?? best);
  }
  return best;
}
