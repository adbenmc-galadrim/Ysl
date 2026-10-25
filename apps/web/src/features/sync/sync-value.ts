import type { TranslateFn } from '@repo/shared/i18n';
import { DAY_MS } from '#/features/parcels/model';
import type { SyncView } from '#/features/sync/use-sync';

/**
 * A change still on the phone after a day is at risk (§8.4.7): Safari may
 * evict the storage, the phone may break. Past this, the screens turn red
 * and ask for the backup export, online or not.
 */
export const STALE_AFTER_MS = DAY_MS;

export function syncAlert(
  sync: Pick<SyncView, 'pending' | 'rejected' | 'oldestAt'>,
  now = new Date(),
): boolean {
  if (sync.pending + sync.rejected === 0 || !sync.oldestAt) return false;
  return now.getTime() - sync.oldestAt.getTime() > STALE_AFTER_MS;
}

/**
 * The pill at the top of Colis. "Hors ligne" also when the network is there
 * but the server is not (captive Wi-Fi, outage) and changes wait: "À jour"
 * would be a lie next to the orange banner. The pill keeps its three states
 * of the mock-up: the day-old alert is the red banner's job, so the pill
 * may well say "À jour" above it once the server took everything but the
 * refused changes.
 */
export function syncPill(
  sync: Pick<SyncView, 'online' | 'status' | 'pending'>,
): 'synced' | 'syncing' | 'offline' {
  if (!sync.online) return 'offline';
  if (sync.status === 'syncing') return 'syncing';
  if (sync.status === 'error' && sync.pending > 0) return 'offline';
  return 'synced';
}

/**
 * The run that opens the app is still pulling: what the server holds may
 * not be on the iPhone yet. Offline, nothing will come, so nothing waits.
 */
export function awaitsServer(
  sync: Pick<SyncView, 'online' | 'settled'>,
): boolean {
  return sync.online && !sync.settled;
}

/**
 * Changes still on the phone are announced once the server cannot be
 * reached, and whatever the network once they have waited for a day.
 */
export function showsPendingBanner(
  sync: Pick<
    SyncView,
    'online' | 'status' | 'pending' | 'rejected' | 'oldestAt'
  >,
  now = new Date(),
): boolean {
  if (syncAlert(sync, now)) return true;
  return sync.pending > 0 && (!sync.online || sync.status === 'error');
}

export type PendingBanner = {
  tone: 'orange' | 'red';
  icon: 'cloud' | 'alert';
  title: string;
  description: string;
};

/**
 * The Colis banner: orange while the network is away, red once a day has
 * passed. "En attente" counts everything still on the phone, refused
 * changes included, as the Synchronisation screen does.
 */
export function pendingBanner(
  sync: Pick<SyncView, 'pending' | 'rejected' | 'oldestAt'>,
  t: TranslateFn,
  now = new Date(),
): PendingBanner {
  const waiting = sync.pending + sync.rejected;
  if (syncAlert(sync, now)) {
    return {
      tone: 'red',
      icon: 'alert',
      title:
        waiting === 1
          ? t('colis.stale.title.one')
          : t('colis.stale.title.many', { count: waiting }),
      description: t('colis.stale.description'),
    };
  }
  return {
    tone: 'orange',
    icon: 'cloud',
    title:
      waiting === 1
        ? t('colis.pending.title.one')
        : t('colis.pending.title.many', { count: waiting }),
    description: t('colis.pending.description'),
  };
}

export type SyncValue = {
  label: string;
  color: 'green' | 'orange' | 'grey' | 'red';
};

/** The Réglages line: one word on where this iPhone stands with the server. */
export function syncValue(
  sync: Pick<
    SyncView,
    'online' | 'status' | 'pending' | 'rejected' | 'oldestAt'
  >,
  t: TranslateFn,
  now = new Date(),
): SyncValue {
  if (syncAlert(sync, now)) {
    return {
      label: t('settings.sync.pending', {
        count: sync.pending + sync.rejected,
      }),
      color: 'red',
    };
  }
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
