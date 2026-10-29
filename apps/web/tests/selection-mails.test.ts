import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  loadSelectionMails,
  selectionSecrets,
} from '#/features/mail/selection-mails';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('loadSelectionMails', () => {
  const nora = personRow({ firstName: 'Nora', email: 'nora@example.com' });
  const ticked = parcelRow({ personId: nora.id });
  const notified = parcelRow({
    personId: nora.id,
    status: 'notifie',
    notifiedAt: NOW,
  });
  const untouched = parcelRow({ personId: nora.id });

  beforeEach(async () => {
    await db.directoryPerson.put(nora);
    await db.parcel.bulkPut([ticked, notified, untouched]);
  });

  it('writes about the ticked parcels only, never another of the same person', async () => {
    const mails = await loadSelectionMails(
      db,
      [ticked.id, notified.id, 'gone'],
      false,
    );

    expect(mails).toHaveLength(1);
    expect(mails[0]?.parcels.map(({ id }) => id).sort()).toEqual(
      [ticked.id, notified.id].sort(),
    );
  });

  it('reminds of the notified ones alone, quoting the code the person holds', async () => {
    await db.pickupCode.put(
      await pickupCodeRow({ personId: nora.id }, { pin: '4821' }),
    );

    const mails = await loadSelectionMails(db, [ticked.id, notified.id], true);
    const [secret] = await selectionSecrets(db, mails, true, NOW);
    const notices = await loadSelectionMails(db, [ticked.id], false);
    const [fresh] = await selectionSecrets(db, notices, false, NOW);

    expect(mails[0]?.parcels.map(({ id }) => id)).toEqual([notified.id]);
    expect(secret?.pin).toBe('4821');
    expect(fresh?.pin).not.toBe('4821');
  });
});
