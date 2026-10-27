import type { ReactNode } from 'react';

import { ActionCard } from '#components/action-card';
import { Button } from '#components/button';
import { GroupedFootnote } from '#components/grouped-list';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type DonneesPurge = {
  /** "Prochaine purge automatique", "Dernière purge". */
  title?: string;
  /** "Le 1er novembre : 214 photos et 38 colis". */
  subtitle: ReactNode;
  /** "Exporter avant la purge", "Purger maintenant". */
  action?: ReactNode;
  onAction?: () => void;
  /** Offline, or a purge already running. */
  disabled?: boolean;
};

export type DonneesErase = {
  /** "Effacer les données de cet iPhone". */
  label: string;
  /** What the button does, under it. */
  note?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
};

export type DonneesScreenProps = {
  /** How long each kind of record is kept, as validated by the DPO. */
  retention: SettingsGroup;
  purge: DonneesPurge;
  note: ReactNode;
  /** Empties this device (§9.1); absent in the mockup. */
  erase?: DonneesErase;
  /** A message over the card: the outcome of a purge asked by hand. */
  banner?: ReactNode;
  onBack?: () => void;
};

/**
 * Data and privacy. Label photos carry names and addresses, so they are kept
 * for a set time and purged on their own; the screen says how long, what the
 * last purge took, lets the admin purge at once, and empties the iPhone.
 */
export function DonneesScreen({
  retention,
  purge,
  note,
  erase,
  banner,
  onBack,
}: DonneesScreenProps) {
  return (
    <SettingsScreen title="Données" onBack={onBack}>
      <SettingsGroupView {...retention} />
      {banner}
      <ActionCard
        icon="trash"
        tone="neutral"
        title={purge.title ?? 'Prochaine purge automatique'}
        subtitle={purge.subtitle}
        action={purge.action ?? 'Exporter avant la purge'}
        onAction={purge.onAction}
        actionDisabled={purge.disabled}
      />
      <GroupedFootnote>{note}</GroupedFootnote>
      {erase && (
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            icon="trash"
            block
            disabled={erase.disabled}
            onClick={erase.onPress}
          >
            {erase.label}
          </Button>
          {erase.note && (
            <p className="px-4 text-center text-13 text-muted">{erase.note}</p>
          )}
        </div>
      )}
    </SettingsScreen>
  );
}
