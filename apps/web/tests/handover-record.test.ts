import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { newId } from '@repo/shared/id';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CourrierDatabase,
  LocalDirectoryPerson,
  LocalParcel,
  LocalPickupCode,
} from '#/features/db/schema';
import {
  HandoverRefusedError,
  recordHandover,
} from '#/features/handover/record-handover';
import type { RemiseColisSearch } from '#/features/handover/route';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { listHomeParcels } from '#/features/parcels/api/use-parcels';
import { describeRecord } from '#/features/parcels/record';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

const LATER = new Date(NOW.getTime() + 5 * 60 * 1000);
const AGENT = 'agent-1';

let db: CourrierDatabase;
let nora: LocalDirectoryPerson;
let parcels: LocalParcel[];
let code: LocalPickupCode;

beforeEach(async () => {
  db = await openTestDatabase();
  nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
  parcels = [
    parcelRow({ personId: nora.id, status: 'notifie', notifiedAt: NOW }),
    parcelRow({ personId: nora.id }),
    parcelRow({ personId: nora.id }),
  ];
  code = await pickupCodeRow({ personId: nora.id });
  await db.directoryPerson.put(nora);
  await db.parcel.bulkPut(parcels);
  await db.pickupCode.put(code);
});

const byPin = (
  overrides: Partial<RemiseColisSearch> = {},
): RemiseColisSearch => ({
  kind: 'person',
  id: nora.id,
  via: 'pin',
  at: NOW.getTime(),
  code: code.id,
  ...overrides,
});

const all = () => parcels.map((parcel) => parcel.id);

