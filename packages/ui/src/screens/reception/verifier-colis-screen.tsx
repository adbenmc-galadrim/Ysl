import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import {
  LabelCrop,
  type LabelCropProps,
  LabelZoom,
  LabelZoomButton,
  type LabelZoomProps,
} from '#components/parcel-label';
import { PersonOption, PersonOptionGroup } from '#components/person-option';
import { ScanFields, type ScanField } from '#components/scan-fields';
import { Screen } from '#components/screen';
import { Icon } from '#icons';

/** A person the scanner proposes, or that the directory lists. */
export type RecipientOption = {
  id: string;
  name: string;
  initials: string;
  /** Where to find them: "Presse, 3e étage". */
  detail?: string;
  /** Cut short in the list; the agent only needs to tell homonyms apart. */
  email?: string;
};

export type VerifierColisScreenProps = {
  /** Position in the parcels to check: "1 sur 2". */
  step: { index: number; total: number };
  /** The label as the mockups draw it. */
  label?: Omit<LabelZoomProps, 'action'>;
  /** The real photo, cropped to the name; wins over `label`. */
  photo?: Omit<LabelCropProps, 'action'>;
  /** The name as read, quoted under the question; null when none was. */
  readName: string | null;
  candidates: RecipientOption[];
  selectedId?: string;
  /** What the scanner did read, all settled. */
  fields: ScanField[];
  /** Shown when the scanner proposes nobody: a new card, from the name read. */
  addPerson?: { name: string | null; onClick: () => void };
  submitLabel?: string;
  onBack?: () => void;
  onSkip?: () => void;
  onZoom?: () => void;
  onSelect?: (id: string) => void;
  onSearch?: () => void;
  onSubmit?: () => void;
};

/**
 * One parcel the scanner flagged, fixed by the agent. The label photo comes
 * first because the answer is on it; the closest names of the directory are
 * offered as one-tap choices, and the directory itself is one link away for
 * the rare name the scanner did not guess. Nothing chosen, nothing to
 * validate: « Passer » leaves the parcel to complete later.
 */
export function VerifierColisScreen({
  step,
  label,
  photo,
  readName,
  candidates,
  selectedId,
  fields,
  addPerson,
  submitLabel = 'Valider et suivant',
  onBack,
  onSkip,
  onZoom,
  onSelect,
  onSearch,
  onSubmit,
}: VerifierColisScreenProps) {
  const zoom = <LabelZoomButton onClick={onZoom} />;
  return (
    <Screen
      bottomInset={132}
      bottom={
        <BottomBar surface="line">
          {/* Penpot sets the label 1 px above the middle. */}
          <Button
            block
            className="pb-0.5"
            disabled={selectedId === undefined}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </BottomBar>
      }
    >
      <NavBar
        title={`${step.index} sur ${step.total}`}
        onBack={onBack}
        trailing={<NavBarAction onClick={onSkip}>Passer</NavBarAction>}
      />
      {photo ? (
        <LabelCrop {...photo} action={zoom} className="mt-3" />
      ) : (
        label && <LabelZoom {...label} action={zoom} className="mt-3" />
      )}

      <h2 className="mt-[22px] text-22 font-bold">Pour qui est ce colis ?</h2>
      <p className="mt-1.5 text-15 text-muted">
        {readName
          ? `Nom lu sur l’étiquette : « ${readName} »`
          : 'Aucun nom lu sur l’étiquette'}
      </p>

      {candidates.length > 0 ? (
        <PersonOptionGroup label="Destinataire" className="mt-[18px]">
          {candidates.map((person) => (
            <PersonOption
              key={person.id}
              initials={person.initials}
              name={person.name}
              detail={person.detail}
              selected={person.id === selectedId}
              onClick={() => onSelect?.(person.id)}
            />
          ))}
        </PersonOptionGroup>
      ) : (
        addPerson && (
          <button
            type="button"
            onClick={addPerson.onClick}
            className="mt-[18px] flex h-16 cursor-pointer items-center gap-[15px] rounded-card border border-dashed border-border pb-0.5 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            <Icon name="user" size={22} className="shrink-0" />
            <span className="flex min-w-0 flex-col pr-4">
              <span className="truncate text-16 font-semibold">
                {addPerson.name
                  ? `Ajouter « ${addPerson.name} » à l’annuaire`
                  : 'Ajouter une personne à l’annuaire'}
              </span>
              <span className="mt-[3px] truncate text-13 text-muted">
                Personne pas encore dans l’annuaire
              </span>
            </span>
          </button>
        )
      )}

      <button
        type="button"
        onClick={onSearch}
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
