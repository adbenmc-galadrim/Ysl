import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { DeskPageHeader } from '#components/company-shell';
import { DeskStats, type DeskStat } from '#components/desk-panel';
import { GroupedRow, GroupedSection } from '#components/grouped-list';
import { SettingsScreen } from '#screens/reglages/settings-screen';

export type RoleHomeProps = {
  title: string;
  subtitle?: string;
  /** Figures the device really holds; none rather than invented ones. */
  stats?: DeskStat[];
  /** What this space will hold, and until when the app does without. */
  notice: { title: string; description: string };
  action?: { label: string; onPress: () => void };
};

/** The home of a role on the computer, its content inside `CompanyShell`. */
export function RoleHomeDesktop({
  title,
  subtitle,
  stats,
  notice,
  action,
}: RoleHomeProps) {
  return (
    <>
      <DeskPageHeader
        title={title}
        subtitle={subtitle}
        actions={
          action && (
            <Button size="desk" onClick={action.onPress}>
              {action.label}
            </Button>
          )
        }
      />
      {stats && <DeskStats stats={stats} className="mt-5" />}
      <Banner
        tone="blue"
        icon="info"
        title={notice.title}
        description={notice.description}
        className="mt-5"
      />
    </>
  );
}

/** The same space on the phone, opened from Réglages. */
export function RoleHomeMobile({
  title,
  subtitle,
  stats,
  notice,
  action,
  onBack,
}: RoleHomeProps & { onBack?: () => void }) {
  return (
    <SettingsScreen title={title} onBack={onBack}>
      {subtitle && <p className="px-4 text-15 text-muted">{subtitle}</p>}
      {stats && (
        <GroupedSection>
          {stats.map((stat) => (
            <GroupedRow
              key={stat.label}
              title={stat.label}
              value={stat.value}
            />
          ))}
        </GroupedSection>
      )}
      <Banner
        tone="blue"
        icon="info"
        title={notice.title}
        description={notice.description}
      />
      {action && (
        <Button block onClick={action.onPress}>
          {action.label}
        </Button>
      )}
    </SettingsScreen>
  );
}
