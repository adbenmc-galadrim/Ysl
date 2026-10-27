import 'fake-indexeddb/auto';
import { isInternalTracking } from '@repo/contract/parcel-completion';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { completeTracking } from '#/features/parcels/complete';
import { newInternalTracking } from '#/features/parcels/internal-tracking';
import { missingOf } from '#/features/parcels/model';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const options = { agentId: 'agent-1', now: NOW };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

async function events(parcelId: string) {
  const rows = await db.event
    .where('[entity+entityId]')
    .equals(['parcel', parcelId])
    .toArray();
  return rows.map((row) => readParcelEvent(row.type, row.detail));
}

const unread = (overrides = {}) =>
  parcelRow({
    status: 'a_completer',
    tracking: null,
    trackingNorm: null,
    carrier: null,
    ...overrides,
  });

describe('completeTracking', () => {
  it('moves a parcel to « Reçu » once its number and recipient are set', async () => {
    const row = unread({ personId: 'p-1' });
    await db.parcel.put(row);

    const status = await completeTracking(
      db,
      row.id,
      { kind: 'tracked', tracking: '4815 1623 42', carrier: 'DPD' },
      options,
    );

    expect(status).toBe('recu');
    expect(await db.parcel.get(row.id)).toMatchObject({
      status: 'recu',
      tracking: '4815162342',
      trackingNorm: '4815162342',
      carrier: 'DPD',
      statusSeq: 1,
    });
    expect(await events(row.id)).toEqual([
      { type: 'parcel.edited', fields: ['tracking', 'carrier'] },
      { type: 'parcel.status', from: 'a_completer', to: 'recu' },
    ]);
  });

  it('keeps « À compléter » while nobody is set for the parcel', async () => {
    const row = unread({ readName: 'L. FONTAIN' });
    await db.parcel.put(row);

    const status = await completeTracking(
      db,
      row.id,
      { kind: 'tracked', tracking: '4815162342', carrier: 'GLS' },
      options,
    );

    expect(status).toBe('a_completer');
    expect(await db.parcel.get(row.id)).toMatchObject({ carrier: 'GLS' });
    expect(await events(row.id)).toEqual([
      { type: 'parcel.edited', fields: ['tracking', 'carrier'] },
    ]);
  });

  it('takes the number kept as is for the agent’s confirmation', async () => {
    const row = parcelRow({ status: 'a_completer', personId: 'p-1' });
    await db.parcel.put(row);

    await completeTracking(
      db,
      row.id,
      { kind: 'tracked', tracking: row.tracking!, carrier: row.carrier! },
      options,
    );

    expect(await db.parcel.get(row.id)).toMatchObject({ status: 'recu' });
    expect(await events(row.id)).toEqual([
      { type: 'parcel.status', from: 'a_completer', to: 'recu' },
    ]);
  });

  it('numbers a parcel « Sans suivi » and needs no carrier', async () => {
    const row = unread({ contactId: 'c-1' });
    await db.parcel.put(row);

    await completeTracking(db, row.id, { kind: 'untracked' }, options);

    const saved = await db.parcel.get(row.id);
    expect(saved).toMatchObject({
      type: 'sans_suivi',
      status: 'recu',
      carrier: null,
    });
    expect(isInternalTracking(saved?.tracking)).toBe(true);
    expect(saved?.trackingNorm).toBe(saved?.tracking);
  });
});

describe('newInternalTracking', () => {
  it('draws again a number a parcel of this iPhone already holds', async () => {
    await db.parcel.put(parcelRow({ trackingNorm: 'INT00000000' }));
    const draws = ['INT00000000', 'INT00000001'];

    expect(await newInternalTracking(db, () => draws.shift()!)).toBe(
      'INT00000001',
    );
  });
});

describe('missingOf', () => {
  const t = createTranslator(DEFAULT_LOCALE);

  it('names what a parcel « À compléter » lacks', () => {
    expect(missingOf(unread(), t)).toBe('Destinataire inconnu · Numéro non lu');
    expect(missingOf(unread({ personId: 'p-1', tracking: '4815' }), t)).toBe(
      'Transporteur inconnu',
    );
    expect(
      missingOf(parcelRow({ status: 'a_completer', personId: 'p-1' }), t),
    ).toBe('Numéro à vérifier');
    expect(
      missingOf(unread({ type: 'sans_suivi', tracking: 'INT00000000' }), t),
    ).toBe('Destinataire inconnu');
  });

  it('says nothing once the parcel is received', () => {
    expect(missingOf(parcelRow({ status: 'recu' }), t)).toBe('');
  });
});
