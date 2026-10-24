/** What the recipient and sender readers share: folding, anchors, word lists. */

export const fold = (text: string) =>
  text
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9':.-]+/g, ' ')
    .trim();

/** Labels that announce the recipient block; the name follows, or ends the line. */
export const RECIPIENT_ANCHORS =
  /^(?:(?:DESTINATAIRE|DELIVER(?:Y)? (?:TO|ADDRESS)|SHIP(?:PING)? ?(?:TO|ADDRESS)|CONSIGNEE|RECIPIENT|LIVRER A|ADRESSE DE LIVRAISON|A L'ATTENTION DE|ATTN)\b\s*:?|(?:A|TO)\s*:)\s*/;

/** Labels that announce the sender block (§4.5: `FROM`, `SHIPPER`, `EXPÉDITEUR`). */
export const SENDER_ANCHORS =
  /^(?:EXPEDITEUR|EXP|ABSENDER|MITTENTE|REMITENTE|SHIPPER|SENDER|SHIP(?:PED)? FROM|FROM|RETURN(?: TO| ADDRESS)?|RETOUR)\b\s*:?\s*/;

export const COMPANY_WORDS = new Set([
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

export const STREET_WORDS = new Set([
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

export const CIVILITIES = new Set([
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

export const LINES_AFTER_ANCHOR = 3;

/** A line split on spaces, with a glued colon (`FROM:ACME`) opened first. */
export const wordsOf = (text: string): string[] =>
  text
    .replace(/:(?=\S)/, ': ')
    .trim()
    .split(/\s+/);

/** The words of the line after the anchor, in their original spelling. */
export function afterAnchor(words: readonly string[], anchor: string): string {
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
