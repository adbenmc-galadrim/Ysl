import type { TranslateFn } from '@repo/shared/i18n';
import { formatTime, startOfDay } from '#/features/parcels/model';
import type { SyncView } from '#/features/sync/use-sync';

export type SyncCard = {
  state: 'synced' | 'pending';
  title: string;
  detail: string;
};

/**
 * The state card of the Synchronisation screen: is everything sent, and
 * when did it last go through. Changes left to send make it orange, whether
 * the phone is offline or the server refused them.
 */
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

/** "à 11 h 21" today, "le 23 octobre à 11 h 21" before. */
export function formatSyncTime(at: Date, now: Date): string {
  if (at >= startOfDay(now)) return `à ${formatTime(at)}`;
  return `le ${dateFormat.format(at)} à ${formatTime(at)}`;
}

export function syncCard(
  sync: Pick<
    SyncView,
    'online' | 'status' | 'pending' | 'rejected' | 'lastSyncAt'
  >,
  t: TranslateFn,
  now = new Date(),
): SyncCard {
  const waiting = sync.pending + sync.rejected;
  const title =
    waiting === 0
      ? t('sync.state.synced')
      : sync.pending > 0
        ? sync.pending === 1
          ? t('sync.state.pending.one')
          : t('sync.state.pending.many', { count: sync.pending })
        : sync.rejected === 1
          ? t('sync.state.rejected.one')
          : t('sync.state.rejected.many', { count: sync.rejected });
  let detail: string;
  if (!sync.online) detail = t('sync.detail.offline');
  else if (sync.status === 'syncing') detail = t('sync.detail.syncing');
  else if (sync.status === 'error') detail = t('sync.detail.error');
  else if (sync.lastSyncAt) {
    detail = t('sync.detail.last', {
      time: formatSyncTime(sync.lastSyncAt, now),
    });
  } else detail = t('sync.detail.never');
  return { state: waiting === 0 ? 'synced' : 'pending', title, detail };
}
