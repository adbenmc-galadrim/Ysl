import {
  afterAnchor,
  CIVILITIES,
  COMPANY_WORDS,
  fold,
  LINES_AFTER_ANCHOR,
  RECIPIENT_ANCHORS,
  SENDER_ANCHORS,
  STREET_WORDS,
  wordsOf,
} from '#blocks';

const WORD = /^[A-Z][A-Z'.-]*$/;

/**
 * A person's name as a label prints it: two to four words made of letters,
 * no digit, no legal form, no street word. Civilities are dropped.
 */
function personName(raw: string): string | null {
  const folded = fold(raw);
  if (folded === '' || /\d/.test(folded)) return null;
  const words = folded.split(' ').filter((word) => word !== '');
  const kept = words.filter((word) => !CIVILITIES.has(word));
  if (kept.length < 2 || kept.length > 4) return null;
  if (!kept.every((word) => WORD.test(word))) return null;
  if (kept.some((word) => COMPANY_WORDS.has(word.replace(/\.$/, ''))))
    return null;
  if (kept.some((word) => STREET_WORDS.has(word.replace(/\.$/, ''))))
    return null;
  if (kept.filter((word) => word.replace(/\./g, '').length >= 2).length < 2)
    return null;
  const original = raw.trim().replace(/\s+/g, ' ').split(' ');
  const originalKept = original.filter((word) => !CIVILITIES.has(fold(word)));
  return originalKept.join(' ');
}

/**
 * The recipient's name read by OCR alone, without carrier template nor
 * directory (those come later): the rest of a recipient anchor's line, or
 * one of the lines that follow it. `null` rather than a guess when no
 * anchor shows, so a wrong name is never presented.
 */
export function recipientFromLines(
  lines: readonly { text: string }[],
): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const words = wordsOf(lines[index]!.text);
    const anchor = RECIPIENT_ANCHORS.exec(words.map(fold).join(' '));
    if (!anchor) continue;
    const inline = personName(afterAnchor(words, anchor[0]));
    if (inline) return inline;
    for (let step = 1; step <= LINES_AFTER_ANCHOR; step += 1) {
      const candidate = lines[index + step]?.text;
      if (candidate === undefined) break;
      const folded = fold(candidate);
      if (SENDER_ANCHORS.test(folded) || RECIPIENT_ANCHORS.test(folded)) break;
      const name = personName(candidate);
      if (name) return name;
    }
  }
  return null;
}
