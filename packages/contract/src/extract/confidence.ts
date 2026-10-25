import type { ConfidenceLevel } from './types';

/** Base confidences of §4.3 and §4.8, and the display thresholds of §4.4. */
export const CONFIDENCE = {
  structured2d: 0.97,
  keyed1d: 0.95,
  derived: 0.93,
  format1d: 0.85,
  unvalidated: 0.4,
  learnedAccount: 0.9,
  learnedAccountConfirmed: 0.95,
  knownSender: 0.85,
  knownSenderFuzzy: 0.7,
  cap: 0.99,
  conflictMalus: 0.15,
  sure: 0.9,
  toVerify: 0.6,
} as const;

/** Independent sources agreeing: 1 − Π(1 − cᵢ), capped. */
export const combine = (confidences: readonly number[]): number =>
  Math.min(
    CONFIDENCE.cap,
    1 - confidences.reduce((acc, c) => acc * (1 - c), 1),
  );

export const levelOf = (confidence: number): ConfidenceLevel => {
  if (confidence >= CONFIDENCE.sure) return 'sure';
  if (confidence >= CONFIDENCE.toVerify) return 'to-verify';
  return 'none';
};

export const round = (confidence: number) =>
  Math.round(confidence * 1000) / 1000;
