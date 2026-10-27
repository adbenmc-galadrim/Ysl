import { CONFIDENCE, clamp, combine, levelOf, round } from './confidence';
import type { Candidate, Field, FieldFlag, FieldSource } from './types';

export type Observation<T> = { key: string; value: T; source: FieldSource };

const maxConfidence = (sources: readonly FieldSource[]) =>
  Math.max(...sources.map((s) => s.confidence));

/** One candidate per distinct value, its sources combined (§4.3, « concordent »). */
export const candidatesOf = <T>(
  observations: readonly Observation<T>[],
): Candidate<T>[] => {
  const groups = new Map<string, { value: T; sources: FieldSource[] }>();
  for (const { key, value, source } of observations) {
    const group = groups.get(key);
    if (group) group.sources.push(source);
    else groups.set(key, { value, sources: [source] });
  }
  return [...groups.values()].map(({ value, sources }) => ({
    value,
    confidence: round(combine(sources.map((s) => s.confidence))),
    sources,
  }));
};

/** The best-ranked single source wins over a crowd of weaker ones (§4.3). */
const byRank = <T>(a: Candidate<T>, b: Candidate<T>) =>
  maxConfidence(b.sources) - maxConfidence(a.sources) ||
  b.confidence - a.confidence;

/**
 * The first candidate becomes the field; another candidate worth showing
 * (≥ 0,60) is a contradiction, which costs the malus of §4.3.
 */
export const resolve = <T>(
  candidates: readonly Candidate<T>[],
  flags: readonly FieldFlag[] = [],
): Field<T> | null => {
  const [best, ...others] = candidates;
  if (best === undefined) return null;
  const conflict = others.some((c) => c.confidence >= CONFIDENCE.toVerify);
  const confidence = conflict
    ? round(best.confidence - CONFIDENCE.conflictMalus)
    : best.confidence;
  return {
    value: best.value,
    confidence,
    level: levelOf(confidence),
    sources: best.sources,
    flags: [...(conflict ? (['conflict'] as const) : []), ...flags],
    candidates: [...candidates],
  };
};

export const mergeField = <T>(
  observations: readonly Observation<T>[],
): Field<T> | null => resolve(candidatesOf(observations).sort(byRank));

const flagged = (flags: readonly FieldFlag[], flag: FieldFlag) =>
  flags.includes(flag) ? [...flags] : [...flags, flag];

/** A bonus or a malus of §4.3 on a settled field, with the flag that says why. */
export const adjust = <T>(
  field: Field<T>,
  delta: number,
  flag?: FieldFlag,
): Field<T> => {
  const confidence = round(clamp(field.confidence + delta));
  return {
    ...field,
    confidence,
    level: levelOf(confidence),
    flags: flag ? flagged(field.flags, flag) : field.flags,
  };
};

/**
 * O1: a tracking is sure only when a check digit vouches for it, or a
 * structured code states it. Any other value, even read twice, stays
 * below « sûr » and says why.
 */
export const capUnkeyed = (
  field: Field<string> | null,
  keyed: ReadonlySet<string>,
): Field<string> | null => {
  if (field === null || keyed.has(field.value)) return field;
  const cap = (confidence: number) =>
    Math.min(confidence, CONFIDENCE.unkeyedCap);
  const confidence = cap(field.confidence);
  return {
    ...field,
    confidence,
    level: levelOf(confidence),
    flags: flagged(field.flags, 'unkeyed'),
    candidates: field.candidates.map((c) =>
      keyed.has(c.value) ? c : { ...c, confidence: cap(c.confidence) },
    ),
  };
};

export const canonical = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
