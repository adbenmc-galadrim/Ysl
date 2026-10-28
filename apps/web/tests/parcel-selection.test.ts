import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { Parcel, ParcelState } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { filterRows } from '#/features/parcels/sections';
import {
  allTicked,
  matchesQuery,
  planMails,
  skipsLine,
  tickedIn,
  toggled,
  toggledAll,
} from '#/features/parcels/selection';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

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

describe('planMails', () => {
  it('writes once per person: a notice when one is due, else a reminder, and counts what it leaves out', async () => {
    const db = await openTestDatabase();
    const nora = personRow({ firstName: 'Nora', email: 'nora@example.com' });
    const hugo = personRow({ firstName: 'Hugo', email: 'hugo@example.com' });
    const marc = personRow({ firstName: 'Marc', email: '' });
    await db.directoryPerson.bulkPut([nora, hugo, marc]);
    const noraNew = parcelRow({ personId: nora.id });
    const noraOld = parcelRow({
      personId: nora.id,
      status: 'notifie',
      notifiedAt: NOW,
    });
    const hugoOld = parcelRow({
      personId: hugo.id,
      status: 'notifie',
      notifiedAt: NOW,
    });
    const parcels = [
      noraNew,
      noraOld,
      hugoOld,
      parcelRow({ personId: marc.id }),
      parcelRow({ status: 'a_completer', readName: 'J. Doe' }),
      parcelRow({ readName: 'Sans fiche' }),
      parcelRow({ personId: hugo.id, status: 'remis', deliveredAt: NOW }),
    ];

    const plan = planMails(parcels, await loadRecipientContext(db, parcels));

    expect(plan.notice.sort()).toEqual([noraNew.id, noraOld.id].sort());
    expect(plan.reminder).toEqual([hugoOld.id]);
    expect(plan.skipped).toEqual({ recipient: 2, address: 1 });
    expect(skipsLine(plan.skipped, t)).toBe(
      '3 colis ignorés : 2 sans destinataire, 1 sans e-mail',
    );
    expect(skipsLine({ recipient: 0, address: 0 }, t)).toBeUndefined();
  });
});
