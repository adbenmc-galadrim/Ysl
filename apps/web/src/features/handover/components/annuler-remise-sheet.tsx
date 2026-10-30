import {
  HANDOVER_CANCEL_REASONS,
  type HandoverCancelReason,
} from '@repo/contract/handover';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { AnnulerRemiseScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import {
  cancelHandover,
  canCancelHandover,
  describeCancelSheet,
} from '#/features/handover/cancel-handover';
import { loadHandoverEntry } from '#/features/handover/entry';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';

const t = createTranslator(DEFAULT_LOCALE);

const REASONS = HANDOVER_CANCEL_REASONS.map((value) => ({
  value,
  label: t(`handover.cancel.reason.${value}`),
}));

/** Long enough for a sentence; the note is read on a line of the record. */
const NOTE_MAX = 200;

export type AnnulerRemiseSheetProps = {
  handoverId: string;
  onClose: () => void;
  /** Once written on this iPhone, before the sheet closes. */
  onCancelled?: (count: number) => void;
};

/**
 * F44: the one way to undo a handover, from its confirmation, a parcel's
 * record or the journal. A reason is always asked; the sheet closes by itself
 * if the handover can no longer be undone under it (a sync brought it back
 * cancelled or refused).
 */
export function AnnulerRemiseSheet({
  handoverId,
  onClose,
  onCancelled,
}: AnnulerRemiseSheetProps) {
  const now = useMinuteClock();
  const session = useSession();
  const entry = useLiveQuery(
    () => loadHandoverEntry(db, handoverId),
    [handoverId],
  );
  const [reason, setReason] = useState<HandoverCancelReason>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const gone = entry === null || (!!entry && !canCancelHandover(entry));
  useEffect(() => {
    if (gone && !busy) onClose();
  }, [gone, busy, onClose]);
  if (!entry || gone) return null;

  const confirm = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { count } = await cancelHandover(
        db,
        handoverId,
        { reason, note },
        { agentId: session.user.id, agentName: session.user.name },
      );
      onCancelled?.(count);
      onClose();
    } catch (error) {
      console.warn('Handover not cancelled', error);
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <AnnulerRemiseScreen
      fixed
      onDismiss={onClose}
      {...describeCancelSheet(entry, now, t, session.user.id)}
      reasons={REASONS}
      reason={reason}
      onReasonChange={(value) => setReason(value as HandoverCancelReason)}
      error={failed ? t('handover.cancel.failed') : undefined}
      note={note}
      onNoteChange={(value) => setNote(value.slice(0, NOTE_MAX))}
      onConfirm={() => void confirm()}
    />
  );
}
