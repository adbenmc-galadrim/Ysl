import { CONFIDENCE } from '@repo/contract/extract';
import type { TranslateFn } from '@repo/shared/i18n';
import type { DraftParcel, DraftSender } from '#/features/db/schema';
import type { DraftAnnex } from '#/features/scan/annex';
import { draftFields } from '#/features/scan/confidence';

/** The annex fields the review proposes one by one when « à vérifier » (§4.4). */
export const ANNEX_FIELDS = [
  'weightKg',
  'pieces',
  'service',
  'reference',
] as const satisfies readonly (keyof DraftAnnex)[];

export type AnnexField = (typeof ANNEX_FIELDS)[number];

/**
 * One field the agent has to look at, in the order the review asks: the
 * number, the recipient, the sender, then the annex fields (F25, one at
 * a time).
 */
export type ReviewStep =
  | { field: 'tracking'; level: 'to-verify' | 'none' | 'carrier' }
  | { field: 'recipient' }
  | { field: 'sender' }
  | { field: AnnexField };

/**
 * Where a parcel sits on « Vérifier le lot »: still doubtful, passed by the
 * agent (saved « À compléter »), or ready to be saved with the batch.
 */
export type ReviewGroup = 'toCheck' | 'toComplete' | 'ready';

export type ReviewItem = {
  draft: DraftParcel;
  steps: ReviewStep[];
  group: ReviewGroup;
  /** The least sure field the agent has to look at; 1 when none is left. */
  confidence: number;
};

export type Review = {
  toCheck: ReviewItem[];
  toComplete: ReviewItem[];
  ready: ReviewItem[];
};

/**
 * A sender read « à vérifier » is proposed like an annex field (§4.4), and
 * so is one an alias proposes below « sûr »: confirming it is how what the
 * agent taught gains confidence (§4.8). A bare OCR guess is not asked.
 */
export const asksSender = (sender: DraftSender | null) =>
  sender !== null &&
  sender.level !== 'sure' &&
  (sender.level === 'to-verify' || sender.alias === true);

/**
 * A field below « sûr » that F26 needs: the parcel is not notified without
 * it. An annex field does not hold the parcel back (§4.4): one left « à
 * vérifier » is saved as read, the parcel « Reçu », and a parcel passed on
 * it alone counts as ready.
 */
const blocks = (step: ReviewStep) =>
  step.field === 'tracking' || step.field === 'recipient';

/**
 * What the agent still has to look at on a draft. A number not sure nor
 * confirmed; a number sure, its format naming no carrier, the carrier to
 * choose; no card settled for the recipient, a name a code printed
 * included (a company is not someone to tell); an annex field or a sender
 * read « à vérifier ». A parcel « Sans suivi » has no number to check.
 */
export function reviewOf(draft: DraftParcel): ReviewItem {
  const { tracking, recipient, extraction } = draftFields(draft);
  const steps: ReviewStep[] = [];
  const scores: number[] = [];
  const untracked = draft.type === 'sans_suivi';
  if (!untracked && tracking?.level !== 'sure') {
    steps.push({
      field: 'tracking',
      level: tracking?.level === 'to-verify' ? 'to-verify' : 'none',
    });
    scores.push(tracking?.confidence ?? 0);
  } else if (!untracked && !draft.carrier) {
    steps.push({ field: 'tracking', level: 'carrier' });
    scores.push(tracking?.confidence ?? 0);
  }
  if (!draft.recipient) {
    steps.push({ field: 'recipient' });
    scores.push(recipient?.confidence ?? 0);
  }
  if (asksSender(draft.sender ?? null)) {
    steps.push({ field: 'sender' });
    scores.push(draft.sender?.confidence ?? CONFIDENCE.toVerify);
  }
  for (const field of ANNEX_FIELDS) {
    if (draft.annex?.[field]?.level !== 'to-verify') continue;
    steps.push({ field });
    scores.push(extraction[field]?.confidence ?? CONFIDENCE.toVerify);
  }
  const blocked =
    steps.some(blocks) || (!untracked && (!draft.carrier || !tracking));
  const group: ReviewGroup = !blocked
    ? steps.length === 0 || draft.reviewSkipped
      ? 'ready'
      : 'toCheck'
    : draft.reviewSkipped || steps.length === 0
      ? 'toComplete'
      : 'toCheck';
  return {
    draft,
    steps: group === 'ready' ? [] : steps,
    group,
    confidence: group === 'ready' ? 1 : Math.min(...scores),
  };
}

/**
 * The batch as the review lists it (F25): the doubts first, least sure on
 * top, then the parcels passed, then the ready ones, each in batch order.
 */
export function reviewBatch(drafts: readonly DraftParcel[]): Review {
  const items = drafts.map(reviewOf);
  const order = (item: ReviewItem) => drafts.indexOf(item.draft);
  return {
    toCheck: items
      .filter((item) => item.group === 'toCheck')
      .sort((a, b) => a.confidence - b.confidence || order(a) - order(b)),
    toComplete: items.filter((item) => item.group === 'toComplete'),
    ready: items.filter((item) => item.group === 'ready'),
  };
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const;

/** « Deux » in a sentence, « 12 » past ten, as the mockup writes it. */
const counted = (count: number, t: TranslateFn) =>
  count < WORDS.length ? t(`review.count.${WORDS[count]!}`) : String(count);

const capitalized = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * « 12 colis lus. Deux demandent votre avis, les autres sont prêts. » —
 * the counters of the review in one sentence; « Tout est sûr. » when
 * nothing waits for the agent (§6.5).
 */
export function reviewSummary(review: Review, t: TranslateFn): string {
  const total =
    review.toCheck.length + review.toComplete.length + review.ready.length;
  const read = t(
    total === 1 ? 'review.summary.readOne' : 'review.summary.read',
    { count: total },
  );
  const parts: string[] = [];
  const toCheck = review.toCheck.length;
  const toComplete = review.toComplete.length;
  if (toCheck > 0) {
    parts.push(
      t(toCheck > 1 ? 'review.summary.toCheck' : 'review.summary.toCheckOne', {
        count: counted(toCheck, t),
      }),
    );
  }
  if (toComplete > 0) {
    parts.push(
      t(
        toComplete > 1
          ? 'review.summary.toComplete'
          : 'review.summary.toCompleteOne',
        { count: counted(toComplete, t) },
      ),
    );
  }
  if (parts.length === 0) return `${read} ${t('review.summary.allSure')}`;
  if (review.ready.length > 0) parts.push(t('review.summary.ready'));
  return `${read} ${capitalized(parts.join(', '))}.`;
}
