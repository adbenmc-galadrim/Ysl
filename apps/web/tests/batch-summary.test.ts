import 'fake-indexeddb/auto';
import { damageColumns } from '@repo/contract/parcel-damage';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  batchSpan,
  countBatch,
  loadBatchSummary,
} from '#/features/batch/summary';
import type { CourrierDatabase, LocalBatch } from '#/features/db/schema';
import { groupByRecipient, mailsOfBatch } from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const BATCH = newId();

function batchRow(overrides: Partial<LocalBatch> = {}): LocalBatch {
  return {
    id: BATCH,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    agentId: 'agent-1',
    startedAt: new Date(2026, 9, 24, 10, 31),
    endedAt: new Date(2026, 9, 24, 10, 52),
    parcelCount: 4,
    ...overrides,
  };
}

const nora = personRow({
  firstName: 'Nora',
  lastName: 'Haddad',
  nameNorm: 'nora haddad',
  email: 'nora.haddad@example.com',
});

const damage = damageColumns({
  reason: 'carton_abime',
  note: null,
  notifyRecipient: false,
  carrierReserve: false,
  at: NOW,
});

describe('the counts of a saved batch', () => {
  it('counts the parcels to notify, to complete, with a reserve and in pieces', () => {
    const counts = countBatch([
      parcelRow({ batchId: BATCH, personId: nora.id }),
      parcelRow({ batchId: BATCH, status: 'a_completer' }),
      parcelRow({ batchId: BATCH, personId: nora.id, ...damage }),
      parcelRow({
        batchId: BATCH,
        personId: nora.id,
        pieceN: 1,
        pieceTotal: 2,
      }),
      parcelRow({
        batchId: BATCH,
        status: 'a_completer',
        pieceN: 2,
        pieceTotal: 2,
      }),
      parcelRow({ batchId: BATCH, personId: nora.id, deletedAt: NOW }),
    ]);

    expect(counts).toMatchObject({
      count: 5,
      toNotify: 3,
      damaged: 1,
      pieces: 2,
    });
    expect(counts.toComplete).toHaveLength(2);
  });

  it('lists the parcels to complete in scan order', () => {
    const late = parcelRow({
      status: 'a_completer',
      receivedAt: new Date(2026, 9, 24, 10, 50),
    });
    const early = parcelRow({
      status: 'a_completer',
      receivedAt: new Date(2026, 9, 24, 10, 35),
    });

    expect(countBatch([late, early]).toComplete.map(({ id }) => id)).toEqual([
      early.id,
      late.id,
    ]);
  });
});

describe('the span of a saved batch', () => {
  const t = createTranslator(DEFAULT_LOCALE);

  it('runs from its first to its last scan', () => {
    expect(batchSpan(batchRow(), t)).toBe('Lot de 10 h 31 à 10 h 52');
  });

  it('gives one time when it ended within the minute or has no end', () => {
    const startedAt = new Date(2026, 9, 24, 14, 2, 5);
    expect(
      batchSpan({ startedAt, endedAt: new Date(2026, 9, 24, 14, 2, 50) }, t),
    ).toBe('Lot de 14 h 02');
    expect(batchSpan({ startedAt, endedAt: null }, t)).toBe('Lot de 14 h 02');
  });
});

describe('the mails of a saved batch', () => {
  it('keeps the recipients of the batch, each with every parcel to notify', async () => {
    const marc = contactRow({ name: 'Marc Petit', email: null });
    const camille = personRow({
      firstName: 'Camille',
      lastName: 'Martin',
      nameNorm: 'camille martin',
      email: 'camille.martin@example.com',
    });
    await db.directoryPerson.bulkPut([nora, camille]);
    await db.contact.put(marc);
    const earlier = parcelRow({
      personId: nora.id,
      receivedAt: new Date(2026, 9, 23, 9),
    });
    const parcels = [
      earlier,
      parcelRow({ batchId: BATCH, personId: nora.id }),
      parcelRow({ batchId: BATCH, contactId: marc.id }),
      parcelRow({ personId: camille.id }),
    ];

    const mails = mailsOfBatch(
      groupByRecipient(parcels, await loadRecipientContext(db, parcels)),
      BATCH,
    );

    expect(mails.map((mail) => [mail.name, mail.address])).toEqual([
      ['Marc Petit', null],
      ['Nora Haddad', 'nora.haddad@example.com'],
    ]);
    expect(mails[1]?.parcels.map(({ id }) => id)).toContain(earlier.id);
  });
});

describe('loading « Lot enregistré »', () => {
  it('reads the batch and writes nothing, so « Plus tard » leaves it as it was', async () => {
    await db.directoryPerson.put(nora);
    await db.batch.put(batchRow());
    await db.parcel.bulkPut([
      parcelRow({ batchId: BATCH, personId: nora.id }),
      parcelRow({ batchId: BATCH, status: 'a_completer' }),
      parcelRow({ batchId: newId(), personId: nora.id }),
    ]);
    const before = {
      parcels: await db.parcel.toArray(),
      outbox: await db.outbox.count(),
      notifications: await db.notification.count(),
    };

    const summary = await loadBatchSummary(db, BATCH);

    expect(summary).toMatchObject({ count: 2, toNotify: 1 });
    expect(summary?.mails).toHaveLength(1);
    expect(summary?.mails[0]?.parcels).toHaveLength(2);
    expect(await db.parcel.toArray()).toEqual(before.parcels);
    expect(await db.outbox.count()).toBe(before.outbox);
    expect(await db.notification.count()).toBe(before.notifications);
  });

  it('finds nothing for a batch that is not saved', async () => {
    expect(await loadBatchSummary(db, newId())).toBeNull();
  });
});
