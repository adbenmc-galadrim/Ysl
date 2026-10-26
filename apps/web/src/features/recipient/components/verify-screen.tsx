import { type RecipientResult, SUGGESTIONS } from '@repo/contract/recipient';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  ChoisirDestinataireScreen,
  IconButton,
  type ScanField,
  VerifierColisScreen,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { finishBatch, updateDraft } from '#/features/batch/store';
import { useBatch } from '#/features/batch/use-batch';
import { db } from '#/features/db/database';
import type {
  DraftParcel,
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
  LocalPhoto,
} from '#/features/db/schema';
import { PersonSheet } from '#/features/directory/components/person-sheet';
import { draftFromQuery } from '#/features/directory/people';
import { photoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';
import {
  nameLine,
  preselection,
  readsOf,
  settleRecipients,
  textOf,
  toRecipient,
} from '#/features/recipient/check';
import { recipientEntries } from '#/features/recipient/entries';
import { recipientMatcher } from '#/features/recipient/matcher';
import {
  type Choice,
  optionOf,
  personOption,
  recentOptions,
  searchOptions,
} from '#/features/recipient/options';

const t = createTranslator(DEFAULT_LOCALE);

const NO_PEOPLE: LocalDirectoryPerson[] = [];
const NO_CONTACTS: LocalContact[] = [];
const NO_PARCELS: LocalParcel[] = [];

type Sheet = { initial: string; key: number };

/** A match, with the draft it was made for. */
type Matched = { draftId: string; result: RecipientResult };

/** The photo of the draft as an object URL, released when the draft changes. */
function usePhoto(photoId: string | null | undefined) {
  const [shown, setShown] = useState<{ photo: LocalPhoto; url: string }>();
  useEffect(() => {
    if (!photoId) return;
    let url: string | undefined;
    let current = true;
    void (async () => {
      const photo = await db.photo.get(photoId);
      if (!photo) return;
      const blob = await readPhoto(photoFiles, photo).catch(() => null);
      if (!blob || !current) return;
      url = URL.createObjectURL(blob);
      setShown({ photo, url });
    })();
    return () => {
      current = false;
      setShown(undefined);
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  return shown;
}

function fieldsOf(draft: DraftParcel): ScanField[] {
  return [
    {
      label: t('scan.field.carrier'),
      value: draft.carrier ?? t('scan.field.unknown'),
    },
    {
      label: t('scan.field.tracking'),
      value: draft.tracking ?? t('scan.field.missing'),
      mono: true,
    },
  ];
}

/**
 * « Vérifier un colis » for each parcel of the batch the reading could not
 * settle (F18): the photo, the three closest people, the directory one tap
 * away. « Passer » leaves the parcel to complete; the last one promotes the
 * batch as « Terminer » did.
 */
export function VerifyScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const view = useBatch();
  const batchId = view?.batch?.id;
  const people = useLiveQuery(
    () => db.directoryPerson.toArray(),
    [],
    NO_PEOPLE,
  );
  const contacts = useLiveQuery(() => db.contact.toArray(), [], NO_CONTACTS);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [at, setAt] = useState(0);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [matched, setMatched] = useState<Matched | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const finishing = useRef(false);
  const submitting = useRef(false);
  const settling = useRef(false);
  const matcher = recipientMatcher();

  const draftId = queue?.[at];
  const loaded = useLiveQuery(
    () => (draftId ? db.draftParcel.get(draftId) : undefined),
    [draftId],
  );
  /* The live query keeps the previous draft until the next one is read. */
  const draft = loaded?.id === draftId ? loaded : undefined;
  const parcels = useLiveQuery(
    () => (picking ? db.parcel.toArray() : NO_PARCELS),
    [picking],
    NO_PARCELS,
  );
  const shown = usePhoto(draft?.photoId);

  useEffect(() => {
    matcher.setEntries(recipientEntries(people, contacts));
  }, [matcher, people, contacts]);

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      if (batchId) {
        await finishBatch(db, { batchId, agentId: session.user.id });
      }
      await navigate({ to: '/' });
    } finally {
      finishing.current = false;
    }
  };

  useEffect(() => {
    if (view === undefined || settling.current) return;
    if (!batchId) {
      void navigate({ to: '/' });
      return;
    }
    settling.current = true;
    void (async () => {
      matcher.setEntries(
        recipientEntries(
          await db.directoryPerson.toArray(),
          await db.contact.toArray(),
        ),
      );
      const ids = await settleRecipients(db, batchId, matcher);
      if (ids.length === 0) void finish();
      else setQueue(ids);
    })();
    // Once per visit: the silent writes make `view` move again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, batchId, matcher, navigate]);

  const readName = draft?.readName ?? null;
  const ocrName = draft?.ocrName ?? null;
  const text = draft ? textOf(draft) : null;
  useEffect(() => {
    if (!draftId) return;
    let current = true;
    void matcher.match(readsOf({ readName, ocrName }), text).then((found) => {
      if (current) setMatched({ draftId, result: found });
    });
    return () => {
      current = false;
    };
  }, [matcher, draftId, readName, ocrName, text, people, contacts]);

  const result = matched && matched.draftId === draftId ? matched.result : null;
  const suggestions = (result?.suggestions ?? [])
    .map(({ entry }) => optionOf(entry.kind, entry.id, people, contacts))
    .filter((option): option is Choice => option !== null);
  const preselected = draft && preselection(draft, result);
  const chosen: Choice | undefined =
    (draftId && choices[draftId]) ||
    (preselected &&
      optionOf(preselected.kind, preselected.id, people, contacts)) ||
    undefined;
  const candidates =
    chosen && !suggestions.some((option) => option.id === chosen.id)
      ? [chosen, ...suggestions].slice(0, SUGGESTIONS)
      : suggestions;

  const choose = (option: Choice) => {
    if (draftId) setChoices((all) => ({ ...all, [draftId]: option }));
  };

  const next = () => {
    if (!queue) return;
    setZoomed(false);
    if (at + 1 < queue.length) setAt(at + 1);
    else void finish();
  };

  /* Until the draft and its match are in, there is nothing to validate. */
  const onSubmit = async () => {
    if (!draft || !result || !chosen || submitting.current) return;
    submitting.current = true;
    try {
      await updateDraft(db, draft.id, {
        recipient: toRecipient(chosen, 'agent'),
      });
      next();
    } finally {
      submitting.current = false;
    }
  };

  const onBack = () => {
    setZoomed(false);
    if (at > 0) setAt(at - 1);
    else void navigate({ to: '/scan' });
  };

  const openSheet = (initial: string) =>
    setSheet((previous) => ({ initial, key: (previous?.key ?? 0) + 1 }));

  const onPerson = (person: LocalDirectoryPerson) => {
    choose(personOption(person));
    setSheet(null);
    setPicking(false);
    setQuery('');
  };

  if (!queue || !draft || !result) return null;

  const line = nameLine(draft.ocrLines, ocrName ?? readName);
  const shownName = result?.readName ?? readName ?? ocrName;
  const last = at === queue.length - 1;

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
            if (option) choose(option);
            setPicking(false);
            setQuery('');
          }}
          onOutside={() => openSheet(query.trim() || shownName || '')}
        />
      ) : (
        <VerifierColisScreen
          step={{ index: at + 1, total: queue.length }}
          photo={
            shown && {
              src: shown.url,
              width: shown.photo.width,
              height: shown.photo.height,
              focus: line?.box ?? null,
            }
          }
          readName={shownName}
          candidates={candidates}
          selectedId={chosen?.id}
          fields={fieldsOf(draft)}
          addPerson={{
            name: shownName,
            onClick: () => openSheet(shownName ?? ''),
          }}
          submitLabel={t(
            last ? 'recipient.submit.last' : 'recipient.submit.next',
          )}
          onBack={onBack}
          onSkip={() => {
            if (!submitting.current) next();
          }}
          onZoom={shown ? () => setZoomed(true) : undefined}
          onSelect={(id) => {
            const option = candidates.find((c) => c.id === id);
            if (option) choose(option);
          }}
          onSearch={() => setPicking(true)}
          onSubmit={() => void onSubmit()}
        />
      )}
      {zoomed && shown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <img
            src={shown.url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
          <IconButton
            icon="x"
            label={t('recipient.photo.close')}
            size="lg"
            onClick={() => setZoomed(false)}
            className="absolute top-[calc(var(--safe-top)+8px)] left-5 bg-white"
          />
        </div>
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
