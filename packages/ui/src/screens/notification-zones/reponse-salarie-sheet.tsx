import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { Field, FieldInput } from '#components/field';
import { IconTile } from '#components/icon-tile';
import { ListRow } from '#components/list-row';
import { Sheet } from '#components/sheet';

type SheetFrame = {
  onDismiss?: () => void;
  /** Over the viewport, as the app mounts its sheets. */
  fixed?: boolean;
  /** The screen the sheet was opened from, dimmed behind it. */
  behind?: ReactNode;
};

const FRAME = 'pb-[calc(var(--safe-bottom)+16px)]';

export type ReponseSalarieSheetProps = SheetFrame & {
  /** Who answered: « Hugo Lefèvre ». */
  recipient: string;
  /** What the e-mail was about: « DHL ···7112 », « 2 colis ». */
  about: string;
  /** In red under the choices: the answer could not be written. */
  error?: string;
  onNotMine?: () => void;
  onColleague?: () => void;
  onAbsent?: () => void;
};

/**
 * « Le salarié a répondu » (zone d'ombre, YSL-70): the app reads no mail
 * (D2), so the agent reports in two taps what the recipient answered in
 * their mailbox. Each choice says what it does to the parcel.
 */
export function ReponseSalarieSheet({
  recipient,
  about,
  error,
  onNotMine,
  onColleague,
  onAbsent,
  onDismiss,
  fixed,
  behind,
}: ReponseSalarieSheetProps) {
  const choices = [
    {
      icon: 'alert' as const,
      tone: 'red' as const,
      title: 'Ce n’est pas pour moi',
      line: 'Le colis repasse à compléter',
      onClick: onNotMine,
    },
    {
      icon: 'users' as const,
      tone: 'blue' as const,
      title: 'Un collègue passe le prendre',
      line: 'Son nom sera proposé à la remise',
      onClick: onColleague,
    },
    {
      icon: 'calendar' as const,
      tone: 'orange' as const,
      title: 'Absence jusqu’au …',
      line: 'Pas de relance avant son retour',
      onClick: onAbsent,
    },
  ];
  return (
    <Sheet
      fixed={fixed}
      behind={behind}
      title={`${recipient} a répondu`}
      description={`À l’e-mail pour ${about}. Que dit sa réponse ?`}
      className={FRAME}
      onDismiss={onDismiss}
    >
      <div className="mt-5">
        {choices.map((choice, i) => (
          <ListRow
            key={choice.title}
            align="center"
            leading={<IconTile icon={choice.icon} tone={choice.tone} />}
            title={choice.title}
            lines={[{ text: choice.line }]}
            separator={i < choices.length - 1}
            onClick={choice.onClick}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-13 text-red">{error}</p>}
      <Button variant="secondary" block className="mt-4" onClick={onDismiss}>
        Annuler
      </Button>
    </Sheet>
  );
}

export type ReplyParcel = { id: string; title: string; detail: string };

export type ColisPasPourMoiSheetProps = SheetFrame & {
  recipient: string;
  parcels: ReplyParcel[];
  onPick?: (parcel: ReplyParcel) => void;
};

/** The e-mail named several parcels: which one is not theirs. */
export function ColisPasPourMoiSheet({
  recipient,
  parcels,
  onPick,
  onDismiss,
  fixed,
  behind,
}: ColisPasPourMoiSheetProps) {
  return (
    <Sheet
      fixed={fixed}
      behind={behind}
      title="Quel colis n’est pas le sien ?"
      description={`Les colis de l’e-mail à ${recipient}.`}
      className={FRAME}
      onDismiss={onDismiss}
    >
      <div className="mt-5">
        {parcels.map((parcel, i) => (
          <ListRow
            key={parcel.id}
            align="center"
            leading={<IconTile icon="package" tone="fill" />}
            title={parcel.title}
            lines={[{ text: parcel.detail }]}
            separator={i < parcels.length - 1}
            onClick={onPick && (() => onPick(parcel))}
          />
        ))}
      </div>
      <Button variant="secondary" block className="mt-4" onClick={onDismiss}>
        Annuler
      </Button>
    </Sheet>
  );
}

export type AbsenceJusquauSheetProps = SheetFrame & {
  recipient: string;
  /** The last day away, `YYYY-MM-DD` as a date input holds it. */
  value: string;
  /** The first day that can be picked: today. */
  min: string;
  onValueChange?: (value: string) => void;
  /** Under the field: when the reminders start again. */
  help?: string;
  error?: string;
  saving?: boolean;
  onSave?: () => void;
};

/** « Absence jusqu'au … »: the last day away, picked on the iPhone's wheel. */
export function AbsenceJusquauSheet({
  recipient,
  value,
  min,
  onValueChange,
  help,
  error,
  saving,
  onSave,
  onDismiss,
  fixed,
  behind,
}: AbsenceJusquauSheetProps) {
  return (
    <Sheet
      fixed={fixed}
      behind={behind}
      title="Absence jusqu’au …"
      description={`${recipient} : aucune relance ne partira avant son retour.`}
      className={FRAME}
      onDismiss={onDismiss}
    >
      <Field
        label="Dernier jour d’absence"
        help={error ?? help}
        helpTone={error ? 'red' : 'muted'}
        className="mt-5"
      >
        {(id) => (
          <FieldInput
            id={id}
            type="date"
            value={value}
            min={min}
            onChange={(event) => onValueChange?.(event.target.value)}
          />
        )}
      </Field>
      <Button
        block
        className="mt-6"
        disabled={!value || saving}
        onClick={onSave}
      >
        Enregistrer
      </Button>
      <Button variant="secondary" block className="mt-3" onClick={onDismiss}>
        Annuler
      </Button>
    </Sheet>
  );
}
