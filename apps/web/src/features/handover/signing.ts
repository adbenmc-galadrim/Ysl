import type { TranslateFn } from '@repo/shared/i18n';
import type { LocalParcel } from '#/features/db/schema';
import { handedParcel } from '#/features/handover/entry';

/**
 * The head of the signature screen: who signs, for whom when a colleague
 * collects (« Paul Mercier signe pour Nora Haddad, 3 colis »), for how many
 * parcels, and the registered ones among them — « Dont 1 recommandé UPS ···8810 ».
 */
export function signatureHeading(
  recipientName: string,
  parcels: readonly LocalParcel[],
  t: TranslateFn,
  delegateName?: string | null,
): { title: string; detail?: string } {
  const count = parcels.length;
  const title = delegateName
    ? t('handover.sign.titleFor', {
        name: delegateName,
        recipient: recipientName,
        count,
      })
    : t('handover.sign.title', { name: recipientName, count });
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
