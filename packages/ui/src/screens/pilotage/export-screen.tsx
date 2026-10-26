import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import {
  GroupedRow,
  GroupedSection,
  SettingsIcon,
} from '#components/grouped-list';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';

export type ExportState =
  | 'idle'
  | 'running'
  /** Written, but the share sheet wants a fresh touch to open. */
  | 'ready'
  | 'offline'
  | 'failed'
  | 'done';

const ACTION: Partial<Record<ExportState, string>> = {
  running: 'Préparation…',
  ready: 'Partager le fichier',
};

export type ExportScreenProps = {
  state: ExportState;
  /** "courrier-historique-2026-10-26.csv". */
  fileName: string;
  /** The line under the card: why the button is off, or how the last export went. */
  note?: string;
  onExport?: () => void;
  onBack?: () => void;
};

/**
 * The export half of "Rapports et export": the whole history in one file
 * Excel opens as is. The server writes it, so the button waits for the
 * network rather than exporting what this iPhone happens to hold.
 */
export function ExportScreen({
  state,
  fileName,
  note,
  onExport,
  onBack,
}: ExportScreenProps) {
  return (
    <Screen
      tone="fill"
      bottomInset={104}
      bottom={
        <BottomBar surface="none" className="bg-fill pt-3">
          <Button
            block
            disabled={state === 'offline' || state === 'running'}
            onClick={onExport}
          >
            {ACTION[state] ?? 'Exporter en CSV'}
          </Button>
        </BottomBar>
      }
    >
      <NavBar title="Export" onBack={onBack} />
      <div className="mt-3 flex flex-col gap-5">
        <GroupedSection header="Historique des colis" footer={note}>
          <GroupedRow
            leading={<SettingsIcon icon="list" color="sky" />}
            title="Contenu"
            value="Tous les colis"
          />
          <GroupedRow
            leading={<SettingsIcon icon="download" color="green" />}
            title="Format"
            value="CSV pour Excel"
          />
          <GroupedRow
            leading={<SettingsIcon icon="inbox" color="grey" />}
            title="Fichier"
            subtitle={fileName}
          />
        </GroupedSection>
      </div>
    </Screen>
  );
}
