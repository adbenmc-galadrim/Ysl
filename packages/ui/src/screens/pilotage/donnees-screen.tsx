import { ActionCard } from '#components/action-card';
import { GroupedFootnote } from '#components/grouped-list';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type DonneesScreenProps = {
  /** How long each kind of record is kept, as validated by the DPO. */
  retention: SettingsGroup;
  /** "Le 1er novembre : 214 photos et 38 colis". */
  nextPurge: string;
  note: string;
};

/**
 * Data and privacy. Label photos carry names and addresses, so they are kept
 * for a set time and purged on their own; the screen says when, and lets the
 * admin export before it happens.
 */
export function DonneesScreen({ retention, nextPurge, note }: DonneesScreenProps) {
  return (
    <SettingsScreen title="Données">
      <SettingsGroupView {...retention} />
      <ActionCard
        icon="trash"
        tone="neutral"
        title="Prochaine purge automatique"
        subtitle={nextPurge}
        action="Exporter avant la purge"
      />
      <GroupedFootnote>{note}</GroupedFootnote>
    </SettingsScreen>
  );
}
