import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmptyState, SelectionScreen } from '@repo/ui';
import { useMemo, useState } from 'react';
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
  type Selection,
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
  const [selection, setSelection] = useState<Selection>(initial);
  const [query, setQuery] = useState('');
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
