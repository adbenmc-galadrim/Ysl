import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import type { OutboxOp } from '#/features/db/schema';
import {
  describeChange,
  formatChangeTime,
  listWaitingChanges,
} from '#/features/sync/changes';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

const queued = (overrides: Partial<OutboxOp> = {}): Omit<OutboxOp, 'seq'> => ({
  opId: 'op-1',
  entity: 'parcel',
  entityId: 'row-1',
  type: 'upsert',
  patch: {},
  clientTs: new Date(2026, 9, 24, 10, 42),
  state: 'queued',
  attempts: 0,
  lastError: null,
  ...overrides,
});
const op = (overrides: Partial<OutboxOp> = {}): OutboxOp => ({
  seq: 1,
  ...queued(overrides),
});

describe('listWaitingChanges', () => {
  it('returns every operation oldest first, with the row it concerns', async () => {
    const db = await openTestDatabase();
    const parcel = parcelRow();
    const [first, second] = await commitLocal(
      db,
      {
        upserts: [
          { entity: 'parcel', row: parcel },
          { entity: 'directory_person', row: personRow() },
        ],
      },
      { now: NOW },
    );
    await db.outbox
      .where('opId')
      .equals(second!)
      .modify((waiting) => {
        waiting.clientTs = new Date(2026, 9, 23, 8, 0);
      });
    await db.outbox.add(
      queued({
        opId: 'orphan',
        entityId: 'gone',
        clientTs: new Date(NOW.getTime() + 60_000),
      }),
    );

    const changes = await listWaitingChanges(db);
    expect(changes.map((change) => change.op.opId)).toEqual([
      second,
      first,
      'orphan',
    ]);
    expect(changes[1]!.row).toMatchObject({ id: parcel.id });
    expect(changes[2]!.row).toBeNull();
  });
});

describe('describeChange', () => {
  it('names a parcel by the end of its tracking and the name read, a person by name', () => {
    expect(
      describeChange({ op: op(), row: parcelRow() }, t, NOW),
    ).toMatchObject({
      key: 'op-1',
      icon: 'package',
      label: 'Colis ···0622',
      value: '10 h 42',
      chevron: false,
    });
    expect(
      describeChange(
        { op: op(), row: parcelRow({ readName: 'Camille Morel' }) },
        t,
        NOW,
      ).label,
    ).toBe('Colis ···0622, Camille Morel');
    expect(
      describeChange(
        { op: op({ entity: 'directory_person' }), row: personRow() },
        t,
        NOW,
      ).label,
    ).toBe('Camille Morel');
  });

  it('falls back to the kind of thing when the row is gone or has no number', () => {
    expect(
      describeChange({ op: op(), row: parcelRow({ tracking: null }) }, t, NOW)
        .label,
    ).toBe('Colis');
    expect(
      describeChange({ op: op({ entity: 'handover' }), row: null }, t, NOW)
        .label,
    ).toBe('Remise');
  });

  it('marks deletions and refused operations', () => {
    expect(
      describeChange({ op: op({ type: 'delete' }), row: parcelRow() }, t, NOW)
        .label,
    ).toBe('Colis ···0622, supprimé');
    expect(
      describeChange(
        { op: op({ state: 'rejected', lastError: 'doublon' }), row: null },
        t,
        NOW,
      ).value,
    ).toBe('Refusé');
  });
});

describe('formatChangeTime', () => {
  it('drops the day today and shortens it before', () => {
    expect(formatChangeTime(new Date(2026, 9, 24, 9, 5), NOW)).toBe('9 h 05');
    expect(formatChangeTime(new Date(2026, 9, 23, 18, 30), NOW)).toBe(
      '23 oct. 18 h 30',
    );
  });
});
