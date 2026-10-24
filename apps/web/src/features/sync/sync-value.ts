import type { TranslateFn } from '@repo/shared/i18n';
import type { SyncView } from '#/features/sync/use-sync';

/** The pill at the top of Colis: offline wins, then a run in progress, then all is well. */
export function syncPill(
  sync: Pick<SyncView, 'online' | 'status'>,
): 'synced' | 'syncing' | 'offline' {
  if (!sync.online) return 'offline';
  if (sync.status === 'syncing') return 'syncing';
  return 'synced';
}

/** Changes still on the phone are announced once the server cannot be reached. */
export function showsPendingBanner(
  sync: Pick<SyncView, 'online' | 'status' | 'pending'>,
): boolean {
  return sync.pending > 0 && (!sync.online || sync.status === 'error');
}

export type SyncValue = {
  label: string;
  color: 'green' | 'orange' | 'grey' | 'red';
};

/** The Réglages line: one word on where this iPhone stands with the server. */
export function syncValue(
  sync: Pick<SyncView, 'online' | 'status' | 'pending'>,
  t: TranslateFn,
): SyncValue {
  if (!sync.online)
    return { label: t('settings.sync.offline'), color: 'orange' };
  if (sync.status === 'syncing') {
    return { label: t('settings.sync.syncing'), color: 'grey' };
  }
  if (sync.pending > 0) {
    return {
      label: t('settings.sync.pending', { count: sync.pending }),
      color: 'orange',
    };
  }
  if (sync.status === 'error') {
    return { label: t('settings.sync.error'), color: 'red' };
  }
  return { label: t('settings.sync.upToDate'), color: 'green' };
}
