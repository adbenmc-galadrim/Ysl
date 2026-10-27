import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { LotEnregistreScreen, type LotOutcome } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
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

  const ready = summary.mails.filter((mail) => mail.address);
  const missing = summary.mails.length - ready.length;
  const parcels = ready.reduce((sum, mail) => sum + mail.parcels.length, 0);
  const notify = () =>
    void navigate({ to: '/notifier', search: { lot: batchId } });
  const toComplete = summary.toComplete;
  const first = toComplete[0];

  const outcomes: LotOutcome[] = [];
  if (ready.length > 0)
    outcomes.push({
      icon: 'mail',
      tone: 'blue',
      title: t(ready.length === 1 ? 'lot.mails.one' : 'lot.mails.many', {
        count: ready.length,
      }),
      detail: t('lot.mails.detail', {
        parcels: t(
          parcels === 1 ? 'lot.mails.parcels.one' : 'lot.mails.parcels.many',
          { count: parcels },
        ),
        people: t(
          ready.length === 1 ? 'lot.mails.people.one' : 'lot.mails.people.many',
          { count: ready.length },
        ),
      }),
      onClick: notify,
    });
  if (missing > 0)
    outcomes.push({
      icon: 'mail',
      tone: 'orange',
      title: t(missing === 1 ? 'lot.missing.one' : 'lot.missing.many', {
        count: missing,
      }),
      detail: t('lot.missing.detail'),
      onClick: notify,
    });
  if (first)
    outcomes.push({
      icon: 'alert',
      tone: 'red',
      title: t('lot.toComplete', { count: toComplete.length }),
      detail: t(
        toComplete.length === 1
          ? 'lot.toComplete.detail'
          : 'lot.toComplete.detail.many',
      ),
      onClick: () =>
        void (toComplete.length === 1
          ? navigate({
              to: '/colis/$parcelId',
              params: { parcelId: first.id },
            })
          : navigate({ to: '/' })),
    });
  if (summary.damaged > 0)
    outcomes.push({
      icon: 'alert',
      tone: 'orange',
      title: t('lot.damaged', { count: summary.damaged }),
      detail: t(
        summary.damaged === 1
          ? 'lot.damaged.detail'
          : 'lot.damaged.detail.many',
      ),
    });
  if (summary.pieces > 0)
    outcomes.push({
      icon: 'package',
      tone: 'neutral',
      title: t('lot.pieces', { count: summary.pieces }),
      detail: t('lot.pieces.detail'),
    });
  if (!online && ready.length > 0)
    outcomes.push({
      icon: 'wifiOff',
      tone: 'grey',
      title: t('lot.offline'),
      detail: t('lot.offline.detail'),
    });

  return (
    <LotEnregistreScreen
      count={summary.count}
      span={batchSpan(summary.batch, t)}
      outcomes={outcomes}
      emails={ready.length}
      sendLabel={t(ready.length === 1 ? 'lot.send.one' : 'lot.send.many', {
        count: ready.length,
      })}
      note={t('lot.note')}
      onLater={() => void navigate({ to: '/' })}
      onSend={notify}
      onNewBatch={() => void navigate({ to: '/scan' })}
    />
  );
}
