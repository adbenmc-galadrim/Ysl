import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  CORNER_RADII,
  ReglagesScreen,
  THEMES,
  type SettingsGroup,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useHealthQuery } from '#/features/health/api/get-health';
import { displayVersion } from '#/features/install/app-host';
import { useCornerSetting } from '#/features/settings/corners';
import { setScanSound, useScanSound } from '#/features/settings/sound';
import { initialsOf } from '#/features/settings/initials';
import { useThemeSetting } from '#/features/settings/theme';
import { forceUpdate, useUpdate } from '#/features/update/updater';
import { useSession } from '#/features/auth/api/use-session';
import { useStorageStatus } from '#/features/settings/api/use-storage-status';
import { storageValue } from '#/features/settings/storage-value';
import { syncValue } from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';

const t = createTranslator(DEFAULT_LOCALE);

const version = displayVersion(__APP_VERSION__);

const FORCE_STATE = {
  idle: undefined,
  forcing: t('settings.forceUpdate.running'),
  failed: t('settings.forceUpdate.failed'),
} as const;

const SERVER_STATE = {
  up: t('settings.server.up'),
  down: t('settings.server.down'),
  unreachable: t('settings.server.unreachable'),
  checking: t('settings.server.checking'),
} as const;

function useServerState(): keyof typeof SERVER_STATE {
  const health = useHealthQuery();
  if (health.isError) return 'unreachable';
  if (!health.data) return 'checking';
  return health.data.api === 'up' && health.data.database === 'up'
    ? 'up'
    : 'down';
}

export function ReglagesHome() {
  const navigate = useNavigate();
  const session = useSession();
  const role = toUserRole(session.user.role);
  const server = useServerState();
  const storage = useStorageStatus();
  const sync = useSync();
  const theme = useThemeSetting();
  const corners = useCornerSetting();
  const sound = useScanSound();
  const update = useUpdate();
  const themeTitle = THEMES.find((option) => option.value === theme)?.title;
  const cornersTitle = CORNER_RADII.find(
    (preset) => preset.value === corners.radius,
  )?.title;

  const data: SettingsGroup = {
    header: t('settings.group.data'),
    items: [
      {
        icon: 'cloud',
        color: syncValue(sync, t).color,
        label: t('settings.sync'),
        value: syncValue(sync, t).label,
        onPress: () => void navigate({ to: '/reglages/synchronisation' }),
      },
      {
        icon: 'upload',
        color: server === 'up' ? 'green' : 'grey',
        label: t('settings.server'),
        value: SERVER_STATE[server],
        chevron: false,
      },
      {
        icon: 'download',
        color: 'indigo',
        label: t('settings.offline'),
        value: storageValue(storage.data, t),
        chevron: false,
      },
    ],
  };

  const service: SettingsGroup = {
    header: t('settings.group.service'),
    items: [
      {
        icon: 'users',
        color: 'orange',
        label: t('settings.directory'),
        onPress: () => void navigate({ to: '/reglages/annuaire' }),
      },
      {
        icon: 'pin',
        color: 'red',
        label: t('settings.pickup'),
        chevron: false,
      },
    ],
  };

  const app: SettingsGroup = {
    header: t('settings.group.app'),
    items: [
      {
        icon: 'volume',
        color: 'grey',
        label: t('settings.sound'),
        toggle: sound,
        onToggle: setScanSound,
      },
      {
        icon: 'sun',
        color: 'grey',
        label: t('settings.appearance'),
        value: themeTitle,
        onPress: () => void navigate({ to: '/reglages/apparence' }),
      },
      {
        icon: 'edit',
        color: 'grey',
        label: t('settings.corners'),
        value: cornersTitle,
        onPress: () => void navigate({ to: '/reglages/arrondis' }),
      },
      {
        icon: 'info',
        color: 'grey',
        label: t('settings.version', { version }),
        value: update.available
          ? t('settings.version.available')
          : t('settings.version.upToDate'),
        chevron: false,
      },
      {
        icon: 'refresh',
        color: 'grey',
        label: t('settings.forceUpdate'),
        value: FORCE_STATE[update.forcing],
        chevron: false,
        onPress: () => void forceUpdate(),
      },
    ],
  };

  return (
    <ReglagesScreen
      account={{
        name: session.user.name,
        initials: initialsOf(session.user.name),
        description: t(`settings.account.${role}`),
        onPress: () => void navigate({ to: '/reglages/compte' }),
      }}
      groups={role === 'admin' ? [data, service, app] : [data, app]}
      onBack={() => void navigate({ to: '/' })}
    />
  );
}
