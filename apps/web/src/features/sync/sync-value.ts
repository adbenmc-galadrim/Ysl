import type { TranslateFn } from '@repo/shared/i18n';
import type { SyncView } from '#/features/sync/use-sync';

/**
 * The pill at the top of Colis. "Hors ligne" also when the network is there
 * but the server is not (captive Wi-Fi, outage) and changes wait: "À jour"
 * would be a lie next to the banner.
 */
export function syncPill(
  sync: Pick<SyncView, 'online' | 'status' | 'pending'>,
): 'synced' | 'syncing' | 'offline' {
  if (!sync.online) return 'offline';
  if (sync.status === 'syncing') return 'syncing';
  if (sync.status === 'error' && sync.pending > 0) return 'offline';
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
  sync: Pick<SyncView, 'online' | 'status' | 'pending' | 'rejected'>,
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
  if (sync.rejected > 0) {
    return {
      label: t('settings.sync.rejected', { count: sync.rejected }),
      color: 'red',
    };
  }
  if (sync.status === 'error') {
    return { label: t('settings.sync.error'), color: 'red' };
  }
  return { label: t('settings.sync.upToDate'), color: 'green' };
}
