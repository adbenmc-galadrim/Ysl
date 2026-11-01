import { reminderMode } from '@repo/contract/operating-profile';
import { readOperatingProfile } from '#/features/settings/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmptyState, SelectionScreen, Sheet, Toast } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { useAccess } from '#/features/auth/use-access';
import { db } from '#/features/db/database';
import { goesOnTour } from '#/features/parcels/tour';
import type { LocalParcel } from '#/features/db/schema';
import { writeQueue } from '#/features/handover/queue';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { deleteParcels } from '#/features/parcels/status';
import { prepareQuery } from '#/features/search/search-index';
import type { HomeParcel } from '#/features/parcels/model';
import {
  type CounterId,
  counters,
  filterRows,
  toSections,
} from '#/features/parcels/sections';
import {
  allTicked,
  planHandovers,
  planMails,
  rowMatches,
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
  const session = useSession();
  const access = useAccess();
  const [sheet, setSheet] = useState<'more' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState<Selection>(initial);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const visible = useMemo(() => {
    const words = prepareQuery(query);
    return filterRows(rows, counter).filter((row) => rowMatches(row, words));
  }, [rows, counter, query]);
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
  const notices = tickedRows.some(
    (row) => row.state === 'toNotify' || row.state === 'deposited',
  );

  const loadTicked = async (): Promise<LocalParcel[]> =>
    (await db.parcel.bulkGet(ticked)).filter((parcel) => parcel !== undefined);

  const remind = async () => {
    const parcels = await loadTicked();
    const planned = planMails(parcels, await loadRecipientContext(db, parcels));
    // Reminders turned off (§3.7.9): only the first notices are left to send.
    const off =
      reminderMode((await readOperatingProfile(db)).reminders) === 'none';
    const plan = off ? { ...planned, reminder: [] } : planned;
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
    const { groups, skipped } = planHandovers(
      await loadTicked(),
      await goesOnTour(db),
    );
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

  // « Supprimer » takes what nobody was told about yet (logical delete).
  const deletable = tickedRows.filter(
    (row) =>
      row.state === 'incomplete' ||
      row.state === 'toNotify' ||
      row.state === 'toDispatch',
  ).length;
  const kept = tickedRows.length - deletable;
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const deleted = await deleteParcels(db, ticked, {
        agentId: session.user.id,
      });
      setSelection((prev) => {
        const next = new Set(prev);
        for (const id of deleted) next.delete(id);
        return next;
      });
      setSheet(null);
      setToast(
        t(
          deleted.length === 1
            ? 'selection.deleted.one'
            : 'selection.deleted.many',
          {
            count: deleted.length,
          },
        ),
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const sheets =
    sheet === 'more' ? (
      <Sheet
        fixed
        title={t('selection.more.title', { count: ticked.length })}
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setSheet(null)}
      >
        <Button
          variant="secondary"
          block
          icon="share"
          className="mt-6"
          onClick={() =>
            void navigate({ to: '/reglages/export', search: { colis: ticked } })
          }
        >
          {t('selection.more.export')}
        </Button>
        <Button
          variant="secondary"
          block
          icon="trash"
          className="mt-3 text-red"
          onClick={() => {
            setFailed(false);
            setSheet('delete');
          }}
        >
          {t('selection.more.delete')}
        </Button>
      </Sheet>
    ) : sheet === 'delete' ? (
      <Sheet
        fixed
        title={
          deletable
            ? t('selection.delete.title', { count: deletable })
            : t('selection.more.delete')
        }
        description={
          failed
            ? t('selection.error')
            : !deletable
              ? t('selection.delete.none')
              : [
                  t('selection.delete.description'),
                  kept > 0 &&
                    t(
                      kept === 1
                        ? 'selection.delete.kept.one'
                        : 'selection.delete.kept.many',
                      { count: kept },
                    ),
                ]
                  .filter(Boolean)
                  .join(' ')
        }
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setSheet(null)}
      >
        {deletable > 0 && (
          <Button
            variant="destructive"
            block
            disabled={busy}
            className="mt-6"
            onClick={() => void remove()}
          >
            {t('selection.delete.confirm')}
          </Button>
        )}
        <Button
          variant="secondary"
          block
          className={deletable > 0 ? 'mt-3' : 'mt-6'}
          onClick={() => setSheet(null)}
        >
          {t('selection.cancel')}
        </Button>
      </Sheet>
    ) : null;

  return (
    <>
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
        noHandover={!access.handsOver}
        onMore={() => setSheet('more')}
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
      {sheets}
    </>
  );
}
