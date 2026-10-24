const fold = (text: string) =>
  text
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9':.-]+/g, ' ')
    .trim();

/** Labels that announce the recipient block; the name follows, or ends the line. */
const RECIPIENT_ANCHORS =
  /^(?:(?:DESTINATAIRE|DELIVER(?:Y)? (?:TO|ADDRESS)|SHIP(?:PING)? ?(?:TO|ADDRESS)|CONSIGNEE|RECIPIENT|LIVRER A|ADRESSE DE LIVRAISON|A L'ATTENTION DE|ATTN)\b\s*:?|(?:A|TO)\s*:)\s*/;

/** The sender block ends the search: its name must never be taken. */
const SENDER_ANCHORS =
  /^(?:EXPEDITEUR|EXP|FROM|SENDER|SHIP(?:PED)? FROM|RETURN(?: TO| ADDRESS)?|RETOUR)\b/;

const COMPANY_WORDS = new Set([
  'SARL',
  'SAS',
  'SASU',
  'SA',
  'EURL',
  'SCI',
  'SNC',
  'LTD',
  'LIMITED',
  'LLC',
  'INC',
  'CORP',
  'CO',
  'COMPANY',
  'GMBH',
  'AG',
  'SRL',
  'SPA',
  'BV',
  'NV',
  'PLC',
  'SOCIETE',
  'GROUP',
  'GROUPE',
  'SERVICE',
  'SERVICES',
  'STORE',
  'SHOP',
  'BOUTIQUE',
  'ATELIER',
  'STUDIO',
  'AGENCE',
  'CABINET',
  'LOGISTICS',
  'LOGISTIQUE',
  'DEPOT',
  'ENTREPOT',
  'WAREHOUSE',
]);

const STREET_WORDS = new Set([
  'RUE',
  'AVENUE',
  'AV',
  'BD',
  'BOULEVARD',
  'CHEMIN',
  'PLACE',
  'ALLEE',
  'IMPASSE',
  'ROUTE',
  'QUAI',
  'COURS',
  'SQUARE',
  'ROAD',
  'RD',
  'STREET',
  'ST',
  'LANE',
  'DRIVE',
  'STRASSE',
  'VIA',
  'CEDEX',
  'BP',
  'ETAGE',
  'BAT',
  'BATIMENT',
  'FLOOR',
  'SUITE',
  'APT',
  'FRANCE',
]);

const CIVILITIES = new Set([
  'M',
  'M.',
  'MR',
  'MR.',
  'MME',
  'MRS',
  'MS',
  'MLLE',
  'DR',
]);

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

const LINES_AFTER_ANCHOR = 3;

/** The words of the line after the anchor, in their original spelling. */
function afterAnchor(words: readonly string[], anchor: string): string {
  const wanted = anchor.trimEnd().length;
  let folded = '';
  let consumed = 0;
  while (consumed < words.length && folded.length < wanted) {
    const word = fold(words[consumed]!);
    folded = folded === '' ? word : `${folded} ${word}`;
    consumed += 1;
  }
  return words.slice(consumed).join(' ');
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
    const words = lines[index]!.text.replace(/:(?=\S)/, ': ')
      .trim()
      .split(/\s+/);
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
