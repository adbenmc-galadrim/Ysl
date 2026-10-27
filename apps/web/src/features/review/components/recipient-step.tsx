import { type RecipientResult, SUGGESTIONS } from '@repo/contract/recipient';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ChoisirDestinataireScreen, VerifierColisScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { updateDraft } from '#/features/batch/store';
import { db } from '#/features/db/database';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { PersonSheet } from '#/features/directory/components/person-sheet';
import { draftFromQuery } from '#/features/directory/people';
import {
  nameLine,
  preselection,
  readsOf,
  textOf,
  toRecipient,
} from '#/features/recipient/check';
import type { MatchEngine } from '#/features/recipient/matcher';
import {
  type Choice,
  optionOf,
  personOption,
  recentOptions,
  searchOptions,
} from '#/features/recipient/options';
import type { StepProps } from '#/features/review/components/step';
import { checkFields } from '#/features/scan/reading';

const t = createTranslator(DEFAULT_LOCALE);

const NO_PARCELS: LocalParcel[] = [];

type Sheet = { initial: string; key: number };

type RecipientStepProps = StepProps & {
  matcher: MatchEngine;
  people: readonly LocalDirectoryPerson[];
  contacts: readonly LocalContact[];
};

/**
 * Who the parcel is for (F18): the three closest people of YSL-46, the
 * directory one tap away, a new card from the name read. The card chosen
 * settles the recipient, which F26 needs to notify.
 */
export function RecipientStep({
  draft,
  matcher,
  people,
  contacts,
  photo,
  submitLabel,
  ...frame
}: RecipientStepProps) {
  const [result, setResult] = useState<RecipientResult | null>(null);
  const [chosen, setChosen] = useState<Choice>();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const submitting = useRef(false);
  const parcels = useLiveQuery(
    () => (picking ? db.parcel.toArray() : NO_PARCELS),
    [picking],
    NO_PARCELS,
  );

  const { readName, ocrName, symbols } = draft;
  const text = textOf(draft);
  useEffect(() => {
    let current = true;
    void matcher
      .match(readsOf({ readName, ocrName, symbols }), text)
      .then((found) => {
        if (current) setResult(found);
      });
    return () => {
      current = false;
    };
  }, [matcher, readName, ocrName, symbols, text, people, contacts]);

  if (!result) return null;

  const suggestions = result.suggestions
    .map(({ entry }) => optionOf(entry.kind, entry.id, people, contacts))
    .filter((option): option is Choice => option !== null);
  const preselected = preselection(draft, result);
  const selected =
    chosen ??
    (preselected
      ? (optionOf(preselected.kind, preselected.id, people, contacts) ??
        undefined)
      : undefined);
  const candidates =
    selected && !suggestions.some((option) => option.id === selected.id)
      ? [selected, ...suggestions].slice(0, SUGGESTIONS)
      : suggestions;
  const shownName = result.readName ?? readName ?? ocrName;
  const line = nameLine(draft.ocrLines, ocrName ?? readName);

  const onSubmit = async () => {
    if (!selected || submitting.current) return;
    submitting.current = true;
    try {
      await updateDraft(db, draft.id, {
        recipient: toRecipient(selected, 'agent'),
      });
    } finally {
      submitting.current = false;
    }
  };

  const openSheet = (initial: string) =>
    setSheet((previous) => ({ initial, key: (previous?.key ?? 0) + 1 }));

  const onPerson = (person: LocalDirectoryPerson) => {
    setChosen(personOption(person));
    setSheet(null);
    setPicking(false);
    setQuery('');
  };

  return (
    <>
      {picking ? (
        <ChoisirDestinataireScreen
          query={query}
          onQueryChange={setQuery}
          results={
            query.trim() ? searchOptions(people, contacts, query) : suggestions
          }
          resultsTitle={query.trim() ? undefined : t('recipient.suggestions')}
          recents={recentOptions(parcels, people, contacts)}
          onClose={() => {
            setPicking(false);
            setQuery('');
          }}
          onPick={(id) => {
            const option =
              optionOf('person', id, people, contacts) ??
              optionOf('contact', id, people, contacts);
            if (option) setChosen(option);
            setPicking(false);
            setQuery('');
          }}
          onOutside={() => openSheet(query.trim() || shownName || '')}
        />
      ) : (
        <VerifierColisScreen
          {...frame}
          photo={photo && { ...photo, focus: line?.box ?? photo.focus }}
          readName={shownName}
          candidates={candidates}
          selectedId={selected?.id}
          fields={checkFields(draft, t)}
          addPerson={{
            name: shownName,
            onClick: () => openSheet(shownName ?? ''),
          }}
          submitLabel={submitLabel}
          onSelect={(id) => {
            const option = candidates.find((c) => c.id === id);
            if (option) setChosen(option);
          }}
          onSearch={() => setPicking(true)}
          onSubmit={() => void onSubmit()}
        />
      )}
      {sheet && (
        <PersonSheet
          key={sheet.key}
          initial={draftFromQuery(sheet.initial)}
          onDone={onPerson}
          onDismiss={() => setSheet(null)}
        />
      )}
    </>
  );
}
