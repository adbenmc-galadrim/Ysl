import { Avatar } from '#components/avatar';
import { GroupedRow, GroupedSection } from '#components/grouped-list';
import type { TeamMember } from '#fixtures/team';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type EquipeScreenProps = {
  agents: TeamMember[];
  /** What every device sees live: parcels, directory, learnt senders. */
  shared: SettingsGroup;
  onInvite?: () => void;
};

/**
 * Several agents, several devices. Each agent shows their role and the
 * device they work on, with a dot for who is connected now — the question
 * when two people scan at the same desk.
 */
export function EquipeScreen({ agents, shared, onInvite }: EquipeScreenProps) {
  return (
    <SettingsScreen title="Équipe et postes">
      <GroupedSection
        header="Agents"
        footer={
          <button
            type="button"
            onClick={onInvite}
            className="-mb-px cursor-pointer text-16 font-semibold text-blue outline-none focus-visible:ring-2 focus-visible:ring-blue active:opacity-60"
          >
            + Inviter un agent
          </button>
        }
      >
        {agents.map((agent) => (
          <GroupedRow
            key={agent.id}
            leading={
              <Avatar
                initials={agent.initials}
                className="text-14"
                status={agent.online ? 'online' : 'offline'}
              />
            }
            title={agent.name}
            subtitle={`${agent.role}, ${agent.device}`}
          />
        ))}
      </GroupedSection>
      <SettingsGroupView {...shared} />
    </SettingsScreen>
  );
}
