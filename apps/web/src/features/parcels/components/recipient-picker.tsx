import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  ChoisirDestinataireScreen,
  Field,
  FieldInput,
  Sheet,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '#/features/db/database';
import type { RecipientChoice } from '#/features/parcels/edit';
import { loadRecipientBook } from '#/features/parcels/recipients';
import {
  type Choice,
  optionOf,
  recentOptions,
  searchOptions,
} from '#/features/recipient/options';

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

const labelOf = (option: Choice) =>
  option.detail && option.kind === 'person'
    ? `${option.name}, ${option.detail}`
    : option.name;

/**
 * Who the parcel is for, on « Choisir le destinataire »: the directory and
 * the contacts this mailroom already typed, or a name typed by hand for
 * someone outside both — a temp, a visitor —, with an e-mail if known.
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
  const people = book?.people ?? [];
  const contacts = book?.contacts ?? [];
  const searching = query.trim() !== '';

  return (
    <div className="fixed inset-0 z-50">
      <ChoisirDestinataireScreen
        query={query}
        onQueryChange={setQuery}
        results={searching ? searchOptions(people, contacts, query) : []}
        recents={
          searching ? [] : recentOptions(book?.latest ?? [], people, contacts)
        }
        onClose={onClose}
        onPick={(id) => {
          const option =
            optionOf('person', id, people, contacts) ??
            optionOf('contact', id, people, contacts);
          if (option) {
            onPick({
              choice: { kind: option.kind, id: option.id },
              label: labelOf(option),
            });
          }
        }}
        onOutside={() =>
          setTyping({
            name: searching ? query.trim() : (readName ?? ''),
            email: '',
          })
        }
        footer={
          onClear && (
            <Button
              variant="link"
              onClick={onClear}
              className="mt-5 self-center text-16 font-semibold text-red"
            >
              {t('edit.recipient.clear')}
            </Button>
          )
        }
      />
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
