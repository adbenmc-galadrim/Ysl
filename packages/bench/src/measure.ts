import { canonical, type Extraction, type Field } from '@repo/contract/extract';
import { normalizeTracking } from '@repo/contract/tracking';
import type { Pieces } from '@repo/contract/codes';
import type { Label } from '@repo/corpus/schema';

export const FIELDS = [
  'tracking',
  'carrier',
  'recipient',
  'sender',
  'pieces',
  'weightKg',
] as const;

export type FieldName = (typeof FIELDS)[number];

/** `-ok` / `-wrong` after the display level of §4.4; `empty` is nothing proposed. */
export type OutcomeStatus =
  | 'sure-ok'
  | 'sure-wrong'
  | 'verify-ok'
  | 'verify-wrong'
  | 'empty'
  | 'not-annotated';

export type FieldOutcome = {
  field: FieldName;
  expected: string | null;
  proposed: string | null;
  confidence: number | null;
  status: OutcomeStatus;
  inTop3: boolean;
  sources: string[];
};

type Expected = string | number | Pieces | null;

const show = (value: Expected): string | null => {
  if (value === null) return null;
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'string') return value;
  return `${value.index}/${value.total}`;
};

/** The UPS MaxiCode carries whole pounds: a quarter of a kilogram covers the rounding. */
export const WEIGHT_TOLERANCE_KG = 0.25;

const tokens = (text: string) => canonical(text).split(' ').filter(Boolean);

/** An SSCC written with its GS1 application identifier `00` is the same number. */
const sscc = (tracking: string) =>
  /^00\d{18}$/.test(tracking) ? tracking.slice(2) : tracking;

/**
 * « Dupont Jean » and « JEAN DUPONT » name the same person, and so does
 * « MME MARIE CURIE » : the same words, or all the words of the shorter name
 * (two at least) in the longer one. A word inside another does not count.
 */
export const sameName = (expected: string, proposed: string) => {
  const a = new Set(tokens(expected));
  const b = new Set(tokens(proposed));
  if (a.size === 0 || b.size === 0) return false;
  const [short, long] = a.size <= b.size ? [a, b] : [b, a];
  if (short.size < 2 && short.size !== long.size) return false;
  return [...short].every((word) => long.has(word));
};

const same: Record<
  FieldName,
  (expected: Expected, proposed: Expected) => boolean
> = {
  tracking: (e, p) =>
    typeof e === 'string' &&
    typeof p === 'string' &&
    sscc(normalizeTracking(e)) === sscc(normalizeTracking(p)),
  carrier: (e, p) => e === p,
  recipient: (e, p) =>
    typeof e === 'string' && typeof p === 'string' && sameName(e, p),
  sender: (e, p) =>
    typeof e === 'string' && typeof p === 'string' && sameName(e, p),
  pieces: (e, p) =>
    typeof e === 'object' &&
    typeof p === 'object' &&
    e !== null &&
    p !== null &&
    e.index === p.index &&
    e.total === p.total,
  weightKg: (e, p) =>
    typeof e === 'number' &&
    typeof p === 'number' &&
    Math.abs(e - p) <= WEIGHT_TOLERANCE_KG,
};

const statusOf = (
  field: FieldName,
  expected: Expected,
  proposed: Field<Expected> | null,
): OutcomeStatus => {
  if (expected === null) return 'not-annotated';
  if (proposed === null || proposed.level === 'none') return 'empty';
  const ok = same[field](expected, proposed.value);
  if (proposed.level === 'sure') return ok ? 'sure-ok' : 'sure-wrong';
  return ok ? 'verify-ok' : 'verify-wrong';
};

const outcome = (
  field: FieldName,
  expected: Expected,
  proposed: Field<Expected> | null,
): FieldOutcome => ({
  field,
  expected: show(expected),
  proposed: proposed === null ? null : show(proposed.value),
  confidence: proposed?.confidence ?? null,
  status: statusOf(field, expected, proposed),
  inTop3:
    expected !== null &&
    (proposed?.candidates ?? [])
      .slice(0, 3)
      .some((c) => same[field](expected, c.value)),
  sources: proposed?.sources.map((s) => `${s.kind}:${s.format}`) ?? [],
});

/** The number expected: the annotated one, or another the label prints that was read. */
const expectedOf = (
  label: Label,
  field: FieldName,
  proposed: Field<Expected> | null,
): Expected => {
  const other =
    field === 'tracking' && proposed !== null
      ? label.otherTrackings?.find((t) => same.tracking(t, proposed.value))
      : undefined;
  return other ?? label[field];
};

export const measure = (label: Label, extraction: Extraction): FieldOutcome[] =>
  FIELDS.map((field) =>
    outcome(
      field,
      expectedOf(label, field, extraction[field]),
      extraction[field],
    ),
  );
