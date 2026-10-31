import { isCompanyAdmin, toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  CORNER_RADII,
  ReglagesScreen,
  THEMES,
  type SettingsGroup,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useHealthQuery } from '#/features/health/api/get-health';
import { displayVersion } from '#/features/install/app-host';
import { useMailTarget } from '#/features/mail/mail-target';
import { useCornerSetting } from '#/features/settings/corners';
import { setScanSound, useScanSound } from '#/features/settings/sound';
import { initialsOf } from '#/features/settings/initials';
import { useThemeSetting } from '#/features/settings/theme';
import { forceUpdate, useUpdate } from '#/features/update/updater';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { listed } from '#/features/directory/people';
import { countMails, type MailCounts } from '#/features/mail/tracking';
import { useSentMails } from '#/features/mail/use-sent-mails';
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

/** "2 à confirmer" first: an answer only this agent can give; then the failures. */
function mailsValue(counts: MailCounts | undefined): string | undefined {
  if (!counts) return undefined;
  if (counts.toConfirm)
    return t('mails.value.toConfirm', { count: counts.toConfirm });
  if (counts.failed === 1) return t('mails.value.failed.one');
  if (counts.failed)
    return t('mails.value.failed.many', { count: counts.failed });
  return undefined;
}

export function ReglagesHome() {
  const navigate = useNavigate();
  const session = useSession();
  const role = toUserRole(session.user.role);
  const server = useServerState();
  const storage = useStorageStatus();
  const sync = useSync();
  const theme = useThemeSetting();
  const mailTarget = useMailTarget();
  const corners = useCornerSetting();
  const sound = useScanSound();
  const update = useUpdate();
  const directorySize = useLiveQuery(
    () => db.directoryPerson.filter(listed).count(),
    [],
  );
  const sent = useSentMails();
  const sentMails = sent && countMails(sent.mails);
  const themeTitle = THEMES.find((option) => option.value === theme)?.title;
  const cornersTitle = CORNER_RADII.find(
    (preset) => preset.value === corners.radius,
  )?.title;

  const steering: SettingsGroup = {
    header: t('settings.group.steering'),
    items: [
      {
        icon: 'list',
        color: 'sky',
        label: t('settings.export'),
        onPress: () => void navigate({ to: '/reglages/export' }),
      },
      {
        icon: 'check',
        color: 'green',
        label: t('settings.handovers'),
        onPress: () => void navigate({ to: '/reglages/remises' }),
      },
      ...(isCompanyAdmin(role)
        ? [
            {
              icon: 'lock' as const,
              color: 'grey' as const,
              label: t('settings.privacy'),
              onPress: () => void navigate({ to: '/reglages/donnees' }),
            },
          ]
        : []),
    ],
  };

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

  const mail: SettingsGroup = {
    header: t('settings.group.mail'),
    items: [
      {
        icon: 'mail',
        color: 'blue',
        label: t('settings.mailTemplates'),
        onPress: () => void navigate({ to: '/reglages/modeles-email' }),
      },
      {
        icon: 'send',
        color: 'sky',
        label: t('settings.mailApp'),
        value: t(`mail.target.${mailTarget}`),
        onPress: () => void navigate({ to: '/reglages/messagerie' }),
      },
      {
        icon: 'send',
        color: 'blue',
        label: t('settings.sentMails'),
        value: mailsValue(sentMails),
        onPress: () =>
          void navigate({
            to: '/reglages/e-mails',
            search: sentMails?.toConfirm ? { filtre: 'toConfirm' } : {},
          }),
      },
      ...(isCompanyAdmin(role)
        ? [
            {
              icon: 'globe' as const,
              color: 'indigo' as const,
              label: t('settings.sender'),
              onPress: () => void navigate({ to: '/reglages/expediteur' }),
            },
          ]
        : []),
    ],
  };

  const directoryItem: SettingsGroup['items'][number] = {
    icon: 'users',
    color: 'orange',
    label: t('settings.directory'),
    value: directorySize ? String(directorySize) : undefined,
    onPress: () => void navigate({ to: '/reglages/annuaire' }),
  };
  const ownDirectory: SettingsGroup = {
    header: t('settings.group.service'),
    items: [directoryItem],
  };

  const service: SettingsGroup = {
    header: t('settings.group.service'),
    items: [
      directoryItem,
      {
        icon: 'pin',
        color: 'red',
        label: t('settings.pickup'),
        onPress: () => void navigate({ to: '/reglages/lieu-et-horaires' }),
      },
      ...(isCompanyAdmin(role)
        ? [
            {
              icon: 'list' as const,
              color: 'grey' as const,
              label: t('settings.operating'),
              onPress: () => void navigate({ to: '/reglages/fonctionnement' }),
            },
          ]
        : []),
      {
        icon: 'upload',
        color: 'indigo',
        label: t('settings.importV1'),
        onPress: () => void navigate({ to: '/reglages/import-v1' }),
      },
      {
        icon: 'phone',
        color: 'grey',
        label: t('settings.devices'),
        onPress: () => void navigate({ to: '/reglages/appareils' }),
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
        description: role ? t(`settings.account.${role}`) : '',
        onPress: () => void navigate({ to: '/reglages/compte' }),
      }}
      groups={
        isCompanyAdmin(role)
          ? [steering, data, mail, service, app]
          : role === 'department'
            ? [steering, data, mail, ownDirectory, app]
            : [steering, data, mail, app]
      }
      onBack={() => void navigate({ to: '/' })}
    />
  );
}
