import { normalizeName } from '@repo/shared/text';
import type { Parcel } from '@repo/ui';

/**
 * The ticked parcels of the home list, by id: a row scrolled out of the
 * virtual list or hidden by a filter stays ticked, and a parcel gone from
 * the list (deleted, synced away) drops out of what the actions see.
 */
export type Selection = ReadonlySet<string>;

export function toggled(
  selection: Selection,
  id: string,
  selected: boolean,
): Selection {
  const next = new Set(selection);
  if (selected) next.add(id);
  else next.delete(id);
  return next;
}

/** Every id of `ids` ticked, or every one unticked when all already were. */
export function toggledAll(
  selection: Selection,
  ids: readonly string[],
): Selection {
  const next = new Set(selection);
  if (allTicked(selection, ids)) for (const id of ids) next.delete(id);
  else for (const id of ids) next.add(id);
  return next;
}

export function allTicked(
  selection: Selection,
  ids: readonly string[],
): boolean {
  return ids.length > 0 && ids.every((id) => selection.has(id));
}

/** The ticked ids still in the list, in the list's order. */
export function tickedIn(
  selection: Selection,
  rows: readonly { id: string }[],
): string[] {
  return rows.filter((row) => selection.has(row.id)).map((row) => row.id);
}

/**
 * Whether a row answers what was typed over the selection: the name, the
 * department, the carrier or the end of the number, accents and case
 * ignored, every word found.
 */
export function matchesQuery(row: Parcel, query: string): boolean {
  const words = normalizeName(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const text = normalizeName(
    [
      row.recipient,
      row.department,
      row.carrier,
      row.last4,
      row.tracking ?? '',
      row.detail ?? '',
    ].join(' '),
  );
  return words.every((word) => text.includes(word));
}
