import type { ReactNode } from 'react';

import { Button, buttonVariants } from '#components/button';
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
  /** A copy of the mail for someone who may collect (YSL-84); no row without it. */
  onCopy?: () => void;
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
  onCopy,
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
    ...(onCopy
      ? [
          {
            icon: 'mail' as const,
            tone: 'blue' as const,
            title: 'Envoyer une copie à un collègue',
            line: 'Même QR et même code de retrait',
            onClick: onCopy,
          },
        ]
      : []),
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
  /** In red under the parcels: the answer could not be written. */
  error?: string;
  onPick?: (parcel: ReplyParcel) => void;
};

/** The e-mail named several parcels: which one is not theirs. */
export function ColisPasPourMoiSheet({
  recipient,
  parcels,
  error,
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
      {error && <p className="mt-3 text-13 text-red">{error}</p>}
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

export type CopieCollegueSheetProps = SheetFrame & {
  /** Whose parcels: « Nora Haddad ». */
  recipient: string;
  /** Who gets the copy: « Paul Mercier ». */
  name: string;
  address: string;
  onAddressChange?: (value: string) => void;
  /** Under the field: what the copy carries, or why it did not leave. */
  help: string;
  error?: string;
  valid: boolean;
  sending?: boolean;
  /** The mail app's link, with the server's sending off: a real `<a href>`. */
  draftHref?: string;
  onSend?: () => void;
  onSkip?: () => void;
};

/** « Envoyer une copie »: the mail the recipient got, to whoever collects instead. */
export function CopieCollegueSheet({
  recipient,
  name,
  address,
  onAddressChange,
  help,
  error,
  valid,
  sending,
  draftHref,
  onSend,
  onSkip,
  onDismiss,
  fixed,
  behind,
}: CopieCollegueSheetProps) {
  return (
    <Sheet
      fixed={fixed}
      behind={behind}
      title={`Envoyer une copie à ${name}`}
      description={`${name} pourra retirer les colis de ${recipient}.`}
      className={FRAME}
      onDismiss={onDismiss}
    >
      <Field
        label="Adresse e-mail"
        help={error ?? help}
        helpTone={error ? 'red' : 'muted'}
        className="mt-5"
      >
        {(id) => (
          <FieldInput
            id={id}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={address}
            onChange={(event) => onAddressChange?.(event.target.value)}
          />
        )}
      </Field>
      {draftHref && valid ? (
        <a
          href={draftHref}
          onClick={onSend}
          className={buttonVariants({ block: true, class: 'mt-6' })}
        >
          Ouvrir dans ma messagerie
        </a>
      ) : (
        <Button
          block
          className="mt-6"
          disabled={!valid || sending}
          onClick={onSend}
        >
          Envoyer la copie
        </Button>
      )}
      <Button variant="secondary" block className="mt-3" onClick={onSkip}>
        Pas de copie
      </Button>
    </Sheet>
  );
}
