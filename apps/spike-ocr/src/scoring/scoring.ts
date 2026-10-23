import type { Truth } from '#/pack/types';
import { matchRecipient, type DirectoryMatch } from '#/scoring/directory';
import { senderFound } from '#/scoring/sender';
import { normalizeWords } from '#/scoring/text';

export type PhotoScore = {
  recipient?: { correct: boolean; top: DirectoryMatch[] };
  sender?: { correct: boolean };
};

export type FieldScore = {
  correct: number;
  total: number;
  rate: number | undefined;
};

export type Accuracy = { recipient: FieldScore; sender: FieldScore };

export function scorePhoto(
  truth: Truth,
  lines: readonly string[] | undefined,
  directory: readonly string[],
): PhotoScore {
  const score: PhotoScore = {};
  if (truth.recipient !== null) {
    const top = lines ? matchRecipient(lines, directory) : [];
    const expected = normalizeWords(truth.recipient);
    score.recipient = {
      correct: top.some((match) => normalizeWords(match.name) === expected),
      top,
    };
  }
  if (truth.sender !== null) {
    score.sender = {
      correct: lines ? senderFound(truth.sender, lines) : false,
    };
  }
  return score;
}

function field(outcomes: readonly boolean[]): FieldScore {
  const correct = outcomes.filter(Boolean).length;
  return {
    correct,
    total: outcomes.length,
    rate: outcomes.length === 0 ? undefined : correct / outcomes.length,
  };
}

export function accuracyOf(scores: readonly PhotoScore[]): Accuracy {
  return {
    recipient: field(
      scores.flatMap((score) =>
        score.recipient ? [score.recipient.correct] : [],
      ),
    ),
    sender: field(
      scores.flatMap((score) => (score.sender ? [score.sender.correct] : [])),
    ),
  };
}
