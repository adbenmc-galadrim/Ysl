import {
  type RecipientRead,
  type RecipientResult,
  silentMatch,
} from '@repo/contract/recipient';
import { normalizeName } from '@repo/shared/text';
import { listDrafts, updateDraft } from '#/features/batch/store';
import type {
  CourrierDatabase,
  DraftOcrLine,
  DraftParcel,
  DraftRecipient,
} from '#/features/db/schema';
import { fullName } from '#/features/directory/people';
import { recipientInCodes } from '#/features/scan/extract';
import type { MatchEngine } from '#/features/recipient/matcher';

/**
 * The chain of F18, in its order: the name a structured code prints, then
 * the OCR's name. A name the agent copied from the parcel before
 * (« Même destinataire ») is weighed too, but as a reading to confirm: the
 * copy may carry that parcel's OCR guess, so it never settles a card alone.
 */
export function readsOf(
  draft: Pick<DraftParcel, 'readName' | 'ocrName' | 'symbols'>,
): RecipientRead[] {
  const coded = recipientInCodes(draft.symbols);
  const reads: RecipientRead[] = [];
  if (coded) reads.push({ text: coded, source: 'code' });
  if (draft.readName && draft.readName !== coded) {
    reads.push({ text: draft.readName, source: 'ocr' });
  }
  if (draft.ocrName) reads.push({ text: draft.ocrName, source: 'ocr' });
  return reads;
}

export const textOf = (draft: Pick<DraftParcel, 'ocrLines'>) =>
  draft.ocrLines.map((line) => line.text).join('\n') || null;

export const toRecipient = (
  chosen: Pick<DraftRecipient, 'kind' | 'id' | 'name'>,
  source: DraftRecipient['source'],
): DraftRecipient => ({
  kind: chosen.kind,
  id: chosen.id,
  name: chosen.name,
  source,
});

/**
 * What « Vérifier un colis » shows selected: the agent's earlier choice,
 * else the suggestion that stands out. Never a partial homonym: the
 * matcher gives no `best` for one.
 */
export function preselection(
  draft: Pick<DraftParcel, 'recipient'>,
  result: RecipientResult | null,
): Pick<DraftRecipient, 'kind' | 'id'> | null {
  if (draft.recipient) return draft.recipient;
  return result?.best ? result.best.entry : null;
}

/**
 * When the batch review opens: each draft with no recipient yet is
 * matched, and an exact code name settles its card silently; the review
 * asks the agent about the others (F18, F25).
 */
export async function settleRecipients(
  db: CourrierDatabase,
  batchId: string,
  matcher: MatchEngine,
): Promise<void> {
  for (const draft of await listDrafts(db, batchId)) {
    if (draft.recipient) continue;
    const silent = silentMatch(
      await matcher.match(readsOf(draft), textOf(draft)),
    );
    if (!silent) continue;
    await updateDraft(db, draft.id, {
      recipient: toRecipient(
        { ...silent.entry, name: fullName(silent.entry) },
        'code',
      ),
    });
  }
}

const words = (text: string) =>
  normalizeName(text)
    .split(' ')
    .filter((word) => word.length > 1);

/**
 * The line the name was read on, to crop the photo around it: the line
 * sharing the most words with the name, none when nothing matches.
 */
export function nameLine(
  lines: readonly DraftOcrLine[],
  name: string | null,
): DraftOcrLine | null {
  if (!name) return null;
  const wanted = new Set(words(name));
  let found: DraftOcrLine | null = null;
  let most = 0;
  for (const line of lines) {
    const shared = words(line.text).filter((word) => wanted.has(word)).length;
    if (shared > most) {
      most = shared;
      found = line;
    }
  }
  return found;
}
