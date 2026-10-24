import { normalizeTracking } from './normalize';
import {
  type TrackingContext,
  type TrackingRule,
  trackingRules,
} from './rules';

export type TrackingStatus = 'sure' | 'to-verify' | 'rejected';

export type TrackingReason =
  | 'valid-key'
  | 'invalid-key'
  | 'needs-context'
  | 'format-and-context'
  | 'context-mismatch'
  | 'ambiguous'
  | 'unknown-format'
  | 'empty';

export type TrackingCandidate = {
  carrier: TrackingContext | null;
  format: string;
  status: TrackingStatus;
  reason: TrackingReason;
};

export type TrackingVerdict = {
  status: TrackingStatus;
  value: string;
  carrier: TrackingContext | null;
  format: string | null;
  reason: TrackingReason;
  candidates: readonly TrackingCandidate[];
  shipperAccount?: string;
};

export type ValidateTrackingOptions = {
  context?: TrackingContext;
};

type Outcome = { status: TrackingStatus; reason: TrackingReason };

type Match = { rule: TrackingRule; contextual: boolean; outcome: Outcome };

const RANK: Record<TrackingStatus, number> = {
  sure: 2,
  'to-verify': 1,
  rejected: 0,
};

const inContext = (rule: TrackingRule, context: TrackingContext | undefined) =>
  context !== undefined &&
  (rule.contexts === 'any' || rule.contexts.includes(context));

const evaluate = (
  rule: TrackingRule,
  value: string,
  contextual: boolean,
): Outcome => {
  const valid = rule.check?.(value) ?? false;
  switch (rule.policy) {
    case 'key':
      return valid
        ? { status: 'sure', reason: 'valid-key' }
        : { status: 'rejected', reason: 'invalid-key' };
    case 'key-and-context':
      if (!valid) return { status: 'rejected', reason: 'invalid-key' };
      return contextual
        ? { status: 'sure', reason: 'valid-key' }
        : { status: 'to-verify', reason: 'needs-context' };
    case 'key-bonus':
      if (valid && contextual) return { status: 'sure', reason: 'valid-key' };
      return valid
        ? { status: 'to-verify', reason: 'needs-context' }
        : { status: 'to-verify', reason: 'invalid-key' };
    case 'format-and-context':
      return contextual
        ? { status: 'sure', reason: 'format-and-context' }
        : { status: 'to-verify', reason: 'needs-context' };
  }
};

const carrierOf = (match: Match, context: TrackingContext | undefined) =>
  match.rule.carrier ?? (match.contextual ? (context ?? null) : null);

const top = (matches: readonly Match[]) => {
  const rank = Math.max(...matches.map((m) => RANK[m.outcome.status]));
  return matches.filter((m) => RANK[m.outcome.status] === rank);
};

export const validateTracking = (
  raw: string,
  options: ValidateTrackingOptions = {},
): TrackingVerdict => {
  const value = normalizeTracking(raw);
  const { context } = options;
  const matches: Match[] = trackingRules
    .filter((rule) => value !== '' && rule.pattern.test(value))
    .map((rule) => {
      const contextual = inContext(rule, context);
      return { rule, contextual, outcome: evaluate(rule, value, contextual) };
    });
  const candidates = matches.map((m) => ({
    carrier: carrierOf(m, context),
    format: m.rule.id,
    ...m.outcome,
  }));
  const anonymous = (status: TrackingStatus, reason: TrackingReason) => ({
    status,
    value,
    carrier: null,
    format: null,
    reason,
    candidates,
  });

  if (value === '') return anonymous('rejected', 'empty');
  if (matches.length === 0) {
    return anonymous(
      context === undefined ? 'rejected' : 'to-verify',
      'unknown-format',
    );
  }

  const own = matches.filter((m) => m.contextual);
  if (own.length === 0 && context !== undefined) {
    const status = top(matches)[0]!.outcome.status;
    return anonymous(
      status === 'rejected' ? 'rejected' : 'to-verify',
      'context-mismatch',
    );
  }

  const tied = top(own.length > 0 ? own : matches);
  const chosen = tied[0]!;
  const carrier = carrierOf(chosen, context);
  if (tied.some((m) => carrierOf(m, context) !== carrier)) {
    return anonymous(
      chosen.outcome.status === 'rejected' ? 'rejected' : 'to-verify',
      chosen.outcome.status === 'rejected' ? 'invalid-key' : 'ambiguous',
    );
  }
  const shipperAccount = chosen.rule.shipperAccount?.(value);
  return {
    ...chosen.outcome,
    value,
    carrier,
    format: chosen.rule.id,
    candidates,
    ...(shipperAccount === undefined ? {} : { shipperAccount }),
  };
};
