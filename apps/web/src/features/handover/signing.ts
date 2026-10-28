import type { TranslateFn } from '@repo/shared/i18n';
import type { LocalParcel } from '#/features/db/schema';
import { handedParcel } from '#/features/handover/entry';

/**
 * The head of the signature screen: who signs, for how many parcels, and
 * the registered ones among them — « Dont 1 recommandé UPS ···8810 ».
 */
export function signatureHeading(
  name: string,
  parcels: readonly LocalParcel[],
  t: TranslateFn,
): { title: string; detail?: string } {
  const title = t('handover.sign.title', { name, count: parcels.length });
  const registered = parcels.filter((parcel) => parcel.type === 'recommande');
  if (!registered.length) return { title };
  if (registered.length > 1) {
    return {
      title,
      detail: t('handover.sign.registeredMany', { count: registered.length }),
    };
  }
  return {
    title,
    detail: t('handover.sign.registeredOne', {
      parcel: handedParcel(registered[0]!, t).detail,
    }),
  };
}