describe('recordHandover', () => {
  it('hands every ticked parcel over and closes the code once none is left', async () => {
    const done = await recordHandover(
      db,
      { ...byPin(), parcelIds: all() },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    expect(done).toMatchObject({ count: 3, firstName: 'Nora' });
    const handover = await db.handover.get(done.handoverId);
    expect(handover).toMatchObject({
      parcelIds: all(),
      personId: nora.id,
      contactId: null,
      recipientName: 'Nora Haddad',
      delegateName: null,
      method: 'pin',
      agentId: AGENT,
      agentName: 'Karim Benali',
      at: LATER,
      cancelledAt: null,
    });
    for (const parcel of await db.parcel.bulkGet(all())) {
      expect(parcel).toMatchObject({
        status: 'remis',
        deliveredAt: LATER,
        deliveredBy: AGENT,
      });
    }
    expect((await db.pickupCode.get(code.id))?.usedAt).toEqual(LATER);
    const events = await db.event.toArray();
    expect(
      events.map((event) => readParcelEvent(event.type, event.detail)),
    ).toEqual(
      all().map(() => ({
        type: 'parcel.delivered',
        handoverId: done.handoverId,
        method: 'pin',
      })),
    );
  });

  it('queues the handover before the parcels it lists, in one write', async () => {
    await recordHandover(
      db,
      { ...byPin(), parcelIds: all() },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    const ops = await db.outbox.orderBy('seq').toArray();
    expect(ops.map((op) => op.entity)).toEqual([
      'handover',
      'parcel',
      'parcel',
      'parcel',
      'event',
      'event',
      'event',
      'pickup_code',
    ]);
  });

  it('keeps the code open when a parcel stays on the shelf', async () => {
    const [kept, ...taken] = all();
    await recordHandover(
      db,
      { ...byPin(), parcelIds: taken },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    expect((await db.parcel.get(kept!))?.status).toBe('notifie');
    expect((await db.pickupCode.get(code.id))?.usedAt).toBeNull();
  });

  it('records a pick by the name as unchecked, and still closes the open code', async () => {
    const done = await recordHandover(
      db,
      {
        kind: 'person',
        id: nora.id,
        via: 'manuel',
        at: NOW.getTime(),
        parcelIds: all(),
      },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    expect((await db.handover.get(done.handoverId))?.method).toBe('manuel');
    expect((await db.pickupCode.get(code.id))?.usedAt).toEqual(LATER);
  });

  it('notes who collected for the recipient, the method left as checked', async () => {
    const done = await recordHandover(
      db,
      { ...byPin(), parcelIds: all(), delegateName: '  Paul   Mercier ' },
      { agentId: AGENT, now: LATER },
    );

    expect(await db.handover.get(done.handoverId)).toMatchObject({
      recipientName: 'Nora Haddad',
      delegateName: 'Paul Mercier',
      method: 'pin',
    });
    expect((await db.pickupCode.get(code.id))?.usedAt).toEqual(LATER);
  });

  it('notes nobody when the recipient collects themselves', async () => {
    const done = await recordHandover(
      db,
      { ...byPin(), parcelIds: all(), delegateName: 'nora HADDAD' },
      { agentId: AGENT, now: LATER },
    );

    expect((await db.handover.get(done.handoverId))?.delegateName).toBeNull();
  });

  it('hands a contact’s parcels over by their name', async () => {
    const contact = contactRow({ name: 'Marc Petit' });
    const parcel = parcelRow({ contactId: contact.id });
    await db.contact.put(contact);
    await db.parcel.put(parcel);

    const done = await recordHandover(
      db,
      {
        kind: 'contact',
        id: contact.id,
        via: 'manuel',
        at: NOW.getTime(),
        parcelIds: [parcel.id],
      },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    expect(done.firstName).toBe('Marc');
    expect(await db.handover.get(done.handoverId)).toMatchObject({
      personId: null,
      contactId: contact.id,
      recipientName: 'Marc Petit',
    });
  });

  it.each([
    [
      'expired since the check',
      { expiresAt: new Date(NOW.getTime() + 60 * 1000) },
      'expired',
    ],
    ['used on another iPhone', { usedAt: NOW }, 'used'],
    ['replaced by a later mail', { deletedAt: NOW }, 'replaced'],
  ] as const)(
    'refuses a code %s, and writes nothing',
    async (_, change, reason) => {
      await db.pickupCode.put({ ...code, ...change });

      const write = recordHandover(
        db,
        { ...byPin(), parcelIds: all() },
        { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
      );

      await expect(write).rejects.toEqual(new HandoverRefusedError(reason));
      expect(await db.outbox.count()).toBe(0);
      expect(await db.handover.count()).toBe(0);
    },
  );

  it('refuses a QR or a code the URL does not name, or names for someone else', async () => {
    const other = await pickupCodeRow({ personId: newId() });
    await db.pickupCode.put(other);
    const options = { agentId: AGENT, agentName: 'Karim Benali', now: LATER };

    await expect(
      recordHandover(
        db,
        { ...byPin({ via: 'qr', code: undefined }), parcelIds: all() },
        options,
      ),
    ).rejects.toEqual(new HandoverRefusedError('missing'));
    await expect(
      recordHandover(
        db,
        { ...byPin({ code: other.id }), parcelIds: all() },
        options,
      ),
    ).rejects.toEqual(new HandoverRefusedError('mismatch'));
    await expect(
      recordHandover(
        db,
        { ...byPin({ code: newId() }), parcelIds: all() },
        options,
      ),
    ).rejects.toEqual(new HandoverRefusedError('unknown'));
  });

  it('refuses a parcel handed over meanwhile, or none ticked', async () => {
    await db.parcel.put({
      ...parcels[0]!,
      status: 'remis',
      deliveredAt: NOW,
      deliveredBy: 'agent-2',
    });
    const options = { agentId: AGENT, agentName: 'Karim Benali', now: LATER };

    await expect(
      recordHandover(db, { ...byPin(), parcelIds: all() }, options),
    ).rejects.toEqual(new HandoverRefusedError('stale'));
    await expect(
      recordHandover(db, { ...byPin(), parcelIds: [] }, options),
    ).rejects.toEqual(new HandoverRefusedError('nothing'));
    expect(await db.outbox.count()).toBe(0);
  });

  it('refuses when the person left this iPhone', async () => {
    await db.directoryPerson.put({ ...nora, deletedAt: NOW });

    await expect(
      recordHandover(
        db,
        { ...byPin(), parcelIds: all() },
        { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
      ),
    ).rejects.toEqual(new HandoverRefusedError('gone'));
  });
});

describe('a parcel handed over', () => {
  const t = createTranslator(DEFAULT_LOCALE);

  it('says on Colis and on its record to whom and how, and counts as handed over', async () => {
    const [kept, ...taken] = all();
    await recordHandover(
      db,
      { ...byPin({ via: 'qr' }), parcelIds: taken },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    const rows = await listHomeParcels(db, LATER);
    const handed = rows.filter((row) => row.state === 'handedOver');
    expect(handed.map((row) => row.status)).toEqual([
      'Remis à 12 h 05, QR vérifié',
      'Remis à 12 h 05, QR vérifié',
    ]);
    expect(rows.find((row) => row.id === kept)?.state).toBe('notified');

    const record = await loadParcelRecord(db, taken[0]!);
    expect(
      describeRecord(record!, { now: LATER, t, showUnsent: true }).state,
    ).toMatchObject({
      title: 'Remis à 12 h 05',
      description: 'À Nora Haddad, QR vérifié',
    });
  });

  it('says a pick by the name went unchecked', async () => {
    await recordHandover(
      db,
      {
        kind: 'person',
        id: nora.id,
        via: 'manuel',
        at: NOW.getTime(),
        parcelIds: all(),
      },
      { agentId: AGENT, agentName: 'Karim Benali', now: LATER },
    );

    const record = await loadParcelRecord(db, all()[0]!);
    expect(
      describeRecord(record!, { now: LATER, t, showUnsent: true }).state
        .description,
    ).toBe('À Nora Haddad, sans vérification');
  });
});
