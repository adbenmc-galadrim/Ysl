import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  listWaitingParcels,
  receivedLine,
  toRemiseParcel,
  waitingCounts,
} from '#/features/handover/waiting';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('the parcels waiting for someone', () => {
  it('lists received and notified parcels only, oldest first', async () => {
    const nora = 'person-nora';
    const late = parcelRow({
      personId: nora,
      status: 'notifie',
      receivedAt: new Date(2026, 9, 22, 9, 0),
    });
    const fresh = parcelRow({ personId: nora });
    await db.parcel.bulkPut([
      fresh,
      late,
      parcelRow({
        personId: nora,
        status: 'remis',
        deliveredAt: NOW,
        deliveredBy: 'agent-1',
      }),
      parcelRow({ personId: nora, status: 'a_completer' }),
      parcelRow({ personId: nora, deletedAt: NOW }),
      parcelRow({ personId: 'person-hugo' }),
      parcelRow({ contactId: nora }),
    ]);

    const parcels = await listWaitingParcels(db, { kind: 'person', id: nora });

    expect(parcels.map((p) => p.id)).toEqual([late.id, fresh.id]);
  });

  it('counts them for each card and contact', async () => {
    await db.parcel.bulkPut([
      parcelRow({ personId: 'nora' }),
      parcelRow({ personId: 'nora', status: 'notifie' }),
      parcelRow({ contactId: 'atelier' }),
      parcelRow({ contactId: 'atelier', status: 'retourne' }),
      parcelRow({ status: 'recu' }),
    ]);

    expect(await waitingCounts(db)).toEqual(
      new Map([
        ['person:nora', 2],
        ['contact:atelier', 1],
      ]),
    );
  });
});

describe('a parcel as the handover lists it', () => {
  it('says when it came in, as the desk says it', () => {
    expect(receivedLine(new Date(2026, 9, 24, 10, 15), NOW, t)).toBe(
      'Reçu aujourd’hui à 10 h 15',
    );
    expect(receivedLine(new Date(2026, 9, 23, 18, 0), NOW, t)).toBe(
      'Reçu hier',
    );
    expect(receivedLine(new Date(2026, 9, 14, 9, 0), NOW, t)).toBe(
      'Reçu le 14 oct.',
    );
  });

  it('flags registered mail and drops the number of a parcel without one', () => {
    expect(
      toRemiseParcel(parcelRow({ type: 'recommande' }), NOW, t),
    ).toMatchObject({ carrier: 'UPS', last4: '0622', registered: true });
    expect(
      toRemiseParcel(
        parcelRow({ type: 'sans_suivi', carrier: null, tracking: 'YSL-MXA4' }),
        NOW,
        t,
      ),
    ).toMatchObject({ last4: '', registered: false });
  });

  it('tells who sent it and a reserve on its state, to check on the shelf', () => {
    const damaged = parcelRow({
      senderName: 'Zalando',
      damage: 'mouille',
      damagedAt: NOW,
    });

    expect(toRemiseParcel(damaged, NOW, t)).toMatchObject({
      sender: 'Zalando',
      damaged: true,
    });
    expect(toRemiseParcel(parcelRow(), NOW, t)).not.toHaveProperty('sender');
    expect(toRemiseParcel(parcelRow(), NOW, t).damaged).toBe(false);
  });
});
