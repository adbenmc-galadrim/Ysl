import { damageOf } from '@repo/contract/parcel-damage';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  CourrierDatabase,
  LocalBatch,
  LocalParcel,
} from '#/features/db/schema';
import { loadPendingMails } from '#/features/mail/pending-mails';
import {
  requestServerMails,
  serverMailOn,
  waitingOnServer,
} from '#/features/mail/server-mail';
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
  /** Left on the tour, nobody told yet (§3.7.6). */
  onTour: number;
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
    toNotify: live.filter((parcel) => awaitsNotice(parcel)).length,
    onTour: live.filter((parcel) => parcel.status === 'en_route').length,
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
  /** The mails the server is sending for this batch, nothing to do for them. */
  serverMails: number;
};

/**
 * Asks the server for the mails of a batch just validated (D12, ME04), one per
 * recipient with an address, when it sends them; otherwise nothing changes and
 * Notifier takes over. A failure here leaves the parcels in « À notifier ».
 */
export async function requestBatchMails(
  db: CourrierDatabase,
  batchId: string,
  { userId, now = new Date() }: { userId: string; now?: Date },
): Promise<void> {
  if (!(await serverMailOn(db))) return;
  const mails = mailsOfBatch(await loadPendingMails(db), batchId);
  await requestServerMails(db, mails, 'avis', { userId, now });
}

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
  const inBatch = new Set(parcels.map(({ id }) => id));
  const recent = await db.notification
    .where('preparedAt')
    .aboveOrEqual(batch.startedAt)
    .toArray();
  const on = await serverMailOn(db);
  const now = new Date();
  return {
    batch,
    mails: mailsOfBatch(pending, batchId),
    serverMails: on
      ? recent.filter(
          (row) =>
            waitingOnServer(row, now) &&
            row.parcelIds.some((id) => inBatch.has(id)),
        ).length
      : 0,
    ...countBatch(parcels),
  };
}
