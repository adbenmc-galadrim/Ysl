import { ActionCard } from '#components/action-card';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type ImportV1ScreenProps = {
  /**
   * `ready` offers to pick the file; `importing` waits for the server;
   * `done` shows the report, `flagged` when some trackings need a look;
   * `failed` and `offline` say why nothing was imported.
   */
  state: 'ready' | 'importing' | 'done' | 'flagged' | 'failed' | 'offline';
  title: string;
  detail: string;
  /** The blue line of the card: "Choisir le fichier CSV". */
  action?: string;
  onAction?: () => void;
  /** The report: trackings marked, rows left out. */
  groups?: SettingsGroup[];
  onBack?: () => void;
};

const CARD = {
  ready: { icon: 'upload', tone: 'blue' },
  importing: { icon: 'clock', tone: 'grey' },
  done: { icon: 'check', tone: 'green' },
  flagged: { icon: 'alert', tone: 'orange' },
  failed: { icon: 'alert', tone: 'red' },
  offline: { icon: 'wifiOff', tone: 'grey' },
} as const;

/**
 * Brings the parcels of the first app over from its CSV export, then says
 * what came in, what was left out and which trackings fail their check —
 * built on the Synchronisation screen, no mock-up of its own.
 */
export function ImportV1Screen({
  state,
  title,
  detail,
  action,
  onAction,
  groups = [],
  onBack,
}: ImportV1ScreenProps) {
  return (
    <SettingsScreen title="Historique v1" onBack={onBack}>
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
