import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  CORNER_RADII,
  GroupedRow,
  GroupedSection,
  Icon,
  SettingsScreen,
  Switch,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import {
  setCornerSetting,
  useCornerSetting,
} from '#/features/settings/corners';

const t = createTranslator(DEFAULT_LOCALE);

export function CornersScreen() {
  const navigate = useNavigate();
  const setting = useCornerSetting();
  const roundTiles = setting.tiles === 'rondes';

  return (
    <SettingsScreen
      title={t('settings.corners.title')}
      onBack={() => void navigate({ to: '/reglages' })}
    >
      <GroupedSection footer={t('settings.corners.footer')}>
        {CORNER_RADII.map((preset) => (
          <GroupedRow
            key={preset.value}
            title={preset.title}
            subtitle={preset.detail}
            onClick={() =>
              setCornerSetting({ ...setting, radius: preset.value })
            }
            accessory={
              preset.value === setting.radius ? (
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
      <GroupedSection footer={t('settings.corners.tilesFooter')}>
        <GroupedRow
          title={t('settings.corners.tiles')}
          accessory={
            <Switch
              checked={roundTiles}
              label={t('settings.corners.tiles')}
              onCheckedChange={(checked) =>
                setCornerSetting({
                  ...setting,
                  tiles: checked ? 'rondes' : 'auto',
                })
              }
            />
          }
        />
      </GroupedSection>
    </SettingsScreen>
  );
}
