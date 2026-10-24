/** One line for a log or an outbox row, whatever was thrown. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
