import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  SynchronisationScreen,
  type SettingsGroup,
  type SettingsItem,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '#/features/db/database';
import { formatBytes } from '#/features/db/storage';
import { formatTime } from '#/features/parcels/model';
import { displayVersion } from '#/features/install/app-host';
import { useStorageStatus } from '#/features/settings/api/use-storage-status';
import { backupFile, buildBackup } from '#/features/sync/backup';
import { describeChange, listWaitingChanges } from '#/features/sync/changes';
import { syncCard } from '#/features/sync/sync-card';
import { syncNow } from '#/features/sync/sync';
import { useSync } from '#/features/sync/use-sync';
import { checkForUpdate, useUpdate } from '#/features/update/updater';
import { shareFile } from '#/lib/share-file';

const t = createTranslator(DEFAULT_LOCALE);

const version = displayVersion(__APP_VERSION__);

/** Rows shown before the list folds into "et N autres changements". */
const SHOWN_CHANGES = 10;

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
  const changes = useLiveQuery(() => listWaitingChanges(db), [], []);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState<
    { state: 'idle' | 'running' | 'failed' } | { state: 'done'; at: Date }
  >({ state: 'idle' });
  const card = syncCard(sync, t);

  const exportBackup = async () => {
    if (exporting.state === 'running') return;
    setExporting({ state: 'running' });
    try {
      const now = new Date();
      const backup = await buildBackup(db, { now, app: version });
      const outcome = await shareFile(
        backupFile(backup, now),
        t('sync.export'),
      );
      setExporting(
        outcome === 'cancelled'
          ? { state: 'idle' }
          : { state: 'done', at: now },
      );
    } catch (error) {
      console.error('Backup export failed', error);
      setExporting({ state: 'failed' });
    }
  };
  const protectedStorage = storage.data?.persisted;

  const hidden = Math.max(0, changes.length - SHOWN_CHANGES);
  const waiting: SettingsGroup | null = changes.length
    ? {
        header: t('sync.changes.header', { count: changes.length }),
        footer: [
          hidden === 0
            ? null
            : hidden === 1
              ? t('sync.changes.more.one')
              : t('sync.changes.more.many', { count: hidden }),
          t('sync.changes.footer'),
        ]
          .filter(Boolean)
          .join(' '),
        items: (() => {
          const exportRow: SettingsItem = {
            key: 'export',
            icon: 'share',
            color: 'blue',
            label: t('sync.export'),
            value:
              exporting.state === 'running'
                ? t('sync.export.running')
                : exporting.state === 'failed'
                  ? t('sync.export.failed')
                  : exporting.state === 'done'
                    ? t('sync.export.done', { time: formatTime(exporting.at) })
                    : undefined,
            chevron: false,
            onPress: () => void exportBackup(),
          };
          const rows = changes
            .slice(0, SHOWN_CHANGES)
            .map((change) => describeChange(change, t));
          // Under the alert the export is what the card asks for: first row.
          return card.state === 'alert'
            ? [exportRow, ...rows]
            : [...rows, exportRow];
        })(),
      }
    : null;

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
      onAction={() => void syncNow({ force: true })}
      groups={waiting ? [waiting, onDevice, updates] : [onDevice, updates]}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}
