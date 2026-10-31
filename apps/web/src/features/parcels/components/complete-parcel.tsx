import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, Sheet } from '@repo/ui';
import { useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { useAccess } from '#/features/auth/use-access';
import { db } from '#/features/db/database';
import type { LocalParcel } from '#/features/db/schema';
import {
  assignRecipient,
  completeTracking,
  type TrackingInput,
} from '#/features/parcels/complete';
import { TrackingEntry } from '#/features/parcels/components/tracking-entry';
import { gapsOf, missingOf } from '#/features/parcels/model';
import { formatTracking } from '#/features/parcels/record';
import { RecipientChooser } from '#/features/recipient/components/recipient-chooser';

const t = createTranslator(DEFAULT_LOCALE);

type Step = 'menu' | 'recipient' | 'tracking' | 'carrier';

export type CompleteParcelProps = {
  parcel: LocalParcel;
  onEdit: () => void;
  onClose: () => void;
};

/**
 * « Compléter » on a parcel's record (F26): what is missing, one tap
 * away — the recipient in « Choisir le destinataire », the number typed
 * and its carrier, « Sans suivi », or the number kept as read when only a
 * doubt held it back; every field of the form stays one tap further.
 */
export function CompleteParcel({
  parcel,
  onEdit,
  onClose,
}: CompleteParcelProps) {
  const session = useSession();
  const [step, setStep] = useState<Step>('menu');
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const [failed, setFailed] = useState(false);
  const { receives } = useAccess();
  const options = { agentId: session.user.id, learns: receives };
  const gaps = gapsOf(parcel);
  const numbered = parcel.type !== 'sans_suivi';
  const doubted = gaps.length === 0 && numbered && parcel.tracking !== null;

  const run = async (write: () => Promise<unknown>) => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await write();
      onClose();
    } catch {
      setFailed(true);
      setStep('menu');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const track = (input: TrackingInput) =>
    void run(() => completeTracking(db, parcel.id, input, options));

  if (step === 'recipient') {
    return (
      <RecipientChooser
        readName={parcel.readName}
        onClose={() => setStep('menu')}
        onPick={(pick) =>
          run(() =>
            assignRecipient(
              db,
              parcel.id,
              pick.kind === 'card'
                ? { kind: pick.choice.kind, id: pick.choice.id }
                : { ...pick, kind: 'typed' },
              options,
            ),
          )
        }
      />
    );
  }
  if (step === 'tracking' || step === 'carrier') {
    return (
      <TrackingEntry
        initial={parcel.tracking}
        carrierFor={step === 'carrier' ? (parcel.tracking ?? '') : undefined}
        onClose={() => setStep('menu')}
        onDone={(entered) => track({ kind: 'tracked', ...entered })}
      />
    );
  }

  return (
    <Sheet
      fixed
      title={t('complete.title')}
      description={
        failed ? t('record.error.write') : missingOf(parcel, t) || undefined
      }
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onClose}
    >
      <div className="mt-6 flex flex-col gap-3">
        {gaps.includes('recipient') && (
          <Button block onClick={() => setStep('recipient')}>
            {t('complete.recipient')}
          </Button>
        )}
        {doubted && parcel.carrier && (
          <Button
            block
            disabled={busy}
            onClick={() =>
              track({
                kind: 'tracked',
                tracking: parcel.tracking!,
                carrier: parcel.carrier!,
              })
            }
          >
            {t('complete.confirm', {
              tracking: formatTracking(parcel.tracking!),
            })}
          </Button>
        )}
        {gaps.includes('carrier') && (
          <Button
            block
            variant={gaps.includes('recipient') ? 'secondary' : 'primary'}
            onClick={() => setStep('carrier')}
          >
            {t('complete.carrier')}
          </Button>
        )}
        {numbered && (
          <Button
            block
            variant={
              gaps.length === 1 && gaps[0] === 'tracking'
                ? 'primary'
                : 'secondary'
            }
            onClick={() => setStep('tracking')}
          >
            {t('complete.tracking')}
          </Button>
        )}
        {numbered && (
          <Button
            block
            variant="secondary"
            disabled={busy}
            onClick={() => track({ kind: 'untracked' })}
          >
            {t('complete.untracked')}
          </Button>
        )}
        <Button
          variant="link"
          className="mt-1 self-center text-16 font-semibold"
          onClick={onEdit}
        >
          {t('complete.edit')}
        </Button>
      </div>
    </Sheet>
  );
}
