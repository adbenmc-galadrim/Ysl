import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CORNER_RADII, ReglagesScreen, type SettingsGroup } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useHealthQuery } from '#/features/health/api/get-health';
import { displayVersion } from '#/features/install/app-host';
import { useCornerSetting } from '#/features/settings/corners';
import { initialsOf } from '#/features/settings/initials';
import { useSession } from '#/features/settings/session';

const t = createTranslator(DEFAULT_LOCALE);

const version = displayVersion(__APP_VERSION__);

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
  const corners = useCornerSetting();
  const cornersTitle = CORNER_RADII.find(
    (preset) => preset.value === corners.radius,
  )?.title;

  const data: SettingsGroup = {
    header: t('settings.group.data'),
    items: [
      {
        icon: 'cloud',
        color: server === 'up' ? 'green' : 'grey',
        label: t('settings.server'),
        value: SERVER_STATE[server],
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
        chevron: false,
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
        icon: 'sun',
        color: 'grey',
        label: t('settings.corners'),
        value: cornersTitle,
        onPress: () => void navigate({ to: '/reglages/arrondis' }),
      },
      {
        icon: 'info',
        color: 'grey',
        label: t('settings.version', { version }),
        chevron: false,
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
