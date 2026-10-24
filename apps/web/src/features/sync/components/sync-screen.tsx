import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { SynchronisationScreen, type SettingsGroup } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '#/features/db/database';
import { formatBytes } from '#/features/db/storage';
import { displayVersion } from '#/features/install/app-host';
import { useStorageStatus } from '#/features/settings/api/use-storage-status';
import { syncCard } from '#/features/sync/sync-card';
import { syncNow } from '#/features/sync/sync';
import { useSync } from '#/features/sync/use-sync';
import { checkForUpdate, useUpdate } from '#/features/update/updater';

const t = createTranslator(DEFAULT_LOCALE);

const version = displayVersion(__APP_VERSION__);

async function countDevice() {
  const [parcels, photos] = await Promise.all([
    db.parcel.filter((parcel) => parcel.deletedAt === null).count(),
    db.photo.toArray(),
  ]);
  return {
    parcels,
    photoBytes: photos.reduce((total, photo) => total + photo.bytes, 0),
  };
}

export function SyncScreen() {
  const navigate = useNavigate();
  const sync = useSync();
  const storage = useStorageStatus();
  const update = useUpdate();
  const device = useLiveQuery(countDevice, [], { parcels: 0, photoBytes: 0 });
  const [checking, setChecking] = useState(false);
  const card = syncCard(sync, t);
  const protectedStorage = storage.data?.persisted;

  const onDevice: SettingsGroup = {
    header: t('sync.group.device'),
    footer:
      protectedStorage === false
        ? t('sync.group.device.footer.unprotected')
        : t('sync.group.device.footer'),
    items: [
      {
        icon: 'package',
        color: 'ink',
        label: t('sync.device.parcels'),
        value: String(device.parcels),
        chevron: false,
      },
      {
        icon: 'image',
        color: 'indigo',
        label: t('sync.device.photos'),
        value: formatBytes(device.photoBytes),
        chevron: false,
      },
      {
        icon: 'lock',
        color: protectedStorage === false ? 'orange' : 'green',
        label: t('sync.device.protected'),
        value:
          protectedStorage === undefined
            ? undefined
            : t(
                protectedStorage
                  ? 'sync.device.protected.yes'
                  : 'sync.device.protected.no',
              ),
        chevron: false,
      },
    ],
  };

  const updates: SettingsGroup = {
    header: t('sync.group.update'),
    items: [
      {
        icon: 'download',
        color: 'blue',
        label: t('settings.version', { version }),
        value: update.available
          ? t('settings.version.available')
          : t('settings.version.upToDate'),
        chevron: false,
      },
      {
        icon: 'refresh',
        color: 'grey',
        label: t('sync.update.check'),
        value: checking ? t('sync.update.checking') : undefined,
        chevron: false,
        onPress: () => {
          setChecking(true);
          void checkForUpdate().finally(() => setChecking(false));
        },
      },
    ],
  };

  return (
    <SynchronisationScreen
      state={card.state}
      title={card.title}
      detail={card.detail}
      action={t('sync.action')}
      onAction={() => void syncNow()}
      groups={[onDevice, updates]}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}
