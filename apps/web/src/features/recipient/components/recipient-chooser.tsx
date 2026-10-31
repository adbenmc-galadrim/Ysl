import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  ChoisirDestinataireScreen,
  HorsAnnuaireSheet,
  type OutsideContactDraft,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { type ReactNode, useRef, useState } from 'react';
import { db } from '#/features/db/database';
import {
  isEmail,
  NO_DEPARTMENT_NAMES,
  normalizeEmail,
} from '#/features/directory/people';
import { loadRecipientBook } from '#/features/parcels/recipients';
import { outsideDuplicate } from '#/features/recipient/contacts';
import {
  type Choice,
  optionOf,
  recentOptions,
  searchOptions,
} from '#/features/recipient/options';

const t = createTranslator(DEFAULT_LOCALE);

/** What « Choisir le destinataire » hands back: a card, or someone typed outside the directory. */
export type RecipientPick =
  | { kind: 'card'; choice: Choice }
  | { kind: 'typed'; name: string; email: string; department: string };

export type RecipientChooserProps = {
  /** The cards the label points to, learned and matched, before any search. */
  suggestions?: readonly Choice[];
  /** Prefills the name of « Personne hors annuaire »: the name read on the label. */
  readName?: string | null;
  /** Awaited: the sheet stays locked while a typed contact is saved. */
  onPick: (pick: RecipientPick) => void | Promise<unknown>;
  onClose: () => void;
  /** Under the list, e.g. « Retirer le destinataire ». */
  footer?: ReactNode;
};

/**
 * « Choisir le destinataire » (F18, F27), wherever a parcel needs someone:
 * the batch review, the parcel's record, the « Choisir » of Colis. The
 * label's suggestions head it; the search runs over the directory and the
 * contacts as the letters come, accents aside; the recent recipients
 * follow; someone outside both is typed on a sheet, the e-mail a key that
 * never makes a second contact.
 */
export function RecipientChooser({
  suggestions = [],
  readName,
  onPick,
  onClose,
  footer,
}: RecipientChooserProps) {
  const book = useLiveQuery(() => loadRecipientBook(db), []);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState<OutsideContactDraft | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [saving, setSaving] = useState(false);
  const picking = useRef(false);
  const people = book?.people ?? [];
  const contacts = book?.contacts ?? [];
  const names = book?.names ?? NO_DEPARTMENT_NAMES;
  const searching = query.trim() !== '';
  const duplicate = typing
    ? outsideDuplicate(typing.email, people, contacts)
    : null;

  // One answer per chooser: a double tap must not save the same contact twice.
  const answer = async (picked: RecipientPick) => {
    if (picking.current) return;
    picking.current = true;
    setSaving(true);
    try {
      await onPick(picked);
    } finally {
      picking.current = false;
      setSaving(false);
    }
  };

  const pick = (id: string) => {
    const choice =
      suggestions.find((option) => option.id === id) ??
      optionOf('person', id, people, contacts, names) ??
      optionOf('contact', id, people, contacts);
    if (choice) void answer({ kind: 'card', choice });
  };

  const submit = () => {
    if (!typing?.name.trim()) return;
    const email = normalizeEmail(typing.email);
    if (email && !isEmail(email)) {
      setEmailError(true);
      return;
    }
    void answer({
      kind: 'typed',
      name: typing.name.trim().replace(/\s+/g, ' '),
      email,
      department: typing.department.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <ChoisirDestinataireScreen
        query={query}
        onQueryChange={setQuery}
        results={
          searching
            ? searchOptions(people, contacts, query, names)
            : [...suggestions]
        }
        resultsTitle={searching ? undefined : t('recipient.suggestions')}
        recents={
          searching
            ? []
            : recentOptions(book?.latest ?? [], people, contacts, 3, names)
        }
        onClose={onClose}
        onPick={pick}
        onOutside={() => {
          setEmailError(false);
          setTyping({
            name: searching ? query.trim() : (readName ?? ''),
            email: '',
            department: '',
          });
        }}
        footer={footer}
      />
      {typing && (
        <HorsAnnuaireSheet
          fixed
          value={typing}
          onChange={(value) => {
            setEmailError(false);
            setTyping(value);
          }}
          emailError={emailError ? t('edit.error.emailInvalid') : undefined}
          duplicate={duplicate}
          saving={saving}
          onUseDuplicate={
            duplicate
              ? () => void answer({ kind: 'card', choice: duplicate })
              : undefined
          }
          onSubmit={submit}
          onDismiss={() => setTyping(null)}
        />
      )}
    </div>
  );
}
