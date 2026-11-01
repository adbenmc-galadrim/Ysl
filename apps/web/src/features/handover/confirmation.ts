import type { TranslateFn } from '@repo/shared/i18n';
import type { CheckListItem, RemiseConfirmeeScreenProps } from '@repo/ui';
import type { HandoverProofKind } from '#/features/db/schema';
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
  { sync, refusal }: HandoverEntry,
  online: boolean,
  t: TranslateFn,
): CheckListItem {
  if (sync === 'synced') {
    return { icon: 'cloud', label: t('handover.confirm.synced'), done: true };
  }
  if (sync === 'rejected') {
    // Refused for a step the profile now requires: what the agent can act on.
    const steps = t('sync.op.handoverSteps');
    return {
      icon: 'alert',
      label: refusal === steps ? steps : t('handover.confirm.rejected'),
    };
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
  /** The last signature or photo could not be kept on this iPhone. */
  failed?: HandoverProofKind | null;
  /** The profile turned the step off: nothing to add, what was taken still shows. */
  noSignature?: boolean;
  noPhoto?: boolean;
};

/** « Signature », « Photo de la remise »: how the screens name each proof. */
export function proofLabels(t: TranslateFn): Record<HandoverProofKind, string> {
  return {
    signature: t('handover.proof.signature'),
    photo: t('handover.proof.photo'),
  };
}

/**
 * The signature and the photo, kept or still to take: a handover picked by
 * the name and signed already says « Signée » on its method line.
 */
function evidenceProofs(
  { handover }: HandoverEntry,
  { onSign, onPhoto, failed, noSignature, noPhoto }: ConfirmationActions,
  t: TranslateFn,
): CheckListItem[] {
  const signature: CheckListItem[] =
    handover.method === 'signature'
      ? []
      : handover.hasSignature
        ? [{ icon: 'sign', label: t('handover.confirm.signed'), done: true }]
        : noSignature
          ? []
          : [
              {
                icon: 'sign',
                label: t('handover.confirm.signature'),
                onClick: onSign,
              },
            ];
  const photo: CheckListItem[] = handover.hasPhoto
    ? [
        {
          icon: 'camera',
          label: t('handover.confirm.photographed'),
          done: true,
        },
      ]
    : noPhoto
      ? []
      : [
          {
            icon: 'camera',
            label: t('handover.confirm.photo'),
            onClick: onPhoto,
          },
        ];
  const lost: CheckListItem[] = failed
    ? [
        {
          icon: 'alert',
          label: `${proofLabels(t)[failed]} : ${t('handover.proof.failed')}`,
        },
      ]
    : [];
  return [...signature, ...photo, ...lost];
}

/**
 * P4 step 4, the screen the agent turns to the recipient: how many parcels,
 * to whom and when, how they proved it, whether the server has it. A
 * signature or a photo may still be added, when the profile offers it.
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
    description: handover.delegateName
      ? t(
          parcels.length > 1
            ? 'handover.confirm.toDelegate.many'
            : 'handover.confirm.toDelegate.one',
          {
            name: handover.recipientName,
            delegate: handover.delegateName,
            // The longer sentence wraps: never inside « 11 h 20 ».
            time: formatTime(handover.at).replace(/ /g, '\u00a0'),
          },
        )
      : t('handover.confirm.to', {
          name: handover.recipientName,
          time: formatTime(handover.at),
        }),
    proofs: [
      {
        icon: METHOD_ICON[handover.method],
        label: methodLabel(handover.method, t),
        done: handover.method !== 'manuel',
      },
      ...(handover.hasScan
        ? [
            {
              icon: 'scan' as const,
              label: t('handover.scan.proof', { count: parcels.length }),
              done: true,
            },
          ]
        : []),
      ...evidenceProofs(entry, actions, t),
      syncProof(entry, online, t),
    ],
    parcels: parcels.map((parcel) => handedParcel(parcel, t)),
    offline: !online,
  };
}
