import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  confirmationGone,
  describeConfirmation,
} from '#/features/handover/confirmation';
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
      deliveredAt: NOW,
    }),
    parcelRow({ type: 'recommande', status: 'remis', deliveredAt: NOW }),
  ];
  await db.parcel.bulkPut(parcels);
});

const handedOver = async (
  method: 'qr' | 'pin' | 'manuel' | 'signature',
  proofs: { hasSignature?: boolean; hasPhoto?: boolean } = {},
) => {
  const row = handoverRow({
    parcelIds: parcels.map((p) => p.id),
    method,
    ...proofs,
  });
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
    ['signature', 'Signée', true],
  ] as const)('words the %s proof', async (method, label, done) => {
    const view = describeConfirmation(await handedOver(method), true, t);

    expect(view.proofs[0]).toMatchObject({ label, done });
  });

  it('offers the signature and the photo, each one tap away', async () => {
    const onSign = () => {};
    const onPhoto = () => {};
    const view = describeConfirmation(await handedOver('pin'), true, t, {
      onSign,
      onPhoto,
    });

    expect(view.proofs.slice(1, 3)).toEqual([
      { icon: 'sign', label: 'Ajouter une signature', onClick: onSign },
      { icon: 'camera', label: 'Ajouter une photo', onClick: onPhoto },
    ]);
  });

  it('ticks the signature and the photo once kept, with nothing left to add', async () => {
    const view = describeConfirmation(
      await handedOver('qr', { hasSignature: true, hasPhoto: true }),
      true,
      t,
      { onSign: () => {}, onPhoto: () => {} },
    );

    expect(view.proofs.slice(0, 3)).toEqual([
      { icon: 'qr', label: 'QR code vérifié', done: true },
      { icon: 'sign', label: 'Signature enregistrée', done: true },
      { icon: 'camera', label: 'Photo enregistrée', done: true },
    ]);
  });

  it('says a signature that could not be kept, the signature still to add', async () => {
    const view = describeConfirmation(await handedOver('manuel'), true, t, {
      failed: 'signature',
    });

    expect(view.proofs.map((proof) => proof.label)).toEqual([
      'Sans vérification',
      'Ajouter une signature',
      'Ajouter une photo',
      'Signature : Non enregistrée sur cet iPhone',
      'Envoyée au serveur',
    ]);
  });

  it('says « Signée » once for a handover picked by the name and signed', async () => {
    const view = describeConfirmation(
      await handedOver('signature', { hasSignature: true }),
      true,
      t,
    );

    expect(view.proofs.map((proof) => proof.label)).toEqual([
      'Signée',
      'Ajouter une photo',
      'Envoyée au serveur',
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

  it('says when the server refused the handover', async () => {
    const view = describeConfirmation(
      { ...(await handedOver('pin')), sync: 'rejected' },
      true,
      t,
    );

    expect(view.proofs.at(-1)).toEqual({
      icon: 'alert',
      label: 'Refusée par le serveur',
    });
  });

  it('leaves for Colis once the handover is gone or cancelled under it', async () => {
    const entry = await handedOver('pin');

    expect(confirmationGone(undefined)).toBe(false);
    expect(confirmationGone(entry)).toBe(false);
    expect(await loadHandoverEntry(db, 'nope')).toBeNull();
    expect(confirmationGone(null)).toBe(true);
    await db.handover.update(entry.handover.id, { cancelledAt: NOW });
    expect(
      confirmationGone(await loadHandoverEntry(db, entry.handover.id)),
    ).toBe(true);
  });

  it('leaves out a parcel another iPhone handed over first', async () => {
    await db.parcel.update(parcels[1]!.id, {
      deliveredAt: new Date(NOW.getTime() - 60_000),
    });
    const view = describeConfirmation(await handedOver('pin'), true, t);

    expect(view.title).toBe('1 colis remis');
    expect(view.parcels?.map((parcel) => parcel.id)).toEqual([parcels[0]!.id]);
  });
});
