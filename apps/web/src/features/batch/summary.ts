import { damageOf } from '@repo/contract/parcel-damage';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  CourrierDatabase,
  LocalBatch,
  LocalParcel,
} from '#/features/db/schema';
import { loadPendingMails } from '#/features/mail/pending-mails';
import {
  awaitsNotice,
  mailsOfBatch,
  type RecipientMail,
} from '#/features/mail/recipients';
import { formatTime } from '#/features/parcels/model';

/** What a saved batch left behind, as « Lot enregistré » counts it (F25). */
export type BatchCounts = {
  count: number;
  toNotify: number;
  /** In scan order; a lone one opens its record from the screen. */
  toComplete: LocalParcel[];
  damaged: number;
  /** Parcels read as one piece of several (« 1/2 »). */
  pieces: number;
};

export function countBatch(parcels: readonly LocalParcel[]): BatchCounts {
  const live = parcels
    .filter((parcel) => !parcel.deletedAt)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  return {
    count: live.length,
    toNotify: live.filter(awaitsNotice).length,
    toComplete: live.filter((parcel) => parcel.status === 'a_completer'),
    damaged: live.filter((parcel) => damageOf(parcel) !== null).length,
    pieces: live.filter((parcel) => (parcel.pieceTotal ?? 0) > 1).length,
  };
}

/** "Lot de 10 h 31 à 10 h 52", or one time when it fit in a minute. */
export function batchSpan(
  { startedAt, endedAt }: Pick<LocalBatch, 'startedAt' | 'endedAt'>,
  t: TranslateFn,
): string {
  const start = formatTime(startedAt);
  const end = endedAt ? formatTime(endedAt) : start;
  return end === start
    ? t('lot.span.single', { start })
    : t('lot.span', { start, end });
}

export type BatchSummary = BatchCounts & {
  batch: LocalBatch;
  /** One per recipient of the batch, with every parcel of theirs to notify. */
  mails: RecipientMail[];
};

/**
 * Read only: the screen is worked out from the saved rows each time, so an
 * app closed on it loses nothing — the parcels wait in « À notifier ».
 */
export async function loadBatchSummary(
  db: CourrierDatabase,
  batchId: string,
): Promise<BatchSummary | null> {
  const batch = await db.batch.get(batchId);
  if (!batch || batch.deletedAt) return null;
  const [parcels, pending] = await Promise.all([
    db.parcel.where('batchId').equals(batchId).toArray(),
    loadPendingMails(db),
  ]);
  return {
    batch,
    mails: mailsOfBatch(pending, batchId),
    ...countBatch(parcels),
  };
}
