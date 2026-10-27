import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  findDamagePhotos,
  liftDamage,
  reportDamage,
} from '#/features/damage/report';
import type { CourrierDatabase } from '#/features/db/schema';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { describeParcel } from '#/features/parcels/model';
import { describeRecord } from '#/features/parcels/record';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const t = createTranslator(DEFAULT_LOCALE);
const LATER = new Date(NOW.getTime() + 60_000);
const input = {
  reason: 'carton_abime' as const,
  note: ' Coin enfoncé ',
  notifyRecipient: true,
  carrierReserve: false,
};
const photo = () => ({
  blob: new Blob(['dommage'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});
const context = { people: new Map(), contacts: new Map() };

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

async function view(id: string, now = NOW) {
  const record = await loadParcelRecord(db, id);
  if (!record) throw new Error('missing');
  return describeRecord(record, { now, t, showUnsent: true });
}

describe('reportDamage', () => {
  it('writes the reserve, its event and its photos in one go', async () => {
    const row = parcelRow();
    await db.parcel.put(row);

    await reportDamage(db, files, row.id, input, [photo(), photo()], {
      agentId: 'agent-1',
      now: NOW,
    });

    expect(await db.parcel.get(row.id)).toMatchObject({
      damage: 'carton_abime',
      damageNote: 'Coin enfoncé',
      damageNotify: true,
      damageCarrierReserve: false,
      damagedAt: NOW,
    });
    const [op, event] = await db.outbox.toArray();
    expect(op?.patch).toMatchObject({ damage: 'carton_abime', damagedAt: NOW });
    expect(event?.patch).toMatchObject({
      entityId: row.id,
      type: 'parcel.damaged',
      actorId: 'agent-1',
      at: NOW,
      detail: { reason: 'carton_abime', note: 'Coin enfoncé', photos: 2 },
    });
    const photos = await findDamagePhotos(db, row.id, NOW);
    expect(photos).toHaveLength(2);
    expect(photos.every((saved) => saved.kind === 'dommage')).toBe(true);
    expect(files.files.size).toBe(2);
  });

  it('shows the reserve on the row and on the record, then lifts it', async () => {
    const row = parcelRow();
    await db.parcel.put(row);
    await reportDamage(db, files, row.id, input, [], {
      agentId: 'agent-1',
      now: NOW,
    });

    const parcel = await db.parcel.get(row.id);
    if (!parcel) throw new Error('missing');
    expect(describeParcel(parcel, 'toNotify', context, NOW, t).damage).toBe(
      'Réserve · Carton abîmé',
    );
    expect((await view(row.id)).damage).toMatchObject({
      title: 'Réserve : carton abîmé',
      description: 'Coin enfoncé · Signalée aujourd’hui à 12 h 00',
      photos: 0,
    });

    await liftDamage(db, row.id, { agentId: 'agent-1', now: LATER });

    const lifted = await db.parcel.get(row.id);
    expect(lifted).toMatchObject({ damage: null, damagedAt: null });
    if (!lifted) throw new Error('missing');
    expect(
      describeParcel(lifted, 'toNotify', context, LATER, t).damage,
    ).toBeUndefined();
    const shown = await view(row.id, LATER);
    expect(shown.damage).toBeUndefined();
    expect(shown.history?.slice(0, 2).map((entry) => entry.title)).toEqual([
      'Réserve levée : carton abîmé',
      'Réserve : carton abîmé',
    ]);
  });

  it('sets a reserve again after a lifting, without the earlier photos', async () => {
    const row = parcelRow();
    await db.parcel.put(row);
    const agent = { agentId: 'agent-1' };
    await reportDamage(db, files, row.id, input, [photo()], {
      ...agent,
      now: NOW,
    });
    await liftDamage(db, row.id, { ...agent, now: LATER });
    const again = new Date(LATER.getTime() + 60_000);
    await reportDamage(
      db,
      files,
      row.id,
      { ...input, reason: 'mouille', carrierReserve: true },
      [photo()],
      { ...agent, now: again },
    );

    expect((await view(row.id, again)).damage).toMatchObject({
      title: 'Réserve : mouillé',
      photos: 1,
    });
    expect(await findDamagePhotos(db, row.id, again)).toHaveLength(1);
  });

  it('lifts nothing from a parcel that carries no reserve', async () => {
    const row = parcelRow();
    await db.parcel.put(row);

    await liftDamage(db, row.id, { agentId: 'agent-1', now: NOW });

    expect(await db.outbox.count()).toBe(0);
  });
});
