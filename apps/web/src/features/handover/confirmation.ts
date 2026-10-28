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

/** What the agent can still add to the handover from this screen. */
export type ConfirmationActions = {
  onSign?: () => void;
  onPhoto?: () => void;
};

/**
 * The signature and the photo, kept or still to take: a handover picked by
 * the name and signed already says « Signée » on its method line.
 */
function evidenceProofs(
  { handover }: HandoverEntry,
  { onSign, onPhoto }: ConfirmationActions,
  t: TranslateFn,
): CheckListItem[] {
  const signature: CheckListItem[] =
    handover.method === 'signature'
      ? []
      : handover.hasSignature
        ? [{ icon: 'sign', label: t('handover.confirm.signed'), done: true }]
        : [
            {
              icon: 'sign',
              label: t('handover.confirm.signature'),
              onClick: onSign,
            },
          ];
  const photo: CheckListItem = handover.hasPhoto
    ? { icon: 'camera', label: t('handover.confirm.photographed'), done: true }
    : { icon: 'camera', label: t('handover.confirm.photo'), onClick: onPhoto };
  return [...signature, photo];
}

/**
 * P4 step 4, the screen the agent turns to the recipient: how many parcels,
 * to whom and when, how they proved it, whether the server has it. A
 * signature or a photo may still be added, never required (D6).
 */
export function describeConfirmation(
  entry: HandoverEntry,
  online: boolean,
  t: TranslateFn,
  actions: ConfirmationActions = {},
): ConfirmationView {
  const { handover, parcels } = entry;
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
      ...evidenceProofs(entry, actions, t),
      syncProof(entry, online, t),
    ],
    parcels: parcels.map((parcel) => handedParcel(parcel, t)),
    offline: !online,
  };
}
