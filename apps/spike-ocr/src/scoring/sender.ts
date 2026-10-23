import { bestSubstringDistance, normalizeCompact } from '#/scoring/text';

export const SENDER_TOLERANCE = 0.15;

export function senderFound(truth: string, lines: readonly string[]): boolean {
  const expected = normalizeCompact(truth);
  if (expected === '') return false;
  const text = normalizeCompact(lines.join(' '));
  const distance = bestSubstringDistance(expected, text);
  return distance <= expected.length * SENDER_TOLERANCE;
}
