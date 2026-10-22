export type Random = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  digits: (length: number) => string;
  letters: (length: number) => string;
};

export const seeded = (seed: number): Random => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]) => items[int(0, items.length - 1)]!;
  const chars = (alphabet: string, length: number) =>
    Array.from({ length }, () => pick([...alphabet])).join('');
  return {
    next,
    int,
    pick,
    digits: (length) => chars('0123456789', length),
    letters: (length) => chars('ABCDEFGHIJKLMNOPQRSTUVWXYZ', length),
  };
};
