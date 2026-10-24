import { Avatar } from '#components/avatar';
import { GroupedList, GroupedRow } from '#components/grouped-list';
import type { Agent } from '#fixtures/people';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type ReglagesScreenProps = {
  /** The signed-in agent, on top; left out on the admin-only variant. */
  account?: Pick<Agent, 'name' | 'initials'> & {
    description: string;
    onPress?: () => void;
  };
  groups: SettingsGroup[];
  onBack?: () => void;
};

/**
 * Réglages. Few settings, grouped by what they touch — the data on this
 * iPhone, the mail service, the app — each showing its current value so the
 * screen answers "is it set up?" without opening anything.
 */
export function ReglagesScreen({
  account,
  groups,
  onBack,
}: ReglagesScreenProps) {
  return (
    <SettingsScreen title="Réglages" onBack={onBack}>
      {account && (
        <GroupedList>
          <GroupedRow
            size="lg"
            leading={<Avatar initials={account.initials} size="lg" />}
            title={account.name}
            subtitle={account.description}
            accessory="chevron"
            onClick={account.onPress}
          />
        </GroupedList>
      )}
      {groups.map((group) => (
        <SettingsGroupView
          key={group.header ?? group.items[0]?.label}
          {...group}
        />
      ))}
    </SettingsScreen>
  );
}
