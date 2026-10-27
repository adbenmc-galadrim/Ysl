import { validateTracking } from '@repo/contract/tracking';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { updateDraft } from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { db as database } from '#/features/db/database';
import { carrierName } from '#/features/scan/carriers';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * The agent picks the number among the suggestions (§4.4): it becomes the
 * draft's tracking, confirmed, so « Terminer » can notify (F26). The carrier
 * its format names comes with it, unless the draft already has one.
 */
export async function pickTracking(
  draftId: string,
  value: string,
  db: CourrierDatabase = database,
): Promise<boolean> {
  const draft = await db.draftParcel.get(draftId);
  if (!draft) return false;
  const verdict = validateTracking(value);
  const carrier =
    draft.carrier ?? (verdict.carrier ? carrierName(verdict.carrier, t) : null);
  return updateDraft(db, draftId, {
    tracking: verdict.value,
    trackingNorm: verdict.value,
    carrier,
    trackingConfirmed: true,
  });
}
