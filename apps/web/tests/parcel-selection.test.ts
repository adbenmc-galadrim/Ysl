import type { Parcel, ParcelState } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import { filterRows } from '#/features/parcels/sections';
import {
  allTicked,
  matchesQuery,
  tickedIn,
  toggled,
  toggledAll,
} from '#/features/parcels/selection';

const row = (
  id: string,
  state: ParcelState,
  recipient = 'Nora Haddad',
  remindDue = false,
): Parcel & { remindDue: boolean } => ({
  id,
  recipient,
  department: 'Communication',
  carrier: 'UPS',
  last4: id.padStart(4, '0'),
  state,
  status: '',
  remindDue,
});

describe('selection', () => {
  const rows = [
    row('1', 'toNotify', 'Camille Morel'),
    row('2', 'notified', 'Hugo Lefèvre', true),
    row('3', 'late', 'Inès Garnier'),
    row('4', 'notified', 'Nora Haddad', true),
  ];

  it('keeps the rows a filter hides ticked, and lists them in the list order', () => {
    let selection = toggled(new Set(), '3', true);
    selection = toggled(selection, '1', true);
    const reminded = filterRows(rows, 'remind').map(({ id }) => id);
    selection = toggledAll(selection, reminded);
    expect(tickedIn(selection, rows)).toEqual(['1', '2', '3', '4']);
    expect(allTicked(selection, reminded)).toBe(true);
  });

  it('follows the ids, not the positions, when rows come and go', () => {
    const selection = new Set(['2', '4']);
    const resorted = [rows[3]!, row('5', 'toNotify'), rows[1]!];
    expect(tickedIn(selection, resorted)).toEqual(['4', '2']);
    expect(tickedIn(selection, [rows[0]!])).toEqual([]);
  });

  it('unticks a whole section in one go once all of it is ticked', () => {
    const selection = new Set(['2', '4', '1']);
    expect(tickedIn(toggledAll(selection, ['2', '4']), rows)).toEqual(['1']);
    expect(allTicked(new Set(), [])).toBe(false);
  });

  it('narrows to the rows answering every word, accents ignored', () => {
    expect(matchesQuery(rows[1]!, 'hugo lefevre')).toBe(true);
    expect(matchesQuery(rows[1]!, 'ups 0002')).toBe(true);
    expect(matchesQuery(rows[1]!, 'hugo dhl')).toBe(false);
    expect(matchesQuery(rows[1]!, '  ')).toBe(true);
  });
});
