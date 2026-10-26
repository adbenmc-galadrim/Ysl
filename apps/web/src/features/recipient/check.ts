import type {
  RecipientMatch,
  RecipientRead,
  RecipientResult,
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
import type { MatchEngine } from '#/features/recipient/matcher';

/**
 * The chain of F18, in its order: the name a code gave (or the agent, by
 * « Même destinataire »), then the OCR's name. The whole text only speaks
 * when neither did.
 */
export function readsOf(
  draft: Pick<DraftParcel, 'readName' | 'ocrName'>,
): RecipientRead[] {
  const reads: RecipientRead[] = [];
  if (draft.readName) reads.push({ text: draft.readName, source: 'code' });
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
 * The only match taken without the agent: a name a code printed that is,
 * first name and last name, one card and no other. An OCR name, however
 * exact, and a partial homonym always go before the agent.
 */
export function silentMatch(result: RecipientResult): RecipientMatch | null {
  const { best } = result;
  return best?.exact && best.source === 'code' ? best : null;
}

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
 * Before « Terminer » promotes the batch: each draft with no recipient yet
 * is matched; the sure ones are settled silently, the others are returned,
 * in batch order, for « Vérifier un colis ».
 */
export async function settleRecipients(
  db: CourrierDatabase,
  batchId: string,
  matcher: MatchEngine,
): Promise<string[]> {
  const toCheck: string[] = [];
  for (const draft of await listDrafts(db, batchId)) {
    if (draft.recipient) continue;
    const silent = silentMatch(
      await matcher.match(readsOf(draft), textOf(draft)),
    );
    if (
      silent &&
      (await updateDraft(db, draft.id, {
        recipient: toRecipient(
          { ...silent.entry, name: fullName(silent.entry) },
          'code',
        ),
      }))
    ) {
      continue;
    }
    toCheck.push(draft.id);
  }
  return toCheck;
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
