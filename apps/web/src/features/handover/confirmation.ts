import type { TranslateFn } from '@repo/shared/i18n';
import type { CheckListItem, RemiseConfirmeeScreenProps } from '@repo/ui';
import {
  handedParcel,
  type HandoverEntry,
  METHOD_ICON,
  methodLabel,
} from '#/features/handover/entry';
import { formatTime } from '#/features/parcels/model';

/**
 * The screen has nothing to show: the handover is not on this iPhone, or it
 * was cancelled under it (it lost all its parcels to another iPhone).
 */
export function confirmationGone(
  entry: HandoverEntry | null | undefined,
): boolean {
  return entry === null || !!entry?.handover.cancelledAt;
}

export type ConfirmationView = Pick<
  RemiseConfirmeeScreenProps,
  'title' | 'description' | 'proofs' | 'parcels' | 'offline'
>;

function syncProof(
  { sync }: HandoverEntry,
  online: boolean,
  t: TranslateFn,
): CheckListItem {
  if (sync === 'synced') {
    return { icon: 'cloud', label: t('handover.confirm.synced'), done: true };
  }
  if (sync === 'rejected') {
    return { icon: 'alert', label: t('handover.confirm.rejected') };
  }
  return {
    icon: 'cloud',
    label: online
      ? t('handover.confirm.sending')
      : t('handover.confirm.offline'),
  };
}

/**
 * P4 step 4, the screen the agent turns to the recipient: how many parcels,
 * to whom and when, how they proved it, whether the server has it. The
 * signature and the photo are offered once they exist (YSL-75).
 */
export function describeConfirmation(
  entry: HandoverEntry,
  online: boolean,
  t: TranslateFn,
): ConfirmationView {
  const { handover, parcels } = entry;
  const soon = t('handover.signature.soon');
  return {
    title: t('handover.confirm.title', { count: parcels.length }),
    description: t('handover.confirm.to', {
      name: handover.recipientName,
      time: formatTime(handover.at),
    }),
    proofs: [
      {
        icon: METHOD_ICON[handover.method],
        label: methodLabel(handover.method, t),
        done: handover.method !== 'manuel',
      },
      { icon: 'sign', label: t('handover.confirm.signature'), soon },
      { icon: 'camera', label: t('handover.confirm.photo'), soon },
      syncProof(entry, online, t),
    ],
    parcels: parcels.map((parcel) => handedParcel(parcel, t)),
    offline: !online,
  };
}
