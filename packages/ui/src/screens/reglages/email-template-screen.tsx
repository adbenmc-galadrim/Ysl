import { useRef, type ReactNode } from 'react';

import { Banner } from '#components/banner';
import { buttonVariants } from '#components/button';
import {
  GroupedFootnote,
  GroupedRow,
  GroupedSection,
} from '#components/grouped-list';
import { NavBarAction } from '#components/nav-bar';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import { SettingsScreen } from '#screens/reglages/settings-screen';

export type TemplateVariable = { name: string; hint: string };

export type TemplateWarning = { title: string; description?: ReactNode };

export type EmailTemplateScreenProps = {
  name: string;
  /** What the template is for, said under its name: a notice, a reminder. */
  typeNote?: string;
  subject: string;
  body: string;
  onNameChange?: (name: string) => void;
  onSubjectChange?: (subject: string) => void;
  onBodyChange?: (body: string) => void;
  /** The closed list, shown under the editor; a tap types one where the caret is. */
  variables: TemplateVariable[];
  /** What the agent should know before sending: an unknown variable, a body too long. */
  warnings?: TemplateWarning[];
  /** The template rendered on the sample parcel. */
  preview: { subject: string; body: string };
  previewNote?: string;
  /** The `mailto:` that opens the preview in the mail app, to oneself. */
  tryHref?: string;
  onTry?: () => void;
  onDuplicate?: () => void;
  /** The template every mail starts from: said, and offered for any other. */
  isDefault?: boolean;
  onMakeDefault?: () => void;
  /** The template the app ships with: back to its text. */
  onRestore?: () => void;
  /** Neither the default one nor the shipped one. */
  onDelete?: () => void;
  error?: string;
  nameMaxLength?: number;
  subjectMaxLength?: number;
  bodyMaxLength?: number;
  onBack?: () => void;
  onDone?: () => void;
};

const input =
  'min-w-0 bg-transparent text-16 outline-none placeholder:text-faint';

type Field = 'subject' | 'body';

/**
 * One template, typed in place: the object, the body, the variables to tap
 * in, and the mail as it will read, rendered on a sample parcel. Plain text
 * only, as `mailto:` carries nothing else (S5).
 */
export function EmailTemplateScreen({
  name,
  typeNote,
  subject,
  body,
  onNameChange,
  onSubjectChange,
  onBodyChange,
  variables,
  warnings = [],
  preview,
  previewNote,
  tryHref,
  onTry,
  onDuplicate,
  isDefault,
  onMakeDefault,
  onRestore,
  onDelete,
  error,
  nameMaxLength,
  subjectMaxLength,
  bodyMaxLength,
  onBack,
  onDone,
}: EmailTemplateScreenProps) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<Field>('body');

  const insert = (variable: string) => {
    const field = lastField.current;
    const element = field === 'subject' ? subjectRef.current : bodyRef.current;
    const value = field === 'subject' ? subject : body;
    const change = field === 'subject' ? onSubjectChange : onBodyChange;
    if (!change) return;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const token = `{${variable}}`;
    change(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <SettingsScreen
      title="Modèle"
      onBack={onBack}
      trailing={onDone && <NavBarAction onClick={onDone}>OK</NavBarAction>}
      className="mt-4"
    >
      <GroupedSection header="Nom" footer={typeNote}>
        <div className="flex h-[52px] px-4">
          <input
            aria-label="Nom du modèle"
            value={name}
            maxLength={nameMaxLength}
            readOnly={!onNameChange}
            placeholder="Premier avis, relance…"
            onChange={(event) => onNameChange?.(event.target.value)}
            className={cn(input, 'mb-[3px] flex-1 text-ink')}
          />
        </div>
      </GroupedSection>
      <GroupedSection header="Objet">
        <div className="flex h-[52px] px-4">
          <input
            ref={subjectRef}
            aria-label="Objet"
            value={subject}
            maxLength={subjectMaxLength}
            readOnly={!onSubjectChange}
            placeholder="Des colis vous attendent"
            onFocus={() => (lastField.current = 'subject')}
            onChange={(event) => onSubjectChange?.(event.target.value)}
            className={cn(input, 'mb-[3px] flex-1 text-ink')}
          />
        </div>
      </GroupedSection>
      <GroupedSection header="Message">
        <textarea
          ref={bodyRef}
          aria-label="Message"
          value={body}
          maxLength={bodyMaxLength}
          rows={12}
          readOnly={!onBodyChange}
          placeholder="Bonjour {prénom},"
          onFocus={() => (lastField.current = 'body')}
          onChange={(event) => onBodyChange?.(event.target.value)}
          className={cn(
            input,
            'block w-full resize-none px-4 py-3.5 leading-[1.35] text-ink',
          )}
        />
      </GroupedSection>
      <section aria-label="Variables" className="-mt-2 flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2 px-1">
          {variables.map((variable) => (
            <button
              key={variable.name}
              type="button"
              title={variable.hint}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => insert(variable.name)}
              className={buttonVariants({
                variant: 'outline',
                size: 'xs',
                class: 'font-medium',
              })}
            >
              {`{${variable.name}}`}
            </button>
          ))}
        </div>
        <GroupedFootnote>
          Touchez une variable pour l’insérer. Elle prend la valeur de chaque
          destinataire ; une variable inconnue reste telle quelle dans l’e-mail.
        </GroupedFootnote>
      </section>
      {warnings.map((warning) => (
        <Banner
          key={warning.title}
          tone="orange"
          icon="alert"
          title={warning.title}
          description={warning.description}
        />
      ))}
      <GroupedSection header="Aperçu" footer={previewNote}>
        <div className="flex flex-col px-4 pt-3.5 pb-4">
          <span className="text-13 text-muted">Objet</span>
          <span className="mt-0.5 text-16 font-semibold break-words text-ink">
            {preview.subject || '—'}
          </span>
          <span className="my-3 h-px bg-separator" />
          <p className="text-15 leading-[1.4] break-words whitespace-pre-wrap text-ink">
            {preview.body || '—'}
          </p>
        </div>
      </GroupedSection>
      {tryHref && (
        <a
          href={tryHref}
          onClick={onTry}
          className={buttonVariants({
            variant: 'primary',
            size: 'lg',
            block: true,
          })}
        >
          M’envoyer un essai
        </a>
      )}
      {(isDefault || onMakeDefault) && (
        <GroupedSection
          footer={
            isDefault
              ? 'Chaque e-mail part de ce modèle ; vous pouvez en choisir un autre au moment d’envoyer.'
              : undefined
          }
        >
          {isDefault ? (
            <GroupedRow
              title="Modèle par défaut"
              selected
              accessory={
                <Icon
                  name="tick"
                  size={20}
                  strokeWidth={2.4}
                  className="text-blue"
                />
              }
            />
          ) : (
            <GroupedRow title="Utiliser par défaut" onClick={onMakeDefault} />
          )}
        </GroupedSection>
      )}
      {(onDuplicate || onRestore || onDelete) && (
        <GroupedSection>
          {onDuplicate && (
            <GroupedRow title="Dupliquer le modèle" onClick={onDuplicate} />
          )}
          {onRestore && (
            <GroupedRow
              title="Rétablir le texte d’origine"
              onClick={onRestore}
            />
          )}
          {onDelete && (
            <GroupedRow
              title={<span className="text-red">Supprimer le modèle</span>}
              onClick={onDelete}
            />
          )}
        </GroupedSection>
      )}
      {error && (
        <p role="alert" className="px-4 text-13 leading-[1.4] text-red">
          {error}
        </p>
      )}
    </SettingsScreen>
  );
}
