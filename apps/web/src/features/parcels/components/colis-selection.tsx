import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmptyState, SelectionScreen, Toast } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { db } from '#/features/db/database';
import type { LocalParcel } from '#/features/db/schema';
import { writeQueue } from '#/features/handover/queue';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import type { HomeParcel } from '#/features/parcels/model';
import {
  type CounterId,
  counters,
  filterRows,
  toSections,
} from '#/features/parcels/sections';
import {
  allTicked,
  matchesQuery,
  planHandovers,
  planMails,
  type Selection,
  skipsLine,
  tickedIn,
  toggled,
  toggledAll,
} from '#/features/parcels/selection';

const t = createTranslator(DEFAULT_LOCALE);

export type ColisSelectionProps = {
  rows: readonly HomeParcel[];
  /** The counter on: still a filter while selecting (F32). */
  counter: CounterId | null;
  onCounter: (counter: CounterId | null) => void;
  /** The row the long press started on, or nothing from « Sélectionner ». */
  initial: Selection;
  onDone: () => void;
};

/**
 * The home list in selection mode (F31, maquette 05 « Sélection »): the
 * same sections, a tap ticks a row, « Tout » ticks a section, the counters
 * and a field narrow the rows in view without losing what was ticked.
 */
export function ColisSelection({
  rows,
  counter,
  onCounter,
  initial,
  onDone,
}: ColisSelectionProps) {
  const navigate = useNavigate();
  const [selection, setSelection] = useState<Selection>(initial);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const visible = useMemo(
    () => filterRows(rows, counter).filter((row) => matchesQuery(row, query)),
    [rows, counter, query],
  );
  const visibleIds = useMemo(() => visible.map((row) => row.id), [visible]);
  const ticked = useMemo(() => tickedIn(selection, rows), [selection, rows]);
  const sections = useMemo(
    () =>
      toSections(visible).map((section) => {
        const ids = section.parcels.map((parcel) => parcel.id);
        const full = allTicked(selection, ids);
        return {
          ...section,
          action: (
            <Button
              variant="link"
              className="text-15 font-normal"
              aria-label={t(
                full ? 'selection.section.noneOf' : 'selection.section.allOf',
                { section: section.title },
              )}
              onClick={() => setSelection((prev) => toggledAll(prev, ids))}
            >
              {t(full ? 'selection.section.none' : 'selection.section.all')}
            </Button>
          ),
        };
      }),
    [visible, selection],
  );

  const tickedRows = rows.filter((row) => selection.has(row.id));
  // A notice is due as soon as one ticked parcel was never notified.
  const notices = tickedRows.some((row) => row.state === 'toNotify');

  const loadTicked = async (): Promise<LocalParcel[]> =>
    (await db.parcel.bulkGet(ticked)).filter((parcel) => parcel !== undefined);

  const remind = async () => {
    const parcels = await loadTicked();
    const plan = planMails(parcels, await loadRecipientContext(db, parcels));
    const skipped = {
      ...(plan.skipped.recipient && {
        sansDestinataire: plan.skipped.recipient,
      }),
      ...(plan.skipped.address && { sansEmail: plan.skipped.address }),
    };
    if (plan.notice.length) {
      void navigate({
        to: '/notifier',
        search: {
          selection: plan.notice,
          ...(plan.reminder.length && { ensuite: plan.reminder }),
          ...skipped,
        },
      });
    } else if (plan.reminder.length) {
      void navigate({
        to: '/notifier',
        search: { selection: plan.reminder, relance: true, ...skipped },
      });
    } else {
      setToast(
        [t('selection.mail.none'), skipsLine(plan.skipped, t)]
          .filter(Boolean)
          .join(' · '),
      );
    }
  };

  // P4 by name, as « Remettre » does without a QR: one person opens their
  // parcels with the ticked ones ticked; several are handed over in turn.
  const handOver = async () => {
    const { groups, skipped } = planHandovers(await loadTicked());
    const [first, ...rest] = groups;
    if (!first) {
      setToast(
        [
          t('selection.handover.none'),
          skipped > 0 &&
            t(
              skipped === 1
                ? 'selection.handover.skipped.one'
                : 'selection.handover.skipped.many',
              { count: skipped },
            ),
        ]
          .filter(Boolean)
          .join(' · '),
      );
      return;
    }
    writeQueue(
      rest.map(({ recipient, parcelIds }) => ({
        ...recipient,
        name:
          rows.find((row) => row.id === parcelIds[0])?.recipient ??
          recipient.id,
        parcelIds,
      })),
    );
    void navigate({
      to: '/remise/colis',
      search: {
        ...first.recipient,
        via: 'manuel',
        at: Date.now(),
        colis: first.parcelIds,
        ...(rest.length > 0 && { file: true }),
      },
    });
  };

  return (
    <SelectionScreen
      sections={sections}
      selectedIds={ticked}
      onSelectedChange={(parcel, selected) =>
        setSelection((prev) => toggled(prev, parcel.id, selected))
      }
      allSelected={allTicked(selection, visibleIds)}
      onSelectAll={() => setSelection((prev) => toggledAll(prev, visibleIds))}
      onDone={onDone}
      counters={counters(rows, counter).map(({ id, label, count }) => ({
        label,
        count,
        selected: id === counter,
        onClick: () => onCounter(id === counter ? null : id),
      }))}
      query={query}
      onQueryChange={setQuery}
      remindLabel={t(notices ? 'selection.notify' : 'selection.remind')}
      onRemind={() => void remind()}
      onHandover={() => void handOver()}
      toast={toast ? <Toast message={toast} /> : undefined}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title={t('selection.empty.title')}
          description={t('selection.empty.description')}
          className="mt-[96px]"
        />
      ) : undefined}
    </SelectionScreen>
  );
}
