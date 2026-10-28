import type { TranslateFn } from '@repo/shared/i18n';
import type { LotOutcome } from '@repo/ui';
import type { BatchSummary } from '#/features/batch/summary';

/** Where a row of « Lot enregistré » leads: the mails, a record, or Colis. */
export type OutcomeTarget =
  | { to: 'mails' }
  | { to: 'otherWay' }
  | { to: 'record'; parcelId: string }
  | { to: 'home' };

export type OutcomeRow = Omit<LotOutcome, 'onClick'> & {
  target?: OutcomeTarget;
};

/**
 * The rows of the card, only those with something to say, in the
 * mockup's order: the mails ready, the addresses to type, the parcels to
 * complete, then what is worth knowing. `ready` is what the button sends.
 */
export function lotOutcomes(
  summary: Pick<BatchSummary, 'mails' | 'toComplete' | 'damaged' | 'pieces'>,
  { online, t }: { online: boolean; t: TranslateFn },
): { rows: OutcomeRow[]; ready: number } {
  const ready = summary.mails.filter((mail) => mail.address);
  const missing = summary.mails.length - ready.length;
  const parcels = ready.reduce((sum, mail) => sum + mail.parcels.length, 0);
  const { toComplete } = summary;
  const rows: OutcomeRow[] = [];
  if (ready.length > 0)
    rows.push({
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
      target: { to: 'mails' },
    });
  if (missing > 0)
    rows.push({
      icon: 'mail',
      tone: 'orange',
      title: t(missing === 1 ? 'lot.missing.one' : 'lot.missing.many', {
        count: missing,
      }),
      detail: t('lot.missing.detail'),
      target: { to: 'otherWay' },
    });
  const [first] = toComplete;
  if (first)
    rows.push({
      icon: 'alert',
      tone: 'red',
      title: t('lot.toComplete', { count: toComplete.length }),
      detail: t(
        toComplete.length === 1
          ? 'lot.toComplete.detail'
          : 'lot.toComplete.detail.many',
      ),
      target:
        toComplete.length === 1
          ? { to: 'record', parcelId: first.id }
          : { to: 'home' },
    });
  if (summary.damaged > 0)
    rows.push({
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
    rows.push({
      icon: 'package',
      tone: 'neutral',
      title: t('lot.pieces', { count: summary.pieces }),
      detail: t('lot.pieces.detail'),
    });
  if (!online && ready.length > 0)
    rows.push({
      icon: 'wifiOff',
      tone: 'grey',
      title: t('lot.offline'),
      detail: t('lot.offline.detail'),
    });
  return { rows, ready: ready.length };
}
