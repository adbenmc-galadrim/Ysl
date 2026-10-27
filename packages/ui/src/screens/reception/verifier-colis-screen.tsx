import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CheckCircle } from '#components/checkbox';
import { Field, FieldInput } from '#components/field';
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
import { cn } from '#lib/tv';

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
  /** Room under the question for « D’où vient cette valeur ? » (YSL-59). */
  source?: ReactNode;
};

/** What every step of « Vérifier un colis » shares, whatever field it asks about. */
type VerifyFrameProps = Pick<
  VerifierColisScreenProps,
  | 'step'
  | 'label'
  | 'photo'
  | 'fields'
  | 'onBack'
  | 'onSkip'
  | 'onZoom'
  | 'onSubmit'
  | 'source'
> & {
  question: string;
  hint: string;
  submitLabel: string;
  submitDisabled?: boolean;
  children: ReactNode;
};

/**
 * The label photo first because the answer is on it, one question, the
 * settled fields under a hairline, one button. « Passer » leaves the parcel
 * to complete later.
 */
function VerifyFrame({
  step,
  label,
  photo,
  fields,
  question,
  hint,
  source,
  submitLabel,
  submitDisabled = false,
  onBack,
  onSkip,
  onZoom,
  onSubmit,
  children,
}: VerifyFrameProps) {
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
            disabled={submitDisabled}
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

      <h2 className="mt-[22px] text-22 font-bold">{question}</h2>
      <p className="mt-1.5 text-15 text-muted">{hint}</p>
      {source}

      {children}

      {fields.length > 0 && (
        <>
          <div className="mt-5 h-px bg-separator" />
          <ScanFields tone="light" fields={fields} className="mt-[13px]" />
        </>
      )}
    </Screen>
  );
}

/**
 * The recipient step: the closest names of the directory are offered as
 * one-tap choices, and the directory itself is one link away for the rare
 * name the scanner did not guess. Nothing chosen, nothing to validate.
 */
export function VerifierColisScreen({
  readName,
  candidates,
  selectedId,
  addPerson,
  submitLabel = 'Valider et suivant',
  onSelect,
  onSearch,
  ...frame
}: VerifierColisScreenProps) {
  return (
    <VerifyFrame
      {...frame}
      question="Pour qui est ce colis ?"
      hint={
        readName
          ? `Nom lu sur l’étiquette : « ${readName} »`
          : 'Aucun nom lu sur l’étiquette'
      }
      submitLabel={submitLabel}
      submitDisabled={selectedId === undefined}
    >
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
    </VerifyFrame>
  );
}

/** A number the scanner proposes for the parcel. */
export type TrackingChoice = {
  value: string;
  /** The carrier its format names: "UPS". */
  carrier?: string;
};

export type VerifierSuiviScreenProps = Pick<
  VerifierColisScreenProps,
  | 'step'
  | 'label'
  | 'photo'
  | 'fields'
  | 'onBack'
  | 'onSkip'
  | 'onZoom'
  | 'onSubmit'
  | 'source'
> & {
  /**
   * `to-verify`: the number read, offered first and chosen, so one tap
   * confirms it; `none`: nothing sure enough, the agent picks.
   */
  level: 'to-verify' | 'none';
  choices: TrackingChoice[];
  selected?: string;
  submitLabel?: string;
  onSelect?: (value: string) => void;
};

/**
 * The tracking step (§4.4): a number « à vérifier » comes chosen, checked
 * against the photo and confirmed in one tap; below 0,60 the best readings
 * are offered and the agent picks the one printed.
 */
export function VerifierSuiviScreen({
  level,
  choices,
  selected,
  submitLabel = 'Valider et suivant',
  onSelect,
  ...frame
}: VerifierSuiviScreenProps) {
  return (
    <VerifyFrame
      {...frame}
      question={
        level === 'to-verify'
          ? 'Ce numéro de suivi est-il le bon ?'
          : 'Quel est le numéro de suivi ?'
      }
      hint={
        level === 'to-verify'
          ? 'Lu sur l’étiquette, à comparer avec la photo'
          : choices.length > 0
            ? 'Aucune lecture sûre : choisissez le numéro imprimé'
            : 'Aucun numéro lu sur l’étiquette'
      }
      submitLabel={submitLabel}
      submitDisabled={selected === undefined}
    >
      {choices.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Numéro de suivi"
          className="mt-[18px] flex flex-col gap-2.5"
        >
          {choices.map((choice) => {
            const on = choice.value === selected;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSelect?.(choice.value)}
                className={cn(
                  'flex h-16 w-full cursor-pointer items-center gap-3 rounded-card pr-3 pl-4 text-left',
                  'outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
                  on ? 'bg-surface ring-2 ring-ink ring-inset' : 'bg-fill',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-17 text-ink">
                    {choice.value}
                  </span>
                  {choice.carrier && (
                    <span className="mt-0.5 truncate text-14 text-muted">
                      {choice.carrier}
                    </span>
                  )}
                </span>
                <CheckCircle checked={on} />
              </button>
            );
          })}
        </div>
      )}
    </VerifyFrame>
  );
}

export type VerifierChampScreenProps = Pick<
  VerifierColisScreenProps,
  | 'step'
  | 'label'
  | 'photo'
  | 'fields'
  | 'onBack'
  | 'onSkip'
  | 'onZoom'
  | 'onSubmit'
  | 'source'
> & {
  /** « Le poids est-il juste ? » */
  question: string;
  /** The field's name above the box: « Poids ». */
  fieldLabel: string;
  /** The value as read, quoted under the question. */
  read: string;
  value: string;
  onChange?: (value: string) => void;
  /** Shown after the box: « kg ». */
  unit?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  /** Why the value typed cannot be kept: « Poids entre 0,01 et 70 kg ». */
  error?: string;
  /** « Garder » while the value is the one read, « Corriger » once changed. */
  submitLabel: string;
  submitDisabled?: boolean;
};

/**
 * An annex field « à vérifier » (§4.4: weight, n/N, service, reference),
 * after the number and the recipient: prefilled with what was read, kept in
 * one tap or corrected in the box.
 */
export function VerifierChampScreen({
  question,
  fieldLabel,
  read,
  value,
  onChange,
  unit,
  inputMode = 'text',
  error,
  ...frame
}: VerifierChampScreenProps) {
  return (
    <VerifyFrame
      {...frame}
      question={question}
      hint={`Lu sur l’étiquette : « ${read} »`}
    >
      <Field
        label={fieldLabel}
        help={error}
        helpTone="red"
        className="mt-[18px]"
      >
        {(id) => (
          <FieldInput
            id={id}
            value={value}
            inputMode={inputMode}
            enterKeyHint="done"
            autoComplete="off"
            onChange={(event) => onChange?.(event.target.value)}
            trailing={
              unit && <span className="text-17 text-muted">{unit}</span>
            }
          />
        )}
      </Field>
    </VerifyFrame>
  );
}
