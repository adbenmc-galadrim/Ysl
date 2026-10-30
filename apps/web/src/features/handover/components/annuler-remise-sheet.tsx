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
  reasonOfLabel,
} from '#/features/handover/cancel-handover';
import { loadHandoverEntry } from '#/features/handover/entry';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';

const t = createTranslator(DEFAULT_LOCALE);

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
  const [label, setLabel] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const gone = entry === null || (!!entry && !canCancelHandover(entry));
  useEffect(() => {
    if (gone && !busy) onClose();
  }, [gone, busy, onClose]);
  if (!entry || gone) return null;

  const confirm = async () => {
    const reason = label && reasonOfLabel(label, t);
    if (!reason || busy) return;
    setBusy(true);
    try {
      const { count } = await cancelHandover(
        db,
        handoverId,
        { reason, note },
        { agentId: session.user.id, agentName: session.user.name },
      );
      onCancelled?.(count);
    } catch (error) {
      console.warn('Handover not cancelled', error);
    }
    onClose();
  };

  return (
    <AnnulerRemiseScreen
      fixed
      onDismiss={onClose}
      {...describeCancelSheet(entry, now, t, session.user.id)}
      reason={label}
      onReasonChange={setLabel}
      note={note}
      onNoteChange={(value) => setNote(value.slice(0, NOTE_MAX))}
      onConfirm={() => void confirm()}
    />
  );
}
