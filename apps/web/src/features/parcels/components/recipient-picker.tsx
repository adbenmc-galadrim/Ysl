import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Avatar,
  Button,
  Field,
  FieldInput,
  Icon,
  IconButton,
  ListRow,
  NavBar,
  Screen,
  SearchField,
  SectionHeader,
  Sheet,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '#/features/db/database';
import type { RecipientChoice } from '#/features/parcels/edit';
import {
  loadRecipientBook,
  pickRecipients,
  type RecipientOption,
} from '#/features/parcels/recipients';

const t = createTranslator(DEFAULT_LOCALE);

export type PickedRecipient = {
  choice: RecipientChoice;
  /** How the form's field names it: "Camille Morel, Studio". */
  label: string;
};

export type RecipientPickerProps = {
  /** Prefills the hand-typed name: the name read on the label. */
  readName?: string | null;
  onPick: (picked: PickedRecipient) => void;
  /** "Retirer le destinataire", offered while one is chosen. */
  onClear?: () => void;
  onClose: () => void;
};

const labelOf = (option: RecipientOption) =>
  option.detail ? `${option.name}, ${option.detail}` : option.name;

function rows(
  options: RecipientOption[],
  withEmail: boolean,
  onPick: (option: RecipientOption) => void,
) {
  return options.map((option, i) => (
    <ListRow
      key={`${option.choice.kind}:${option.choice.id}`}
      align="center"
      leading={<Avatar initials={option.initials} tone="fill" />}
      title={option.name}
      lines={[
        ...(option.detail ? [{ text: option.detail }] : []),
        ...(withEmail && option.email ? [{ text: option.email }] : []),
      ]}
      separator={i < options.length - 1}
      onClick={() => onPick(option)}
    />
  ));
}

/**
 * Who the parcel is for, picked from the directory and the contacts this
 * mailroom already typed, or typed by hand for someone outside both — a
 * temp, a visitor. Drawn after « Choisir le destinataire » (04 · Réception).
 */
export function RecipientPicker({
  readName,
  onPick,
  onClear,
  onClose,
}: RecipientPickerProps) {
  const book = useLiveQuery(() => loadRecipientBook(db), []);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState<{ name: string; email: string } | null>(
    null,
  );
  const { results, recents } = useMemo(
    () => (book ? pickRecipients(book, query) : { results: [], recents: [] }),
    [book, query],
  );
  const searching = query.trim() !== '';
  const pick = (option: RecipientOption) =>
    onPick({ choice: option.choice, label: labelOf(option) });

  return (
    <div className="fixed inset-0 z-50">
      <Screen>
        <NavBar
          title={t('edit.recipient.title')}
          leading={
            <IconButton
              icon="x"
              label={t('edit.recipient.close')}
              size="lg"
              iconSize={22}
              onClick={onClose}
              className="-ml-0.5"
            />
          }
        />
        <SearchField
          size="form"
          className="mt-3"
          placeholder={t('edit.recipient.search')}
          value={query}
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
        />
        {results.length > 0 && (
          <section className="mt-6">
            <SectionHeader
              title={t('edit.recipient.results')}
              count={results.length}
            />
            <div className="mt-[13px]">{rows(results, true, pick)}</div>
          </section>
        )}
        {searching && book && results.length === 0 && (
          <p className="mt-6 text-15 text-muted">
            {t('edit.recipient.none', { query: query.trim() })}
          </p>
        )}
        {recents.length > 0 && (
          <section className="mt-[22px]">
            <SectionHeader title={t('edit.recipient.recents')} />
            <div className="mt-[13px]">{rows(recents, false, pick)}</div>
          </section>
        )}
        <button
          type="button"
          onClick={() =>
            setTyping({
              name: searching ? query.trim() : (readName ?? ''),
              email: '',
            })
          }
          className="mt-5 flex h-16 cursor-pointer items-center gap-[15px] rounded-card border border-dashed border-border pb-0.5 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <Icon name="user" size={22} className="shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-16 font-semibold">
              {t('edit.recipient.outside')}
            </span>
            <span className="mt-[3px] truncate text-13 text-muted">
              {t('edit.recipient.outsideDetail')}
            </span>
          </span>
        </button>
        {onClear && (
          <Button
            variant="link"
            onClick={onClear}
            className="mt-5 self-center text-16 font-semibold text-red"
          >
            {t('edit.recipient.clear')}
          </Button>
        )}
      </Screen>
      {typing && (
        <Sheet
          fixed
          title={t('edit.recipient.outside')}
          description={t('edit.recipient.outsideDetail')}
          className="pb-[calc(var(--safe-bottom)+16px)]"
          onDismiss={() => setTyping(null)}
        >
          <Field label={t('edit.recipient.name')} className="mt-5">
            {(id) => (
              <FieldInput
                id={id}
                value={typing.name}
                autoComplete="off"
                onChange={(event) =>
                  setTyping({ ...typing, name: event.target.value })
                }
              />
            )}
          </Field>
          <Field label={t('edit.recipient.email')} className="mt-4">
            {(id) => (
              <FieldInput
                id={id}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={typing.email}
                onChange={(event) =>
                  setTyping({ ...typing, email: event.target.value })
                }
              />
            )}
          </Field>
          <Button
            block
            className="mt-6"
            disabled={!typing.name.trim()}
            onClick={() =>
              onPick({
                choice: {
                  kind: 'typed',
                  name: typing.name.trim(),
                  email: typing.email.trim(),
                },
                label: typing.name.trim(),
              })
            }
          >
            {t('edit.recipient.use')}
          </Button>
        </Sheet>
      )}
    </div>
  );
}
