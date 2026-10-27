import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  GroupedRow,
  GroupedSection,
  Icon,
  SettingsScreen,
  THEMES,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { setThemeSetting, useThemeSetting } from '#/features/settings/theme';

const t = createTranslator(DEFAULT_LOCALE);

export function AppearanceScreen() {
  const navigate = useNavigate();
  const theme = useThemeSetting();

  return (
    <SettingsScreen
      title={t('settings.appearance.title')}
      onBack={() => void navigate({ to: '/reglages' })}
    >
      <GroupedSection footer={t('settings.appearance.footer')}>
        {THEMES.map((option) => (
          <GroupedRow
            key={option.value}
            title={option.title}
            subtitle={option.detail}
            onClick={() => setThemeSetting(option.value)}
            selected={option.value === theme}
            accessory={
              option.value === theme ? (
                <Icon
                  name="tick"
                  size={20}
                  strokeWidth={2.4}
                  className="text-blue"
                />
              ) : undefined
            }
          />
        ))}
      </GroupedSection>
    </SettingsScreen>
  );
}
