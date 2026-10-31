import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { DeskPageHeader } from '#components/company-shell';
import { DeskStats, type DeskStat } from '#components/desk-panel';
import { GroupedRow, GroupedSection } from '#components/grouped-list';
import { HeroTile } from '#components/hero-tile';
import { Icon } from '#icons';
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

export type PlatformHomeScreenProps = {
  title: string;
  description: string;
  name: string;
  email: string;
  signOutLabel: string;
  signingOut?: boolean;
  onSignOut?: () => void;
  /** Why the sign-out stopped. */
  error?: string;
};

/**
 * The app's admin before the back-office exists: who is signed in and the way
 * out. It holds no company data (D26), so it says so and offers nothing else.
 */
export function PlatformHomeScreen({
  title,
  description,
  name,
  email,
  signOutLabel,
  signingOut = false,
  onSignOut,
  error,
}: PlatformHomeScreenProps) {
  return (
    <main className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-surface px-6 text-center text-ink">
      <HeroTile icon="building" size="lg" />
      <h1 className="mt-6 text-22 font-bold">{title}</h1>
      <p className="mt-2 max-w-[420px] text-16 leading-[23px] text-muted">
        {description}
      </p>
      <p className="mt-6 flex items-center gap-2 text-14 text-ink-2">
        <Icon name="user" size={16} className="shrink-0 text-muted" />
        <span>
          {name} · {email}
        </span>
      </p>
      <Button
        variant="outline"
        icon="logout"
        disabled={signingOut}
        onClick={onSignOut}
        className="mt-6 w-full max-w-[280px]"
      >
        {signOutLabel}
      </Button>
      {error && (
        <div role="alert" className="mt-4 w-full max-w-[420px]">
          <Banner tone="red" icon="alert" title={error} />
        </div>
      )}
    </main>
  );
}
