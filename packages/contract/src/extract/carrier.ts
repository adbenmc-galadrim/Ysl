import type { TrackingContext } from '../tracking/rules';
import { candidatesOf, resolve } from './fields';
import type { Field, FieldSource } from './types';

/**
 * Weights of the carrier vote (§4.5): SCAC of a 2D code 1,0, format and key
 * of the tracking 0,9. `formatOnly` is ours: a shape several carriers share
 * (a bare 12-digit number) says less than a 1Z, and more than a layout (0,4).
 */
export const VOTE = {
  structured2d: 1,
  keyedTracking: 0.9,
  formatOnly: 0.5,
} as const;

export type Vote = {
  carrier: TrackingContext;
  weight: number;
  source: FieldSource;
};

/** The heaviest carrier wins; an equal weight is a tie, never sure (§4.5). */
export const voteCarrier = (
  votes: readonly Vote[],
): Field<TrackingContext> | null => {
  const weights = new Map<TrackingContext, number>();
  for (const { carrier, weight } of votes) {
    weights.set(carrier, (weights.get(carrier) ?? 0) + weight);
  }
  const weightOf = (carrier: TrackingContext) => weights.get(carrier) ?? 0;
  const candidates = candidatesOf(
    votes.map((v) => ({ key: v.carrier, value: v.carrier, source: v.source })),
  ).sort((a, b) => weightOf(b.value) - weightOf(a.value));
  const [first, second] = candidates;
  const tie =
    first !== undefined &&
    second !== undefined &&
    weightOf(first.value) === weightOf(second.value);
  return resolve(candidates, tie ? ['tie'] : []);
};
