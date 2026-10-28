import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RemiseConfirmeeScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '#/features/db/database';
import {
  confirmationGone,
  describeConfirmation,
} from '#/features/handover/confirmation';
import { loadHandoverEntry } from '#/features/handover/entry';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

export type RemiseConfirmeePageProps = {
  handoverId: string;
  /** « Terminé », or the handover is not here to show: back to Colis. */
  onDone: () => void;
  onAnother: () => void;
};

/**
 * P4 step 4, once the handover is written on this iPhone: the agent shows it
 * to the recipient. The sync line follows the outbox live, so « Envoyée au
 * serveur » ticks itself while the screen is up.
 */
export function RemiseConfirmeePage({
  handoverId,
  onDone,
  onAnother,
}: RemiseConfirmeePageProps) {
  const online = useOnline();
  const entry = useLiveQuery(
    () => loadHandoverEntry(db, handoverId),
    [handoverId],
  );
  const missing = confirmationGone(entry);
  useEffect(() => {
    if (missing) onDone();
  }, [missing, onDone]);

  if (!entry || missing) return null;
  return (
    <RemiseConfirmeeScreen
      {...describeConfirmation(entry, online, t)}
      undoLabel={t('handover.done.undo')}
      undoDisabled
      onAnother={onAnother}
      onDone={onDone}
    />
  );
}
