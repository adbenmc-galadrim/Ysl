import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  IconButton,
  type ReviewRow,
  RevueLotScreen,
  VerifierSourceLink,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { finishBatch, listDrafts } from '#/features/batch/store';
import { useBatch } from '#/features/batch/use-batch';
import { useDraftPhotos } from '#/features/batch/use-draft-photos';
import { db } from '#/features/db/database';
import type {
  DraftParcel,
  ExtractionFieldName,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { ReadingView } from '#/features/diagnostic/components/reading-view';
import {
  departmentLabel,
  departmentNames,
  NO_DEPARTMENT_NAMES,
} from '#/features/directory/people';
import { settleRecipients } from '#/features/recipient/check';
import { recipientEntries } from '#/features/recipient/entries';
import { recipientMatcher } from '#/features/recipient/matcher';
import { skipDraft } from '#/features/review/actions';
import { AnnexStep } from '#/features/review/components/annex-step';
import { SenderStep } from '#/features/review/components/sender-step';
import { RecipientStep } from '#/features/review/components/recipient-step';
import type { StepProps } from '#/features/review/components/step';
import { TrackingStep } from '#/features/review/components/tracking-step';
import {
  type ReviewItem,
  type ReviewStep,
  reviewBatch,
  reviewOf,
  reviewSummary,
} from '#/features/review/model';
import { usePhoto } from '#/features/review/photo';

const t = createTranslator(DEFAULT_LOCALE);

const NO_PEOPLE: LocalDirectoryPerson[] = [];
const NO_CONTACTS: LocalContact[] = [];

/** The doubtful parcels the agent walks through, and those passed on the way. */
type Walk = { queue: string[]; at: number; passed: string[] };

const issueOf = (step: ReviewStep, draft: DraftParcel) => {
  if (step.field === 'tracking') {
    if (!(draft.trackingNorm ?? draft.tracking)) {
      return t('review.issue.tracking.missing');
    }
    if (step.level === 'carrier') return t('review.issue.carrier');
    return step.level === 'to-verify'
      ? t('review.issue.tracking.toVerify')
      : t('review.issue.tracking.none');
  }
  return t(`review.issue.${step.field}`);
};

const carrierLine = (draft: DraftParcel) => {
  // The app's own number of a parcel « Sans suivi » means nothing to the agent.
  if (draft.type === 'sans_suivi') return t('parcel.carrier.none');
  const carrier = draft.carrier ?? t('review.line.noCarrier');
  const number = draft.trackingNorm ?? draft.tracking;
  return number ? `${carrier} ···${number.slice(-4)}` : carrier;
};

/** What the scanner read, under the doubt: the number in full when it is the doubt. */
const doubtLines = ({ draft, steps }: ReviewItem) => {
  const fields = steps.map((step) => step.field);
  const number = draft.trackingNorm ?? draft.tracking;
  const read = draft.readName ?? draft.ocrName;
  return [
    fields.includes('tracking') && number
      ? `${draft.carrier ?? t('review.line.noCarrier')} ${number}`
      : carrierLine(draft),
    ...(fields.includes('recipient') && read
      ? [t('review.line.read', { name: read })]
      : []),
  ];
};

/**
 * « Vérifier le lot » (F25, P2), between « Terminer » and the save: the
 * parcels the reading doubts first, least sure on top, each opened to
 * « Vérifier un colis » one field at a time; the parcels passed wait
 * « À compléter »; the sure ones are saved with the batch in one tap.
 * Every answer is written on the draft at once, so a batch cut short
 * comes back with its review where the agent left it.
 */
export function ReviewScreen() {
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
  const names = useLiveQuery(
    () => departmentNames(db),
    [],
    NO_DEPARTMENT_NAMES,
  );
  const drafts = useLiveQuery(
    () => (batchId ? listDrafts(db, batchId) : undefined),
    [batchId],
  );
  const [settled, setSettled] = useState(false);
  const [walk, setWalk] = useState<Walk | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [explaining, setExplaining] = useState<ExtractionFieldName | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const settling = useRef(false);
  const savingRef = useRef(false);
  const matcher = recipientMatcher();
  const urls = useDraftPhotos(drafts ?? []);

  useEffect(() => {
    matcher.setEntries(recipientEntries(people, contacts, names));
  }, [matcher, people, contacts, names]);

  /* Once per visit: the exact names a code prints settle their card silently. */
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
          await departmentNames(db),
        ),
      );
      await settleRecipients(db, batchId, matcher);
      setSettled(true);
    })();
  }, [view, batchId, matcher, navigate]);

  const current = walk
    ? drafts?.find((draft) => draft.id === walk.queue[walk.at])
    : undefined;
  const steps =
    current && !walk?.passed.includes(current.id)
      ? reviewOf(current).steps
      : [];
  const step = steps[0];
  const shown = usePhoto(current?.photoId);

  /* A parcel settled or passed hands over to the next one still doubtful. */
  useEffect(() => {
    if (!walk || !drafts || step) return;
    const next = walk.queue.findIndex((id, i) => {
      if (i <= walk.at || walk.passed.includes(id)) return false;
      const draft = drafts.find((d) => d.id === id);
      return draft !== undefined && reviewOf(draft).steps.length > 0;
    });
    setZoomed(false);
    setWalk(next === -1 ? null : { ...walk, at: next });
  }, [walk, drafts, step]);

  if (!settled || !drafts) return null;

  const review = reviewBatch(drafts);
  const thumbnail = (draft: DraftParcel) => {
    const url = draft.photoId ? urls.get(draft.photoId) : undefined;
    return url ? (
      <img
        src={url}
        alt=""
        className="size-11 shrink-0 rounded-[8px] bg-fill object-cover"
      />
    ) : undefined;
  };
  const doubtRow = (item: ReviewItem): ReviewRow => ({
    id: item.draft.id,
    name: item.draft.recipient?.name ?? null,
    issue: item.steps[0]
      ? issueOf(item.steps[0], item.draft)
      : t('review.issue.carrier'),
    lines: doubtLines(item),
    thumbnail: thumbnail(item.draft),
  });
  const readyRow = ({ draft }: ReviewItem): ReviewRow => {
    const person =
      draft.recipient?.kind === 'person'
        ? people.find((p) => p.id === draft.recipient?.id)
        : undefined;
    const department = person ? departmentLabel(person, names) : '';
    return {
      id: draft.id,
      name: draft.recipient?.name ?? null,
      lines: [
        department
          ? `${department}, ${carrierLine(draft)}`
          : carrierLine(draft),
      ],
      thumbnail: thumbnail(draft),
    };
  };

  const open = (id: string) => {
    const doubts = review.toCheck.map((item) => item.draft.id);
    const at = doubts.indexOf(id);
    setWalk(
      at === -1
        ? { queue: [id], at: 0, passed: [] }
        : { queue: doubts, at, passed: [] },
    );
  };

  const save = async () => {
    if (!batchId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await finishBatch(db, {
        batchId,
        agentId: session.user.id,
      });
      await (saved.length > 0
        ? navigate({
            to: '/lot/$batchId',
            params: { batchId },
            replace: true,
          })
        : navigate({ to: '/' }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (walk && current && step) {
    const lastParcel = !walk.queue.some((id, i) => {
      if (i <= walk.at || walk.passed.includes(id)) return false;
      const draft = drafts.find((d) => d.id === id);
      return draft !== undefined && reviewOf(draft).steps.length > 0;
    });
    const frame: StepProps = {
      draft: current,
      step: { index: walk.at + 1, total: walk.queue.length },
      photo: shown && {
        src: shown.url,
        width: shown.photo.width,
        height: shown.photo.height,
        focus: null,
      },
      submitLabel: t(
        lastParcel && steps.length === 1
          ? 'review.submit.done'
          : 'recipient.submit.next',
      ),
      onZoom: shown ? () => setZoomed(true) : undefined,
      source: <VerifierSourceLink onClick={() => setExplaining(step.field)} />,
      onBack: () => {
        setZoomed(false);
        setExplaining(null);
        setWalk(null);
      },
      onSkip: () => {
        void skipDraft(db, current.id);
        setWalk({ ...walk, passed: [...walk.passed, current.id] });
      },
    };
    const key = `${current.id}:${step.field}`;
    return (
      <>
        {step.field === 'tracking' ? (
          <TrackingStep key={key} {...frame} level={step.level} />
        ) : step.field === 'recipient' ? (
          <RecipientStep
            key={key}
            {...frame}
            matcher={matcher}
            people={people}
            contacts={contacts}
            names={names}
          />
        ) : step.field === 'sender' ? (
          <SenderStep key={key} {...frame} />
        ) : (
          <AnnexStep key={key} {...frame} field={step.field} />
        )}
        {explaining && (
          // Over the step, which stays mounted: the parcel and the choice in
          // progress are still there when the agent comes back.
          <div className="fixed inset-0 z-40">
            <ReadingView
              id={current.id}
              field={explaining}
              onBack={() => setExplaining(null)}
            />
          </div>
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
      </>
    );
  }

  return (
    <RevueLotScreen
      count={drafts.length}
      summary={reviewSummary(review, t)}
      toCheck={review.toCheck.map(doubtRow)}
      toComplete={review.toComplete.map(doubtRow)}
      ready={review.ready.map(readyRow)}
      saving={saving}
      onBack={() => void navigate({ to: '/scan' })}
      onOpen={open}
      onSave={() => void save()}
    />
  );
}
