import { normalizeName } from '@repo/shared/text';
import { CONFIDENCE } from './confidence';

/**
 * The confidence of rank 8 (§4.3, « 0,30 à 0,90 selon le cas ») for what
 * the agent's corrections taught (§4.8): a name learned once is a hint
 * (0,30, a chip), each confirmation adds 0,20, so 0,50 then « à vérifier »
 * at 0,70 and « sûr » at the fourth (0,90). A recipient never goes past
 * 0,89: F26 wants a card the agent settled, the review asks for it.
 */
export const LEARNED = {
  first: 0.3,
  step: 0.2,
  max: CONFIDENCE.sure,
  recipientMax: CONFIDENCE.unkeyedCap,
} as const;

export const learnedConfidence = (
  confirmations: number,
  max: number = LEARNED.max,
): number =>
  confirmations < 1
    ? 0
    : Math.min(
        max,
        Math.round((LEARNED.first + LEARNED.step * (confirmations - 1)) * 100) /
          100,
      );

/** The key a learned name is kept under: lower case, no accent, no punctuation. */
export const aliasKey = (text: string) => normalizeName(text);

/** An OCR `FROM` block the agent took for a sender (`sender_alias`). */
export type KnownSenderAlias = {
  aliasNorm: string;
  senderId: string;
  name: string;
  confirmations: number;
};

/** A printed name the agent took for a card (`recipient_alias`). */
export type KnownRecipientAlias = {
  nameNorm: string;
  kind: 'person' | 'contact';
  id: string;
  name: string;
  confirmations: number;
};

/** The most confirmed alias of a key: two iPhones may have learned it apart. */
export const bestAlias = <A extends { confirmations: number }>(
  aliases: readonly A[],
  matches: (alias: A) => boolean,
): A | null =>
  aliases.reduce<A | null>(
    (best, alias) =>
      matches(alias) && (!best || alias.confirmations > best.confirmations)
        ? alias
        : best,
    null,
  );
