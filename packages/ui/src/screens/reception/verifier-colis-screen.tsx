import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import {
  LabelZoom,
  LabelZoomButton,
  type LabelZoomProps,
} from '#components/parcel-label';
import { PersonOption, PersonOptionGroup } from '#components/person-option';
import { ScanFields, type ScanField } from '#components/scan-fields';
import { Screen } from '#components/screen';
import { whereabouts, type DirectoryEntry } from '#fixtures/reception';
import { Icon } from '#icons';

export type VerifierColisScreenProps = {
  /** Position in the parcels to check: "1 sur 2". */
  step: { index: number; total: number };
  /** The cropped label photo. */
  label: Omit<LabelZoomProps, 'action'>;
  /** The name as read, quoted under the question. */
  readName: string;
  candidates: DirectoryEntry[];
  selectedId?: string;
  /** What the scanner did read, all settled. */
  fields: ScanField[];
};

/**
 * One parcel the scanner flagged, fixed by the agent. The label photo comes
 * first because the answer is on it; the closest names of the directory are
 * offered as one-tap choices, and the directory itself is one link away for
 * the rare name the scanner did not guess.
 */
export function VerifierColisScreen({
  step,
  label,
  readName,
  candidates,
  selectedId,
  fields,
}: VerifierColisScreenProps) {
  return (
    <Screen
      bottomInset={132}
      bottom={
        <BottomBar surface="line">
          {/* Penpot sets the label 1 px above the middle. */}
          <Button block className="pb-0.5">
            Valider et suivant
          </Button>
        </BottomBar>
      }
    >
      <NavBar
        title={`${step.index} sur ${step.total}`}
        trailing={<NavBarAction>Passer</NavBarAction>}
      />
      <LabelZoom {...label} action={<LabelZoomButton />} className="mt-3" />

      <h2 className="mt-[22px] text-22 font-bold">Pour qui est ce colis ?</h2>
      <p className="mt-1.5 text-15 text-muted">
        Nom lu sur l’étiquette : « {readName} »
      </p>

      <PersonOptionGroup label="Destinataire" className="mt-[18px]">
        {candidates.map((person) => (
          <PersonOption
            key={person.id}
            initials={person.initials}
            name={person.name}
            detail={whereabouts(person)}
            selected={person.id === selectedId}
          />
        ))}
      </PersonOptionGroup>

      <button
        type="button"
        className="mt-[26px] flex cursor-pointer items-center gap-2.5 self-start pl-1.5 text-16 font-semibold text-blue outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <Icon name="search" size={20} />
        Chercher dans l’annuaire
      </button>

      <div className="mt-5 h-px bg-separator" />
      <ScanFields tone="light" fields={fields} className="mt-[13px]" />
    </Screen>
  );
}
