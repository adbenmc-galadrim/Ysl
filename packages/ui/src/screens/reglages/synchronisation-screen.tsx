import { ActionCard } from '#components/action-card';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type SynchronisationScreenProps = {
  /**
   * `synced` shows the green check; `pending` the orange clock; `alert` the
   * red mark of changes waiting for more than a day, to export for safety.
   */
  state: 'synced' | 'pending' | 'alert';
  title: string;
  /** "Dernière synchronisation à 11 h 21". */
  detail: string;
  /** The blue line of the card; "Synchroniser maintenant" when not given. */
  action?: string;
  onAction?: () => void;
  groups: SettingsGroup[];
  onBack?: () => void;
};

const CARD = {
  synced: { icon: 'check', tone: 'green' },
  pending: { icon: 'clock', tone: 'orange' },
  alert: { icon: 'alert', tone: 'red' },
} as const;

/**
 * What is stored on this iPhone and whether it reached the server. The state
 * card answers the only question an agent opens it with — "is everything
 * sent?" — and offers to sync right away.
 */
export function SynchronisationScreen({
  state,
  title,
  detail,
  action = 'Synchroniser maintenant',
  onAction,
  groups,
  onBack,
}: SynchronisationScreenProps) {
  return (
    <SettingsScreen title="Synchronisation" onBack={onBack}>
      <ActionCard
        size="lg"
        icon={CARD[state].icon}
        tone={CARD[state].tone}
        title={title}
        subtitle={detail}
        action={action}
        onAction={onAction}
        className="mb-1"
      />
      {groups.map((group) => (
        <SettingsGroupView key={group.header} {...group} />
      ))}
    </SettingsScreen>
  );
}
