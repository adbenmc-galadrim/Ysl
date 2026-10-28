import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { describeConfirmation } from '#/features/handover/confirmation';
import { loadHandoverEntry } from '#/features/handover/entry';
import {
  handoverRow,
  NOW,
  openTestDatabase,
  parcelRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

let db: CourrierDatabase;
let parcels: LocalParcel[];

beforeEach(async () => {
  db = await openTestDatabase();
  parcels = [
    parcelRow({
      carrier: 'DPD',
      tracking: '09445566774471',
      senderName: 'Zalando',
      status: 'remis',
    }),
    parcelRow({ type: 'recommande', status: 'remis' }),
  ];
  await db.parcel.bulkPut(parcels);
});

const handedOver = async (method: 'qr' | 'pin' | 'manuel') => {
  const row = handoverRow({ parcelIds: parcels.map((p) => p.id), method });
  await db.handover.put(row);
  return (await loadHandoverEntry(db, row.id))!;
};

describe('describeConfirmation', () => {
  it('says how many, to whom and when, and lists the parcels', async () => {
    const view = describeConfirmation(await handedOver('qr'), true, t);

    expect(view.title).toBe('2 colis remis');
    expect(view.description).toBe('à Nora Haddad, à 12 h 00');
    expect(view.parcels).toEqual([
      { id: parcels[0]!.id, title: 'Zalando', detail: 'DPD ···4471' },
      expect.objectContaining({ id: parcels[1]!.id, title: 'Recommandé' }),
    ]);
    expect(view.offline).toBe(false);
  });

  it.each([
    ['qr', 'QR code vérifié', true],
    ['pin', 'Code vérifié', true],
    ['manuel', 'Sans vérification', false],
  ] as const)('words the %s proof', async (method, label, done) => {
    const view = describeConfirmation(await handedOver(method), true, t);

    expect(view.proofs[0]).toMatchObject({ label, done });
  });

  it('offers the signature and the photo as coming soon', async () => {
    const view = describeConfirmation(await handedOver('pin'), true, t);

    expect(view.proofs.slice(1, 3)).toEqual([
      { icon: 'sign', label: 'Ajouter une signature', soon: 'bientôt' },
      { icon: 'camera', label: 'Ajouter une photo', soon: 'bientôt' },
    ]);
  });

  it('ticks the server once the handover left the outbox', async () => {
    const view = describeConfirmation(await handedOver('pin'), true, t);

    expect(view.proofs.at(-1)).toMatchObject({
      label: 'Envoyée au serveur',
      done: true,
    });
  });

  it('says a handover written offline will be synchronised', async () => {
    const row = handoverRow({ parcelIds: parcels.map((p) => p.id) });
    await commitLocal(
      db,
      { upserts: [{ entity: 'handover', row }] },
      {
        now: NOW,
      },
    );
    const entry = (await loadHandoverEntry(db, row.id))!;

    expect(entry.sync).toBe('unsent');
    const offline = describeConfirmation(entry, false, t);
    expect(offline.offline).toBe(true);
    expect(offline.proofs.at(-1)).toEqual({
      icon: 'cloud',
      label: 'Sera synchronisée au retour du réseau',
    });
    expect(describeConfirmation(entry, true, t).proofs.at(-1)?.label).toBe(
      'Envoi au serveur en cours',
    );
  });

  it('finds nothing for a handover that is not on this iPhone', async () => {
    expect(await loadHandoverEntry(db, 'nope')).toBeNull();
  });
});
