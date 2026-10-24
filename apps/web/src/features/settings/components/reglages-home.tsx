import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ReglagesScreen, type SettingsGroup } from '@repo/ui';
import { displayVersion } from '#/features/install/app-host';

const t = createTranslator(DEFAULT_LOCALE);

const version = displayVersion(__APP_VERSION__);

export function ReglagesHome() {
  const groups: SettingsGroup[] = [
    {
      header: t('settings.group.app'),
      items: [
        {
          icon: 'info',
          color: 'grey',
          label: t('settings.version', { version }),
          chevron: false,
        },
      ],
    },
  ];
  return <ReglagesScreen groups={groups} />;
}
