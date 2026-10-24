import type { DraftBatch, DraftParcel } from '#/features/db/schema';
import { formatTime, startOfDay } from '#/features/parcels/model';

/**
 * When this instance of the app started: a batch older than that was cut
 * short. Read off the document, not off this module, which a launch on
 * another route would import only later.
 */
export const BOOT_AT = new Date(performance.timeOrigin);

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

/**
 * Whether the home should offer this batch back: it predates this launch and
 * nothing was added to it since (a batch the Scan screen already picked up,
 * opened or resumed in this session, is the agent's own doing), it holds
 * something to lose, and the agent has not answered for it yet.
 */
export function offersResume(
  batch: DraftBatch | undefined,
  last: Pick<DraftParcel, 'createdAt'> | undefined,
  bootAt: Date,
  answeredId: string | undefined,
): batch is DraftBatch {
  return (
    batch !== undefined &&
    last !== undefined &&
    batch.startedAt < bootAt &&
    last.createdAt < bootAt &&
    batch.id !== answeredId
  );
}

/** "de 10 h 31" today, "d’hier à 10 h 31", "du 23 octobre à 10 h 31" before. */
export function formatBatchStart(startedAt: Date, now: Date): string {
  const today = startOfDay(now);
  if (startedAt >= today) return `de ${formatTime(startedAt)}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (startedAt >= yesterday) return `d’hier à ${formatTime(startedAt)}`;
  return `du ${dateFormat.format(startedAt)} à ${formatTime(startedAt)}`;
}
