export type MatchStatus = 'read' | 'code-sans-tracking' | 'aucun-code';

export type MatchRule = 'exact' | 'compact' | 'ups-recomposed' | 'without-key';

export type SymbolText = { format: string; text: string };

export type Match = {
  status: MatchStatus;
  formats: string[];
  rule: MatchRule | null;
};

export const MIN_UNBOUNDED_LENGTH = 10;

const SEPARATOR_CODES = new Set([0x04, 0x1c, 0x1d, 0x1e, 0x1f]);
const FIELD_BREAK = ' ';

export const normalizeTracking = (value: string) =>
  value.toUpperCase().replace(/[\s\-.]/g, '');

const replaceSeparators = (text: string, by: string) =>
  [...text]
    .map((char) => (SEPARATOR_CODES.has(char.charCodeAt(0)) ? by : char))
    .join('');

export const normalizeContent = (text: string) =>
  replaceSeparators(text.toUpperCase(), FIELD_BREAK).replace(
    /\s+/g,
    FIELD_BREAK,
  );

export const compactContent = (text: string) =>
  replaceSeparators(text.toUpperCase(), '').replace(/\s+/g, '');

const isAlphanumeric = (char: string | undefined) =>
  char !== undefined && /[A-Z0-9]/.test(char);

export const containsToken = (haystack: string, needle: string) => {
  if (needle.length === 0) return false;
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    if (needle.length >= MIN_UNBOUNDED_LENGTH) return true;
    const before = haystack[from - 1];
    const after = haystack[from + needle.length];
    if (!isAlphanumeric(before) && !isAlphanumeric(after)) return true;
    from = haystack.indexOf(needle, from + 1);
  }
  return false;
};

export const recomposeUps = (text: string): string[] => {
  const fields = normalizeContent(text).split(FIELD_BREAK);
  const found: string[] = [];
  fields.forEach((field, i) => {
    if (field !== 'UPSN') return;
    const shipper = fields[i + 1];
    const tail = fields[i - 1];
    if (!shipper || !tail || !/^[A-Z0-9]{6}$/.test(shipper)) return;
    const body = tail.replace(/^1Z/, '').replace(new RegExp(`^${shipper}`), '');
    if (/^[A-Z0-9]{10}$/.test(body)) found.push(`1Z${shipper}${body}`);
    const service = fields[i - 2]?.match(/^\d(\d{2})$/)?.[1];
    if (service && /^[A-Z0-9]{8}$/.test(body)) {
      found.push(`1Z${shipper}${service}${body}`);
    }
  });
  return found;
};

const ruleFor = (
  tracking: string,
  carrier: string | undefined,
  text: string,
): MatchRule | null => {
  const spaced = normalizeContent(text);
  if (containsToken(spaced, tracking)) return 'exact';
  if (containsToken(compactContent(text), tracking)) return 'compact';
  if (carrier === 'ups' || tracking.startsWith('1Z')) {
    if (recomposeUps(text).includes(tracking)) return 'ups-recomposed';
  }
  if (
    (carrier === 'colissimo' || carrier === 'la-poste') &&
    tracking.length >= 13
  ) {
    const body = tracking.slice(0, -1);
    if (containsToken(compactContent(text), body)) return 'without-key';
  }
  return null;
};

export const matchTracking = (
  tracking: string | null,
  symbols: readonly SymbolText[],
  carrier?: string,
): Match => {
  if (symbols.length === 0) {
    return { status: 'aucun-code', formats: [], rule: null };
  }
  const wanted = tracking === null ? '' : normalizeTracking(tracking);
  if (wanted === '') {
    return { status: 'code-sans-tracking', formats: [], rule: null };
  }
  const order: MatchRule[] = [
    'exact',
    'compact',
    'ups-recomposed',
    'without-key',
  ];
  const hits = symbols.flatMap((s) => {
    const rule = ruleFor(wanted, carrier, s.text);
    return rule ? [{ format: s.format, rule }] : [];
  });
  if (hits.length === 0) {
    return { status: 'code-sans-tracking', formats: [], rule: null };
  }
  const best = hits.reduce((a, b) =>
    order.indexOf(b.rule) < order.indexOf(a.rule) ? b : a,
  );
  return {
    status: 'read',
    formats: [...new Set(hits.map((h) => h.format))],
    rule: best.rule,
  };
};
