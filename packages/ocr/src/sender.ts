import {
  afterAnchor,
  fold,
  LINES_AFTER_ANCHOR,
  RECIPIENT_ANCHORS,
  SENDER_ANCHORS,
  STREET_WORDS,
  wordsOf,
} from '#blocks';

const MAX_WORDS = 6;

/** Lines of the label that never name anyone, whatever block they sit in. */
const NOISE =
  /\b(?:TRACKING|TRK|WAYBILL|AWB|REF|REFERENCE|PO|TEL|PHONE|FAX|EMAIL|E-MAIL|WWW|HTTP|KG|LBS|COLIS|PARCEL|PIECE)\b/;

/** A postcode or house number opening the line: an address, not a name. */
const ADDRESS_START = /^\d{2,}(?:\s|-|$)/;

/**
 * A company or person as a label prints it in the sender block: one to six
 * words with at least three letters, no street, no address line, no phone
 * nor reference. The original spelling is kept.
 */
function organizationName(raw: string): string | null {
  const folded = fold(raw).replace(/^[':.-]+\s*/, '');
  if (folded === '') return null;
  const words = folded.split(' ').filter((word) => word !== '');
  if (words.length === 0 || words.length > MAX_WORDS) return null;
  if (ADDRESS_START.test(folded)) return null;
  if (NOISE.test(folded)) return null;
  if ((folded.match(/\d/g)?.length ?? 0) >= 6) return null;
  if ((folded.match(/[A-Z]/g)?.length ?? 0) < 3) return null;
  if (words.some((word) => STREET_WORDS.has(word.replace(/\.$/, '')))) {
    return null;
  }
  if (SENDER_ANCHORS.test(folded) || RECIPIENT_ANCHORS.test(folded)) {
    return null;
  }
  return raw
    .trim()
    .replace(/^[\s/:.,-]+/, '')
    .replace(/\s+/g, ' ');
}

/**
 * The sender's name read by OCR alone (§4.5, F19): the rest of a sender
 * anchor's line, or one of the lines that follow it, up to the recipient
 * block. `null` rather than a guess when no anchor shows.
 */
export function senderFromLines(
  lines: readonly { text: string }[],
): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const words = wordsOf(lines[index]!.text);
    const anchor = SENDER_ANCHORS.exec(words.map(fold).join(' '));
    if (!anchor) continue;
    const inline = organizationName(afterAnchor(words, anchor[0]));
    if (inline) return inline;
    for (let step = 1; step <= LINES_AFTER_ANCHOR; step += 1) {
      const candidate = lines[index + step]?.text;
      if (candidate === undefined) break;
      const folded = fold(candidate);
      if (SENDER_ANCHORS.test(folded) || RECIPIENT_ANCHORS.test(folded)) break;
      const name = organizationName(candidate);
      if (name) return name;
    }
  }
  return null;
}
