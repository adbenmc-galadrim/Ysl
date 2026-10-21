import { GroupedRow, GroupedSection } from '#components/grouped-list';
import { NavBarAction } from '#components/nav-bar';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type OpeningHours = { day: string; hours: string };

export type LieuEtHorairesScreenProps = {
  place: string;
  hours: OpeningHours[];
  /** The reminder rules, with the toggle that turns them off. */
  reminders: SettingsGroup;
};

/**
 * Where and when to collect. Every e-mail quotes these lines, so they are
 * shown exactly as the recipient will read them.
 */
export function LieuEtHorairesScreen({
  place,
  hours,
  reminders,
}: LieuEtHorairesScreenProps) {
  return (
    <SettingsScreen
      title="Lieu et horaires"
      trailing={<NavBarAction>OK</NavBarAction>}
      className="mt-4"
    >
      <GroupedSection header="Lieu de retrait">
        <GroupedRow title={place} />
      </GroupedSection>
      <GroupedSection header="Horaires">
        {hours.map(({ day, hours: slots }) => (
          <GroupedRow key={day} title={day} value={slots} />
        ))}
      </GroupedSection>
      <SettingsGroupView {...reminders} />
    </SettingsScreen>
  );
}
