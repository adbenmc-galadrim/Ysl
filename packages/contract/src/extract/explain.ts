import { CONFIDENCE, clamp, combine, round } from './confidence';
import type { Field, FieldSource } from './types';

/**
 * A step of §4.3 between the best source and the confidence shown:
 * sources that agree, a contradiction, an address elsewhere than the
 * mailroom, the O1 cap of a tracking without a key, the directory bonus,
 * a tied carrier vote, or what the stored figures do not explain.
 */
export type AdjustmentKind =
  | 'agreement'
  | 'conflict'
  | 'forward'
  | 'unkeyed'
  | 'directory'
  | 'tie'
  | 'other';

export type Adjustment = { kind: AdjustmentKind; delta: number };

export type Explanation = {
  /** The confidence of the best-ranked source alone. */
  base: number;
  adjustments: Adjustment[];
  confidence: number;
};

const EPSILON = 0.0005;

/**
 * The §4.3 rank of a source, from its kind and its base confidence: 1 for
 * a structured 2D field, 9 for the agent. `null` for a confidence no rank
 * of the table gives (a sender stored with its final score).
 */
export const sourceRank = (source: FieldSource): number | null => {
  const { kind, confidence } = source;
  if (kind === 'agent') return 9;
  if (kind === 'learned') return 8;
  if (kind === 'ocr') {
    if (confidence === CONFIDENCE.ocrKeyed) return 5;
    if (confidence === CONFIDENCE.ocrFormat) return 6;
    return confidence === CONFIDENCE.unvalidated ? 7 : null;
  }
  switch (confidence) {
    case CONFIDENCE.structured2d:
      return 1;
    case CONFIDENCE.keyed1d:
      return 2;
    case CONFIDENCE.derived:
      return 3;
    case CONFIDENCE.format1d:
      return 4;
    case CONFIDENCE.unvalidated:
      return 7;
    default:
      return null;
  }
};

/**
 * How a field went from its best source to the confidence it shows,
 * replayed in the order the rules apply them: agreement, contradiction,
 * address elsewhere, O1 cap, then the bonus of the directory. The cap is
 * listed whenever the field carries `unkeyed`, even when it changed nothing.
 */
export const explainField = (
  field: Pick<Field<unknown>, 'confidence' | 'flags' | 'sources'>,
): Explanation => {
  const { confidence, flags, sources } = field;
  if (sources.length === 0) {
    return { base: confidence, adjustments: [], confidence };
  }
  const base = Math.max(...sources.map((s) => s.confidence));
  const adjustments: Adjustment[] = [];
  let current = base;
  const step = (kind: AdjustmentKind, next: number) => {
    const value = round(next);
    adjustments.push({ kind, delta: round(value - current) });
    current = value;
  };
  if (sources.length > 1) {
    step('agreement', combine(sources.map((s) => s.confidence)));
  }
  if (flags.includes('conflict')) {
    step('conflict', current - CONFIDENCE.conflictMalus);
  }
  if (flags.includes('forward')) {
    step('forward', clamp(current - CONFIDENCE.forwardMalus));
  }
  if (flags.includes('unkeyed')) {
    step('unkeyed', Math.min(current, CONFIDENCE.unkeyedCap));
  }
  if (flags.includes('tie')) adjustments.push({ kind: 'tie', delta: 0 });
  const rest = round(confidence - current);
  if (rest > EPSILON) step('directory', confidence);
  else if (rest < -EPSILON) step('other', confidence);
  return { base, adjustments, confidence };
};
