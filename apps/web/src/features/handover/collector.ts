import { nameTokens } from '@repo/contract/recipient';
import { delegateName } from '#/features/replies/record';

/** Two spellings of one name: case, accents and punctuation aside. */
export const sameName = (a: string, b: string) =>
  nameTokens(a).join(' ') === nameTokens(b).join(' ');

/**
 * Who collected, as the handover keeps it: the name as typed or picked, one
 * space between words; nobody when it is the recipient themselves.
 */
export function collectorName(
  value: string | null | undefined,
  recipientName: string,
): string | null {
  const name = delegateName(value ?? '');
  return name && !sameName(name, recipientName) ? name : null;
}
