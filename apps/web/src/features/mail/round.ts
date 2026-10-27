/**
 * The template a mail is written from: the one the agent picked on this
 * round, else their default, else the first one listed.
 */
export function pickTemplate<T extends { id: string; isDefault: boolean }>(
  templates: readonly T[],
  chosenId: string | null,
): T | undefined {
  return (
    templates.find((row) => row.id === chosenId) ??
    templates.find((row) => row.isDefault) ??
    templates[0]
  );
}

export type MailOutcome = 'sent' | 'failed';

/**
 * Where the round goes once a mail is answered. Only a mail that left moves
 * on: iOS opens the mail app once per tap, so the next "Envoyer" stays the
 * agent's gesture, and a mail not sent or given up keeps its page for the
 * agent to retry or skip.
 */
export function pageAfter(
  index: number,
  total: number,
  outcome: MailOutcome,
): number {
  return outcome === 'sent' && index < total - 1 ? index + 1 : index;
}
