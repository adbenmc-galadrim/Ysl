import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { Checkbox } from '#components/checkbox';
import { Field, FieldInput } from '#components/field';
import { OptionCard, OptionCardGroup } from '#components/option-card';
import { Sheet } from '#components/sheet';
import { Icon } from '#icons';

export type ContactWay = 'email' | 'contact' | 'voice';

export type NotifyWaySheetProps = {
  recipient: string;
  /** Under the title: why the sheet opened. */
  description?: string;
  way: ContactWay;
  onWayChange?: (way: ContactWay) => void;
  /** "Ajouter son e-mail": the address typed, checked as it is typed. */
  email?: {
    value: string;
    onValueChange?: (value: string) => void;
    valid?: boolean;
    /** Under the field, in red: why the address cannot be used. */
    error?: string;
  };
  /** "Prévenir un contact": who gets the mail, once chosen. */
  relay?: {
    name?: string;
    /** Their address, or why they cannot be written to. */
    detail?: string;
    detailTone?: 'muted' | 'red';
    chooseLabel: string;
    onChoose?: () => void;
    /** "Il viendra le chercher": the contact collects it for them. */
    collects?: boolean;
    onCollectsChange?: (checked: boolean) => void;
    collectsLabel?: string;
  };
  /** "De vive voix": what telling them does, said before the tap. */
  voiceNote?: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
  /** Over the button, in red: the last try failed. */
  error?: string;
  onDismiss?: () => void;
  /** Over the viewport, as the app mounts its sheets. */
  fixed?: boolean;
  /** The screen the sheet was opened from, dimmed behind it. */
  behind?: ReactNode;
  className?: string;
};

/**
 * Telling someone the directory has no e-mail for (YSL-72). Rather than block
 * the round, the agent picks another way on the spot: typing an address is
 * first because it also serves the next parcel; a colleague or an
 * assistant can pass the word on; or the agent tells them and gives the
 * pickup code.
 */
export function NotifyWaySheet({
  recipient,
  description = `${recipient} n’a pas d’adresse e-mail dans l’annuaire.`,
  way,
  onWayChange,
  email,
  relay,
  voiceNote,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  error,
  onDismiss,
  fixed,
  behind,
  className,
}: NotifyWaySheetProps) {
  return (
    <Sheet
      fixed={fixed}
      behind={behind}
      title="Comment le prévenir ?"
      description={description}
      className={className}
      onDismiss={onDismiss}
    >
      <OptionCardGroup label="Comment le prévenir ?" className="mt-[22px]">
        <OptionCard
          icon="mail"
          title="Ajouter son e-mail"
          description="Il recevra le QR code et le code"
          selected={way === 'email'}
          onClick={() => onWayChange?.('email')}
        />
        <OptionCard
          icon="users"
          title="Prévenir un contact"
          description="Par exemple l’assistante du service"
          selected={way === 'contact'}
          onClick={() => onWayChange?.('contact')}
        />
        <OptionCard
          icon="info"
          title="Le prévenir de vive voix"
          description="Vous lui donnez son code de retrait"
          selected={way === 'voice'}
          onClick={() => onWayChange?.('voice')}
        />
      </OptionCardGroup>
      {way === 'email' && email && (
        <Field
          label="Adresse e-mail"
          help={email.error}
          helpTone="red"
          className="mt-5"
        >
          {(id) => (
            <FieldInput
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              variant="outline"
              placeholder="prenom.nom@exemple.fr"
              {...(email.onValueChange
                ? {
                    value: email.value,
                    onChange: (event) =>
                      email.onValueChange?.(event.target.value),
                  }
                : { defaultValue: email.value })}
              trailing={
                email.valid &&
                !email.error && (
                  <Icon
                    name="check"
                    size={20}
                    className="shrink-0 text-green"
                  />
                )
              }
            />
          )}
        </Field>
      )}
      {way === 'contact' && relay && (
        <>
          <button
            type="button"
            onClick={relay.onChoose}
            className="mt-5 flex min-h-[52px] w-full items-center gap-3 rounded-control bg-fill px-4 py-2.5 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-16 font-semibold">
                {relay.name ?? relay.chooseLabel}
              </span>
              {relay.name && relay.detail && (
                <span
                  className={
                    relay.detailTone === 'red'
                      ? 'truncate text-13 text-red'
                      : 'truncate text-13 text-muted'
                  }
                >
                  {relay.detail}
                </span>
              )}
            </span>
            <Icon name="chevron" size={18} className="shrink-0 text-muted" />
          </button>
          {relay.name && relay.collectsLabel && (
            <div className="mt-3 flex h-[52px] items-center gap-2.5 rounded-control bg-fill px-3 text-15">
              <Checkbox
                checked={relay.collects ?? false}
                onCheckedChange={relay.onCollectsChange}
                label={relay.collectsLabel}
              />
              <span aria-hidden="true">{relay.collectsLabel}</span>
            </div>
          )}
        </>
      )}
      {way === 'voice' && voiceNote && (
        <p className="mt-5 px-1 text-15 leading-[1.4] text-muted">
          {voiceNote}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-15 leading-[1.35] text-red">
          {error}
        </p>
      )}
      <Button
        block
        className="mt-[60px]"
        disabled={confirmDisabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </Sheet>
  );
}
