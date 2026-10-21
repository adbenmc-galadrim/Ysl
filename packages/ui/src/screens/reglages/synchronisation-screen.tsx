import { ActionCard } from '#components/action-card';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type SynchronisationScreenProps = {
  /** `synced` shows the green check; `pending` the orange clock. */
  state: 'synced' | 'pending';
  title: string;
  /** "Dernière synchronisation à 11 h 21". */
  detail: string;
  groups: SettingsGroup[];
};

/**
 * What is stored on this iPhone and whether it reached the server. The state
 * card answers the only question an agent opens it with — "is everything
 * sent?" — and offers to sync right away.
 */
export function SynchronisationScreen({
  state,
  title,
  detail,
  groups,
}: SynchronisationScreenProps) {
  return (
    <SettingsScreen title="Synchronisation">
      <ActionCard
        size="lg"
        icon={state === 'synced' ? 'check' : 'clock'}
        tone={state === 'synced' ? 'green' : 'orange'}
        title={title}
        subtitle={detail}
        action="Synchroniser maintenant"
        className="mb-1"
      />
      {groups.map((group) => (
        <SettingsGroupView key={group.header} {...group} />
      ))}
    </SettingsScreen>
  );
}
