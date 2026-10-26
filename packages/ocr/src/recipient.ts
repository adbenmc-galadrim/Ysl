import {
  afterAnchor,
  CIVILITIES,
  COMPANY_WORDS,
  CONTACT_ANCHOR,
  fold,
  HOST_COMPANY,
  HOST_STREET,
  LINES_AFTER_ANCHOR,
  RECIPIENT_ANCHORS,
  SENDER_ANCHORS,
  STREET_WORDS,
  wordsOf,
} from '#blocks';

const WORD = /^[A-Z][A-Z'.-]*$/;

/**
 * A person's name as a label prints it: two to four words made of letters,
 * no digit, no legal form, no street word, or a last name after initials
 * (`L. FONTAINE`). Civilities are dropped.
 */
function personName(line: string): string | null {
  const raw = line
    .replace(new RegExp(HOST_COMPANY.source, 'gi'), ' ')
    .replace(/\b(\p{Lu})\.(?=\p{Lu}{2,})/gu, '$1. ');
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
  const long = kept.filter((word) => word.replace(/\./g, '').length >= 2);
  const initialled =
    long.length === 1 &&
    long[0]!.length >= 3 &&
    kept.every((word) => word === long[0] || /^[A-Z]\.$/.test(word));
  if (long.length < 2 && !initialled) return null;
  const original = raw.trim().replace(/\s+/g, ' ').split(' ');
  const originalKept = original.filter((word) => !CIVILITIES.has(fold(word)));
  return originalKept.join(' ');
}

/** The lines around index `at`, in the order v1 tried them. */
const around = (
  lines: readonly { text: string }[],
  at: number,
  steps: readonly number[],
) =>
  steps
    .map((step) => lines[at + step]?.text)
    .filter((text): text is string => text !== undefined);

const blockEnds = (text: string) => {
  const folded = fold(text);
  return SENDER_ANCHORS.test(folded) || RECIPIENT_ANCHORS.test(folded);
};

function afterRecipientAnchor(
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
      if (candidate === undefined || blockEnds(candidate)) break;
      const name = personName(candidate);
      if (name) return name;
    }
  }
  return null;
}

/** The first line that names a person among the candidates, in order. */
const firstName = (candidates: readonly string[]) => {
  for (const candidate of candidates) {
    const name = personName(candidate);
    if (name) return name;
  }
  return null;
};

/**
 * v1 `findRecipientName` after the anchors: the rest of a `CONTACT` line
 * and the line after it; then around the host company's line (itself,
 * +1, -1, -2, +2); then above the host's street (-1, -2, -3). A sender
 * block is never read.
 */
function aroundLandmarks(lines: readonly { text: string }[]): string | null {
  const usable = (text: string) => !SENDER_ANCHORS.test(fold(text));
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!.text;
    const contact = CONTACT_ANCHOR.exec(text);
    if (!contact || !usable(text)) continue;
    const name = firstName([
      text.slice(contact.index + contact[0].length),
      ...around(lines, index, [1]).filter(usable),
    ]);
    if (name) return name;
  }
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!.text;
    if (!HOST_COMPANY.test(fold(text))) continue;
    const name = firstName(
      [text, ...around(lines, index, [1, -1, -2, 2])].filter(usable),
    );
    if (name) return name;
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (!HOST_STREET.test(fold(lines[index]!.text))) continue;
    const name = firstName(around(lines, index, [-1, -2, -3]).filter(usable));
    if (name) return name;
  }
  return null;
}

/**
 * The recipient's name read by OCR alone, before the directory: the rest
 * of a recipient anchor's line or one of the lines after it; without an
 * anchor, the v1 landmarks (`CONTACT`, the host company, its street).
 * `null` rather than a guess when none shows, so a wrong name is never
 * presented.
 */
export function recipientFromLines(
  lines: readonly { text: string }[],
): string | null {
  return afterRecipientAnchor(lines) ?? aroundLandmarks(lines);
}
