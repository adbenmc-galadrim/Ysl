import { type RecipientResult, SUGGESTIONS } from '@repo/contract/recipient';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { VerifierColisScreen } from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { updateDraft } from '#/features/batch/store';
import { db } from '#/features/db/database';
import type { LocalContact, LocalDirectoryPerson } from '#/features/db/schema';
import { PersonSheet } from '#/features/directory/components/person-sheet';
import { draftFromQuery } from '#/features/directory/people';
import {
  nameLine,
  preselection,
  readsOf,
  textOf,
  toRecipient,
} from '#/features/recipient/check';
import {
  RecipientChooser,
  type RecipientPick,
} from '#/features/recipient/components/recipient-chooser';
import { saveOutsideContact } from '#/features/recipient/contacts';
import type { MatchEngine } from '#/features/recipient/matcher';
import {
  type Choice,
  optionOf,
  personOption,
} from '#/features/recipient/options';
import type { StepProps } from '#/features/review/components/step';
import { checkFields } from '#/features/scan/reading';

const t = createTranslator(DEFAULT_LOCALE);

type Sheet = { initial: string; key: number };

type RecipientStepProps = StepProps & {
  matcher: MatchEngine;
  people: readonly LocalDirectoryPerson[];
  contacts: readonly LocalContact[];
};

/**
 * Who the parcel is for (F18): the three closest people of YSL-46, then
 * « Chercher dans l'annuaire » for « Choisir le destinataire », where the
 * label's suggestions head the directory and someone outside it becomes a
 * contact (F27); a new card from the name read. The card chosen settles
 * the recipient, which F26 needs to notify.
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
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const submitting = useRef(false);
  const session = useSession();

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
  const learned = draft.learnedRecipient
    ? optionOf(
        draft.learnedRecipient.kind,
        draft.learnedRecipient.id,
        people,
        contacts,
      )
    : null;
  const first = [selected, learned].filter(
    (option, at, all): option is Choice =>
      option != null && all.findIndex((o) => o?.id === option.id) === at,
  );
  const candidates = [
    ...first,
    ...suggestions.filter((option) => !first.some((o) => o.id === option.id)),
  ].slice(0, SUGGESTIONS);
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
  };

  const onPick = async (pick: RecipientPick) => {
    if (pick.kind === 'card') {
      setChosen(pick.choice);
    } else {
      setChosen(
        await saveOutsideContact(db, pick, { agentId: session.user.id }),
      );
      if (pick.department) {
        await updateDraft(db, draft.id, { department: pick.department });
      }
    }
    setPicking(false);
  };

  return (
    <>
      {picking ? (
        <RecipientChooser
          suggestions={candidates}
          readName={shownName}
          onClose={() => setPicking(false)}
          onPick={(pick) => void onPick(pick)}
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
