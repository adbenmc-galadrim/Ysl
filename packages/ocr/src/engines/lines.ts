import type { OcrBox, OcrLine } from '#engines/types';

export type ReadItem = { text: string; box: OcrBox; confidence: number };

/**
 * Paddle returns the words of a line one by one; one line is their union:
 * the text joined by spaces, the box around them all, the mean confidence.
 */
export function toLine(items: readonly ReadItem[]): OcrLine | undefined {
  const words = items.filter((item) => item.text.trim() !== '');
  const first = words[0];
  if (!first) return undefined;
  const left = Math.min(...words.map((item) => item.box.x));
  const top = Math.min(...words.map((item) => item.box.y));
  const right = Math.max(...words.map((item) => item.box.x + item.box.width));
  const bottom = Math.max(...words.map((item) => item.box.y + item.box.height));
  return {
    text: words.map((item) => item.text.trim()).join(' '),
    box: { x: left, y: top, width: right - left, height: bottom - top },
    score: words.reduce((sum, item) => sum + item.confidence, 0) / words.length,
  };
}

export const linesOf = (groups: readonly (readonly ReadItem[])[]): OcrLine[] =>
  groups.flatMap((items) => toLine(items) ?? []);
