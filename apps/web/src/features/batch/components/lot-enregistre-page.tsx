import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { LotEnregistreScreen, type LotOutcome } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { lotOutcomes, type OutcomeTarget } from '#/features/batch/outcomes';
import {
  batchSpan,
  loadBatchSummary,
  type BatchSummary,
} from '#/features/batch/summary';
import { db } from '#/features/db/database';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * « Lot enregistré » (§6, F25): what the batch saved and what it left, then
 * its mails — each one previewed and sent from Notifier, one tap per mail.
 * Nothing here writes: "Plus tard" leaves the parcels in « À notifier ».
 */
export function LotEnregistrePage({ batchId }: { batchId: string }) {
  const navigate = useNavigate();
  const online = useOnline();
  const [summary, setSummary] = useState<BatchSummary | null>();

  useEffect(() => {
    let live = true;
    void loadBatchSummary(db, batchId).then((value) => {
      if (live) setSummary(value);
    });
    return () => {
      live = false;
    };
  }, [batchId]);

  useEffect(() => {
    if (summary === null) void navigate({ to: '/', replace: true });
  }, [summary, navigate]);

  if (!summary) return null;

  const notify = () =>
    void navigate({ to: '/notifier', search: { lot: batchId } });
  const open = (target: OutcomeTarget) => {
    if (target.to === 'mails') notify();
    else if (target.to === 'otherWay')
      void navigate({
        to: '/notifier',
        search: { lot: batchId, prevenir: true },
      });
    else if (target.to === 'record')
      void navigate({
        to: '/colis/$parcelId',
        params: { parcelId: target.parcelId },
      });
    else void navigate({ to: '/' });
  };
  const { rows, ready } = lotOutcomes(summary, { online, t });
  const outcomes: LotOutcome[] = rows.map(({ target, ...row }) =>
    target ? { ...row, onClick: () => open(target) } : row,
  );

  return (
    <LotEnregistreScreen
      count={summary.count}
      span={batchSpan(summary.batch, t)}
      outcomes={outcomes}
      emails={ready}
      sendLabel={t(ready === 1 ? 'lot.send.one' : 'lot.send.many', {
        count: ready,
      })}
      note={t('lot.note')}
      onLater={() => void navigate({ to: '/' })}
      onSend={notify}
      onNewBatch={() => void navigate({ to: '/scan' })}
    />
  );
}
